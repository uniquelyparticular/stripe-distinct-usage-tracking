const { encryptedKeys } = require('./encrypted')
const crypto = require('crypto')
const moment = require('moment-timezone')
const admin = require('firebase-admin')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

//TODO!!!!!!!!!!!!!!!!!!: moved to shared external project (used in zendesk-commerce/cryptoHelpers)
const safeParse = object => {
  if (
    object &&
    typeof object === 'string' &&
    (object.startsWith('{') || object.startsWith('['))
  ) {
    object = JSON.parse(object)
  }
  return object
}

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
  return !toEncrypt || !privateKey
    ? ''
    : crypto
        .publicEncrypt(publicKey, Buffer.from(JSON.stringify(toEncrypt)))
        .toString('base64')
}

const decryptRSA = (toDecrypt, privateKey) => {
  // console.log('decryptRSA, privateKey',privateKey)
  return !toDecrypt || !privateKey
    ? ''
    : crypto
        .privateDecrypt(privateKey, Buffer.from(toDecrypt, 'base64'))
        .toString('utf8')
}

const getInitialVector = () => {
  return crypto.randomBytes(16).toString('base64')
}

const encryptAES = (toEncrypt, sharedSecret, initialVector) => {
  if (!toEncrypt) return ''
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(sharedSecret, 'base64'),
    Buffer.from(initialVector, 'base64')
  )
  const encrypted = cipher.update(JSON.stringify(toEncrypt))
  return Buffer.concat([encrypted, cipher.final()]).toString('base64')
}

const decryptAES = (toDecrypt, sharedSecret, initialVector) => {
  if (!toDecrypt) return ''
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

const decryptConfig = (config, privateKey) => {
  console.log('decryptConfig, config', config)
  return config && typeof config !== 'object'
    ? JSON.parse(decryptRSA(config, privateKey))
    : config
}

const cleanProviders = providers => {
  if (providers) {
    return Object.entries(providers).reduce(
      (cleanedProviders, [providerType, providerData]) => {
        const { audit, ...data } = providerData
        cleanedProviders[providerType] = data
        return cleanedProviders
      },
      {}
    )
  }
}

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
  // wrapKeyData,
  // getRecrypted,
  // getEncryptedKey,
  // encryptRSA,
  // decryptRSA,
  // getInitialVector,
  safeParse,
  cleanProviders,
  encryptAES,
  decryptAES,

  isNewThisPeriod(applicationId, collectionId, subscription, tracked) {
    // collectionId = org, tracked = agent/user
    return new Promise((resolve, reject) => {
      const { metadata } = tracked
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
        // console.log('createUsageRecords, subscriptionItem',subscriptionItem)
        usageRecords.push(
          stripe.usageRecords
            .create(subscriptionItem, {
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
    // collectionId = org
    return new Promise((resolve, reject) => {
      const {
        plan: { id: planId }
      } = subscription
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
              config: savedConfig,
              type,
              version,
              ...metadata
            } = providerDoc.data()
            // console.log('savedConfig', savedConfig)
            const decryptedConfig = decryptConfig(savedConfig)
            console.log('decryptedConfig', decryptedConfig)
            providers = Object.assign(
              {
                [providerType]: {
                  type,
                  version,
                  config: decryptedConfig,
                  ...metadata
                }
              },
              providers
            )
          })
          return providers
        })
        .then(providers => {
          console.log(`providers: ${JSON.stringify(providers)}`)

          const subscriptionRef = firestore
            .collection('feature-flags')
            .doc(`${applicationId}`)
            .collection(`subscription`)
            .doc(`${planId}`)

          console.log('planId', planId)
          return firestore
            .getAll(subscriptionRef)
            .then(subscriptionFlags => {
              return filterEnabledFlags(subscriptionFlags)
            })
            .then(enabledSubsciptionFlags => {
              console.log('enabledSubsciptionFlags', enabledSubsciptionFlags)
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
                .then(featureFlags => {
                  // console.log('featureFlags', featureFlags)
                  resolve({ featureFlags, providers })
                })
            })
        })
        .catch(error => reject(error))
    })
  },

  saveProviderData(applicationId, collectionId, providers, audit) {
    // collectionId = org, audit = agent/user
    return new Promise((resolve, reject) => {
      const appConfigCollection = firestore
        .collection('app-config')
        .doc(`${applicationId}`)
        .collection(`${collectionId}`)

      const upsertPromises = []
      for (const [providerType, providerData] of Object.entries(providers)) {
        const { config, ...data } = providerData
        // const encryptedConfig = encryptRSA(config, publicRSAkey) // publicKey!??!
        const encryptedConfig = config
        const payload = {
          config: encryptedConfig,
          ...data,
          audit
        }
        console.log('saveProviderData, payload', payload)
        upsertPromises.push(appConfigCollection.doc(providerType).set(payload))
      }
      return Promise.all(upsertPromises)
        .then(upsertResponses => {
          console.log(
            'saveProviderData, upsertResponses.length',
            upsertResponses.length
          )
          resolve(upsertResponses)
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
  console.log(
    'filterEnabledFlags, potentialFlags.length',
    potentialFlags.length
  )
  potentialFlags.map(flag => {
    const data = flag.data()
    console.log('filterEnabledFlags, data', data)
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
  console.log('filterEnabledFlags, enableableFlags', enableableFlags)
  console.log('filterEnabledFlags, disabledFlags', disabledFlags)
  const filteredFlags = enableableFlags.filter(
    enableableFlag => !disabledFlags.includes(enableableFlag)
  )
  console.log('filterEnabledFlags, filteredFlags', filteredFlags)
  return filteredFlags
}
