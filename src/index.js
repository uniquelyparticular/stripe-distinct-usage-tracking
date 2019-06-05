const {
  createUsageRecords,
  decryptAES,
  getFeatureFlags,
  newThisPeriod
} = require('./utils')
const { json, send } = require('micro')
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

module.exports = cors(async (req, res) => {
  // console.log('req.method',req.method)
  if (req.method === 'OPTIONS') {
    return send(res, 204)
  }

  if (req.method !== 'POST') {
    return notSupported(req, res)
  }

  if (
    !isAuthorized(
      getOrigin(req.headers.origin, req.headers.referer),
      originWhiteList
    )
  ) {
    return notAuthorized(req, res)
  }

  try {
    const initialVector = await req.headers[secretHeader]
    // console.log('initialVector',initialVector)

    const rawBody = await json(req)
    // console.log('rawBody',rawBody)

    if (!rawBody.encrypted) {
      return notEncrypted(req, res)
    }

    const body = JSON.parse(
      decryptAES(rawBody.encrypted, sharedSecret, initialVector)
    )

    // console.log('body',body)
    const { applicationId, collectionId, subscription, tracked } = body // tracked = agent/user

    return getFeatureFlags(applicationId, collectionId, subscription).then(
      featuredFlags => {
        // console.log('featuredFlags',featuredFlags)
        return newThisPeriod(applicationId, collectionId, subscription, tracked)
          .then(isNewThisPeriod => {
            if (isNewThisPeriod) {
              return createUsageRecords(subscription.items)
                .then(() => {
                  return send(res, 200, {
                    newThisPeriod: isNewThisPeriod,
                    featuredFlags
                  })
                })
                .catch(error => {
                  const { raw, headers, ...jsonError } = _toJSON(error)
                  return send(res, 500, jsonError)
                })
            } else {
              return send(res, 200, {
                newThisPeriod: isNewThisPeriod,
                featuredFlags
              })
            }
          })
          .catch(error => {
            console.error('error', error)
            const jsonError = _toJSON(error)
            return send(res, error.statusCode || 500, jsonError)
          })
      }
    )
  } catch (error) {
    const jsonError = _toJSON(error)
    return send(res, 500, jsonError)
  }
})
