const { newThisPeriod } = require('./utils')
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
    error: 'Referer or Destination not whitelisted or insecure'
  })
const invalidSecret = async (req, res) =>
  send(res, 401, {
    error: `${secretHeader} missing or invalid`
  })
const notSupported = async (req, res) =>
  send(res, 405, { error: 'Method not supported yet' })

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
  process.env.USAGETRACKING_SECRET_HEADER || 'x-webhook-secret-key'
const secretValue = process.env.USAGETRACKING_SECRET_VALUE

const getOrigin = (origin, referer) => {
  // console.log('getOrigin, origin', origin)
  // console.log('getOrigin, referer', referer)
  const subOrigin = referer ? referer.match(/\?origin=([^\?&]+)/) : null
  if (subOrigin) {
    origin = decodeURIComponent(subOrigin[1])
  }
  return origin || referer
}

module.exports = cors(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return send(res, 204)
  }

  if (req.method !== 'POST') {
    return notSupported(req, res)
  }

  if (secretValue && (await req.headers[secretHeader]) != secretValue) {
    return invalidSecret(req, res)
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
    const body = await json(req)
    // console.log('body',body)
    return newThisPeriod(body)
      .then(isNewThisPeriod => {
        return send(res, 200, {
          newThisPeriod: isNewThisPeriod
        })
      })
      .catch(error => {
        const jsonError = _toJSON(error)
        return send(res, error.statusCode || 500, jsonError)
      })
  } catch (error) {
    const jsonError = _toJSON(error)
    return send(res, 500, jsonError)
  }
})
