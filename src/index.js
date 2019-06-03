const { json, send } = require('micro')
const { URL } = require('whatwg-url')
const moment = require('moment-timezone')
const cors = require('micro-cors')()
const admin = require('firebase-admin')

const _firebaseConfig = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: `-----BEGIN PRIVATE KEY-----${
    process.env.FIREBASE_PRIVATE_KEY
  }-----END PRIVATE KEY-----\n`.replace(/\\n/g, '\n'),
  client_email: `firebase-adminsdk-3gpvn@${
    process.env.FIREBASE_PROJECT_ID
  }.iam.gserviceaccount.com`,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-3gpvn%40${
    process.env.FIREBASE_PROJECT_ID
  }.iam.gserviceaccount.com`
}

// console.log('_firebaseConfig',_firebaseConfig)
if (!admin.apps.length) {
  const admin = require('firebase-admin')
  admin.initializeApp({
    credential: admin.credential.cert(_firebaseConfig),
    databaseURL: `https://${_firebaseConfig.project_id}.firebaseio.com`
  })
}
const firestore = admin.firestore()

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

    const trackedRef = firestore
      .collection('applications')
      .doc(`${body.applicationId}`)
      .collection(`${body.collectionId}`)
      .doc(`${body.subscription.id}`)
      .collection(
        `${moment
          .unix(body.subscription.current_period_start)
          .format('MMDDYYYY')}_${moment
          .unix(body.subscription.current_period_end)
          .format('MMDDYYYY')}`
      )
      .doc(`${body.tracked.id}`)

    return trackedRef
      .get()
      .then(billingPeriodTrackedRecord => {
        // console.log('billingPeriodTrackedRecord',billingPeriodTrackedRecord)
        return trackedRef
          .set(
            {
              value: body.tracked.value,
              usage: admin.firestore.FieldValue.arrayUnion(
                moment()
                  .utc()
                  .format()
              )
            },
            { merge: true }
          )
          .then(() => {
            // console.log(
            //   `trackedRef, newThisPeriod: ${!billingPeriodTrackedRecord.exists}`
            // )
            return send(res, 200, {
              newThisPeriod: !billingPeriodTrackedRecord.exists
            })
          })
          .catch(error => {
            const jsonError = _toJSON(error)
            return send(res, error.statusCode || 500, jsonError)
          })
      })
      .catch(error => {
        const jsonError = _toJSON(error)
        return send(res, error.statusCode || 500, jsonError)
      })

    return send(res, 200, JSON.stringify({ body: 'ok' }))
  } catch (error) {
    const jsonError = _toJSON(error)
    return send(res, 500, jsonError)
  }
})
