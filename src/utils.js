const { encryptedKeys } = require('./encrypted')
const crypto = require('crypto')
const moment = require('moment-timezone')
const admin = require('firebase-admin')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const wrapKeyData = (keyData, keyType = 'RSA PRIVATE') => {
  return `-----BEGIN ${keyType} KEY-----${keyData.replace(
    /\"/g,
    ''
  )}-----END ${keyType} KEY-----\n`.replace(/\\n/g, '\n')
}

const getRecrypted = encrypted => {
  const [begining, hiddenInitialVector, end] = encrypted.split(/_(.*==)=/g)
  return { initialVector: hiddenInitialVector, encrypted: `${begining}${end}` }
}

const getEncryptedKey = (name, keys) => {
  const [keyName, encryptedKey] = Object.entries(keys).find(
    ([entryKey, entryValue]) => entryKey === name
  )
  return encryptedKey
}

const encryptRSA = (toEncrypt, publicKey) => {
  return crypto
    .publicEncrypt(publicKey, Buffer.from(JSON.stringify(toEncrypt)))
    .toString('base64')
}

const decryptRSA = (toDecrypt, privateKey) => {
  return crypto
    .privateDecrypt(privateKey, Buffer.from(toDecrypt, 'base64'))
    .toString('utf8')
}

const getInitialVector = () => {
  return crypto.randomBytes(16).toString('base64')
}

const encryptAES = (toEncrypt, sharedSecret, initialVector) => {
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(sharedSecret, 'base64'),
    Buffer.from(initialVector, 'base64')
  )
  const encrypted = cipher.update(JSON.stringify(toEncrypt))
  return Buffer.concat([encrypted, cipher.final()]).toString('base64')
}

const decryptAES = (toDecrypt, sharedSecret, initialVector) => {
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
}

const encryptedKey = getEncryptedKey('storage_4096', encryptedKeys)
// console.log('encryptedKey',encryptedKey)

const {
  initialVector: hiddenInitialVector,
  encrypted: recryptedKey
} = getRecrypted(encryptedKey)
// console.log('hiddenInitialVector',hiddenInitialVector)
// console.log('recryptedKey',recryptedKey)

const AESdecryptedSavedPrivateKeyData = decryptAES(
  recryptedKey,
  process.env.STORAGE_SECRET_KEY,
  hiddenInitialVector
)
// console.log('AESdecryptedSavedPrivateKeyData',AESdecryptedSavedPrivateKeyData)

const AESdecryptedSavedPrivateKey = wrapKeyData(AESdecryptedSavedPrivateKeyData)
// console.log('AESdecryptedSavedPrivateKey',AESdecryptedSavedPrivateKey)

const _firebaseConfig = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: wrapKeyData(process.env.FIREBASE_PRIVATE_KEY, 'PRIVATE'),
  client_email: `firebase-adminsdk-3gpvn@${process.env.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-3gpvn%40${process.env.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`
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
  wrapKeyData,
  getRecrypted,
  getEncryptedKey,
  encryptRSA,
  decryptRSA,
  getInitialVector,
  encryptAES,
  decryptAES,

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

  getFeatureFlags(applicationId, collectionId, subscription) {
    // collectionId = org, tracked = user
    return new Promise((resolve, reject) => {
      const appConfigCollection = firestore
        .collection('app-config')
        .doc(`${applicationId}`)
        .collection(`${collectionId}`)

      return appConfigCollection
        .get()
        .then(providerDocs => {
          let providers = {}
          providerDocs.forEach(providerDoc => {
            const providerType = providerDoc.id
            const {
              config: encryptedConfig,
              type,
              version,
              ...extra
            } = providerDoc.data()
            const decryptedConfig = JSON.parse(
              decryptRSA(encryptedConfig, AESdecryptedSavedPrivateKey)
            )
            providers = Object.assign(
              {
                [providerType]: {
                  type,
                  version,
                  config: decryptedConfig,
                  ...extra
                }
              },
              providers
            )
          })
          return providers
        })
        .then(providers => {
          // console.log(`providers: ${JSON.stringify(providers)}`)

          const subscriptionRef = firestore
            .collection('feature-flags')
            .doc(`${applicationId}`)
            .collection(`subscription`)
            .doc(`${subscription.plan.id}`)

          return firestore
            .getAll(subscriptionRef)
            .then(subscriptionFlags => {
              return filterEnabledFlags(subscriptionFlags)
            })
            .then(enabledSubsciptionFlags => {
              // console.log('enabledSubsciptionFlags',enabledSubsciptionFlags)
              const providerRefs = Object.entries(providers).map(
                ([
                  providerType,
                  { type: providerName, version: providerVersion }
                ]) => {
                  return firestore
                    .collection('feature-flags')
                    .doc(`${applicationId}`)
                    .collection(`provider`)
                    .doc(`${providerType}`)
                    .collection(`${providerName}`)
                    .doc(`${providerVersion}`)
                }
              )
              return firestore
                .getAll(...providerRefs)
                .then(providerFlags => {
                  return filterEnabledFlags(providerFlags)
                })
                .then(enabledProviderFlags => {
                  // console.log('enabledProviderFlags',enabledProviderFlags)
                  return enabledSubsciptionFlags.filter(enabledSubsciberFlag =>
                    enabledProviderFlags.includes(enabledSubsciberFlag)
                  )
                })
            })
            .then(enabledSubscriptionProviderFlags => {
              // console.log('enabledSubscriptionProviderFlags',enabledSubscriptionProviderFlags)
              const accountRef = firestore
                .collection('feature-flags')
                .doc(`${applicationId}`)
                .collection(`account`)
                .doc(`${collectionId}`)

              return firestore
                .getAll(accountRef)
                .then(accountFlags => {
                  // anything custom enable for this specific account/organization
                  return filterEnabledFlags(
                    accountFlags,
                    enabledSubscriptionProviderFlags
                  )
                })
                .then(enabledAccountSubscriptionProviderFlags => {
                  // console.log('enabledAccountSubscriptionProviderFlags',enabledAccountSubscriptionProviderFlags)
                  return [...new Set(enabledAccountSubscriptionProviderFlags)] // removes dupes
                })
                .then(enabledFlags => {
                  // console.log()
                  // console.log('enabledFlags', enabledFlags)
                  // console.log()
                  resolve(enabledFlags)
                })
            })
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

const filterEnabledFlags = (potentialFlags, enableableFlags = []) => {
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
