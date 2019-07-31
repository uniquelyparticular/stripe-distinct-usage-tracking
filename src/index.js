const {
  safeParse,
  decryptAES,
  encryptAES,
  cleanProviders,
  getFeatureFlags,
  isNewThisPeriod,
  saveProviderData,
  createUsageRecords
} = require('./utils')
const flags = require('./flags')
const { json, send } = require('micro')
const { router, options, post, put } = require('microrouter')
const { URL } = require('whatwg-url')
const cors = require('micro-cors')()

const _toJSON = error => {
  return !error
    ? ''
    : Object.getOwnPropertyNames(error).reduce(
        (jsonError, key) => {
          return { ...jsonError, [key]: error[key] }
        },
        { type: 'error' }
      )
}

process.on('unhandledRejection', (reason, p) => {
  console.error(
    'Promise unhandledRejection: ',
    p,
    ', reason:',
    JSON.stringify(reason)
  )
})

const notAuthorized = async (req, res) =>
  send(res, 401, {
    error: 'Referer or Origin not whitelisted'
  })
const notSupported = async (req, res) =>
  send(res, 405, { error: 'Method not supported yet' })
const notEncrypted = async (req, res) =>
  send(res, 412, { error: 'Payload must contain encrypted body' })
const success = async (req, res, payload) => send(res, 200, payload)
const mocked = async (req, res) =>
  success(req, res, {
    newThisPeriod: false,
    featureFlags: flags
  })

const prepareRegex = string => {
  return string
    .replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&')
    .replace('\\*', '.+')
}

const isWhitelisted = (host, hostMap) => {
  return hostMap.some(entry => entry.test(host))
}

const parseURL = url => {
  const { hostname, protocol } = new URL(url)
  return { hostname, protocol }
}

const isAuthorized = (referer, whitelist = []) => {
  if (referer) {
    const { hostname } = parseURL(referer)
    return isWhitelisted(hostname, whitelist)
  } else {
    return false
  }
}

const toRegexArray = csv => {
  return (csv || '')
    .replace(/,\ /g, ',')
    .split(',')
    .map(value => new RegExp(`^${prepareRegex(value)}$`))
}

const originWhiteList = toRegexArray(process.env.USAGETRACKING_ORIGIN_WHITELIST)
const secretHeader =
  process.env.USAGETRACKING_SECRET_HEADER || 'x-shared-secret'
const sharedSecret = process.env.USAGETRACKING_SECRET_KEY

const getOrigin = (origin, referer) => {
  // console.log('getOrigin, origin before', origin)
  // console.log('getOrigin, referer', referer)
  const subOrigin = referer ? referer.match(/\?origin=([^\?&]+)/) : null
  if (subOrigin) {
    origin = decodeURIComponent(subOrigin[1])
  }
  // console.log('getOrigin, origin after', origin)
  return origin || referer
}

const handleAuthorize = (req, res) => {
  if (
    !isAuthorized(
      getOrigin(req.headers.origin, req.headers.referer),
      originWhiteList
    )
  ) {
    return notAuthorized(req, res)
  }
}

const handleError = (req, res, error) => {
  console.warn('handleError.error', error)
  // const jsonError = _toJSON(error)
  // return send(res, error.statusCode || 500, jsonError)
  //TODO!!!!!!!!!!!!!!!!!!!!!!
  //TEMP!!!!!!!!!!!!!!!!!!!!!: swallow error
  return mocked(req, res)
}

const getBody = async (req, res) => {
  let rawBody = {}
  try {
    rawBody = await json(req)
    // console.log('rawBody',rawBody)
  } catch (error) {
    console.error(error)
  }

  if (!rawBody.encrypted) {
    return null
  }

  const initialVector = await req.headers[secretHeader]
  // console.log('initialVector',initialVector)

  const body = safeParse(
    decryptAES(rawBody.encrypted, sharedSecret, initialVector)
  )

  return { body, initialVector }
}

const processOptions = async (req, res) => {
  // console.log('processOptions, req.headers', req.headers)
  // res.setHeader('access-control-allow-headers', allowHeaders(req.headers))
  return send(res, 204)
}

const processPost = async (req, res) => {
  handleAuthorize(req, res)

  try {
    const decrypted = await getBody(req, res)
    if (!decrypted) {
      return notEncrypted(req, res)
    }
    const { body, initialVector } = decrypted

    // console.log('processPost, body',body)
    const { applicationId, collectionId, subscription, tracked } = body // collectionId = org, tracked = agent
    // console.log('processPost, applicationId',applicationId)
    // console.log('processPost, collectionId',collectionId)
    // console.log('processPost, subscription',subscription)
    // console.log('processPost, tracked',tracked)
    const { items: subscriptionItems } = subscription
    // console.log('processPost, subscriptionItems',subscriptionItems)

    if (
      !applicationId ||
      !collectionId ||
      !subscription ||
      !tracked ||
      !subscriptionItems
    ) {
      return send(res, 400, {
        applicationId,
        collectionId,
        subscription,
        tracked,
        subscriptionItems
      })
    }

    const responses = await Promise.all([
      await isNewThisPeriod(applicationId, collectionId, subscription, tracked),
      await getFeatureFlags(applicationId, collectionId, subscription)
    ]).catch(error => handleError(req, res, error))
    // console.log('processPost, responses',responses)

    const [newThisPeriod, { featureFlags, providers }] = responses
    // console.log('processPost, newThisPeriod',newThisPeriod)
    // console.log('processPost, featureFlags',providers)
    // console.log('processPost, providers',providers)
    const unencrypted = {
      newThisPeriod,
      featureFlags,
      providers: cleanProviders(providers)
    }
    // console.log('processPost, unencrypted',unencrypted)

    const payload = {
      encrypted: encryptAES(unencrypted, sharedSecret, initialVector)
    }
    // console.log('processPost, payload',payload)

    if (newThisPeriod) {
      await createUsageRecords(subscriptionItems).catch(error =>
        handleError(req, res, error)
      )
      return success(req, res, payload)
    } else {
      return success(req, res, payload)
    }
  } catch (error) {
    console.error('Error', error)
    const jsonError = _toJSON(error)
    return send(res, 500, jsonError)
  }
}

const processPut = async (req, res) => {
  handleAuthorize(req, res)

  try {
    const decrypted = await getBody(req, res)
    if (!decrypted) {
      return notEncrypted(req, res)
    }
    const { body, initialVector } = decrypted

    // console.log('processPut, body', body)
    const { applicationId, collectionId, providers, audit } = body // collectionId = org, audit = agent
    // console.log('processPut, applicationId', applicationId)
    // console.log('processPut, collectionId', collectionId)
    // console.log('processPut, providers', providers)
    // console.log('processPut, audit', audit)

    if (!applicationId || !collectionId || !providers || !audit) {
      return send(res, 400, { applicationId, collectionId, providers, audit })
    }

    await saveProviderData(applicationId, collectionId, providers, audit).catch(
      error => handleError(req, res, error)
    )

    const payload = {
      encrypted: encryptAES(
        {
          providers
        },
        sharedSecret,
        initialVector
      )
    }

    return success(req, res, payload)
  } catch (error) {
    console.error('Error', error)
    const jsonError = _toJSON(error)
    return send(res, 500, jsonError)
  }
}

module.exports = cors(
  router(
    options('/*', processOptions),
    post('/*', processPost),
    put('/*', processPut)
  )
)
