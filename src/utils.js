const crypto = require('crypto')
const moment = require('moment-timezone')
const admin = require('firebase-admin')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

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

module.exports = {
  encryptRSA(toEncrypt, publicKey) {
    return crypto
      .publicEncrypt(publicKey, Buffer.from(JSON.stringify(toEncrypt)))
      .toString('base64')
  },

  decryptRSA(toDecrypt, privateKey) {
    return crypto
      .privateDecrypt(privateKey, Buffer.from(toDecrypt, 'base64'))
      .toString('utf8')
  },

  getInitialVector() {
    return crypto.randomBytes(16).toString('base64')
  },

  encryptAES(toEncrypt, sharedSecret, initialVector) {
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(sharedSecret, 'base64'),
      Buffer.from(initialVector, 'base64')
    )
    const encrypted = cipher.update(JSON.stringify(toEncrypt))
    return Buffer.concat([encrypted, cipher.final()]).toString('base64')
  },

  decryptAES(toDecrypt, sharedSecret, initialVector) {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(sharedSecret, 'base64'),
      Buffer.from(initialVector, 'base64')
    )
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(toDecrypt, 'base64')),
      decipher.final()
    ])
    return decrypted.toString('utf8')
  },

  newThisPeriod(applicationId, collectionId, subscription, tracked) {
    // collectionId = org, tracked = user
    return new Promise((resolve, reject) => {
      const metadata = tracked.metadata
      const trackedRef = firestore
        .collection('usage-tracking')
        .doc(`${applicationId}`)
        .collection(`${collectionId}`)
        .doc(`${subscription.id}`)
        .collection(
          `${moment
            .unix(subscription.current_period_start)
            .format('MMDDYYYY')}_${moment
            .unix(subscription.current_period_end)
            .format('MMDDYYYY')}`
        )
        .doc(`${tracked.id}`)

      return trackedRef
        .get()
        .then(billingPeriodTrackedRecord => {
          // console.log('billingPeriodTrackedRecord',billingPeriodTrackedRecord)
          return trackedRef
            .set(
              {
                metadata,
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
              resolve(!billingPeriodTrackedRecord.exists)
            })
            .catch(error => reject(error))
        })
        .catch(error => reject(error))
    })
  },

  createUsageRecords(
    subscriptionItems,
    quantity = 1,
    timestamp = moment().unix()
  ) {
    return new Promise((resolve, reject) => {
      const usageRecords = []
      subscriptionItems.map(subscriptionItem => {
        usageRecords.push(
          stripe.usageRecords
            .create(subscriptionItem.id, {
              quantity,
              timestamp
            })
            .then(handleError)
        )
      })

      return Promise.all(usageRecords)
        .then(responses => {
          resolve(responses)
        })
        .catch(error => reject(error))
    })
  },

  getFeatureFlags(applicationId, collectionId, subscription, providers = []) {
    // collectionId = org, tracked = user
    return new Promise((resolve, reject) => {
      const orgRef = firestore
        .collection('feature-flags')
        .doc(`${applicationId}`)
        .collection(`organization`)
        .doc(`${collectionId}`)

      const subscriptionRef = firestore
        .collection('feature-flags')
        .doc(`${applicationId}`)
        .collection(`subscription`)
        .doc(`${subscription.plan.id}`)

      const providerIds = providers.map(provider => provider.id)
      const providerRefs = providerIds.map(providerId => {
        return firestore
          .collection('feature-flags')
          .doc(`${applicationId}`)
          .collection(`provider`)
          .doc(`${providerId}`)
      })

      return firestore
        .getAll(orgRef, subscriptionRef)
        .then(subscriberFlags => {
          return filterFlags(subscriberFlags)
        })
        .then(enabledSubsciberFlags => {
          return firestore
            .getAll(...providerRefs)
            .then(providerFlags => {
              return filterFlags(providerFlags)
            })
            .then(enabledProviderFlags => {
              return enabledSubsciberFlags.filter(enabledSubsciberFlag =>
                enabledProviderFlags.includes(enabledSubsciberFlag)
              )
            })
        })
        .then(enabledFlags => {
          resolve(enabledFlags)
        })
        .catch(error => reject(error))
    })
  }
}

const handleError = response => {
  return new Promise((resolve, reject) => {
    if (response.error) {
      console.error(
        `handleError, response.error: ${JSON.stringify(response.error)}`
      )
      reject(response.error)
    } else {
      resolve(response)
    }
  })
}

const filterFlags = potentialFlags => {
  const enableableFlags = []
  const disabledFlags = []
  potentialFlags.map(flag => {
    const data = flag.data()
    if (data) {
      for (const [key, val] of Object.entries(data)) {
        if (val) {
          enableableFlags.push(key)
        } else {
          disabledFlags.push(key)
        }
      }
    }
  })
  return enableableFlags.filter(
    enableableFlag => !disabledFlags.includes(enableableFlag)
  )
}
