// TODO!!!!: this is duplicated in zendesk-commerce-plugins, move to shared project
/** ROLE FLAGS **/
const ROLE_ADMIN = 'admin'
const ROLE_AGENT = 'agent'

/** ORDER FLAGS **/
const FLAG_ORDER_HISTORY = 'order_history'
const FLAG_ORDER_DETAILS = 'order_details'
const FLAG_ORDER_SEARCH = 'order_search'
const FLAG_ORDER_PIN = 'order_pin'
const FLAG_ORDER_SORT = 'order_sort'
const FLAG_ORDER_PAYMENT = 'order_payment'
const FLAG_ORDER_REFUND = 'order_refund'
const FLAG_ORDER_CREATE = 'order_create'
const FLAG_ORDER_DUPLICATE = 'order_duplicate'
const FLAG_ORDER_MODIFY = 'order_modify'

/** PURCHASE FLAGS **/
const FLAG_PURCHASE_MODIFY = 'purchase_modify'

/** PAYMENT FLAGS **/
const FLAG_PAYMENT_TRANSACTIONS = 'payment_transcations'

/** SHIPPING FLAGS **/
const FLAG_SHIPPING_STATUS = 'shipping_status'

/** MISC FLAGS **/
const FLAG_CUSTOMER_SEARCH = 'customer_search'

module.exports = [
  ROLE_ADMIN,
  ROLE_AGENT,
  FLAG_ORDER_HISTORY,
  FLAG_ORDER_DETAILS,
  FLAG_ORDER_SEARCH,
  FLAG_ORDER_PIN,
  FLAG_ORDER_SORT,
  FLAG_ORDER_PAYMENT,
  FLAG_ORDER_REFUND,
  FLAG_ORDER_CREATE,
  FLAG_ORDER_DUPLICATE,
  FLAG_ORDER_MODIFY,
  FLAG_PURCHASE_MODIFY,
  FLAG_PAYMENT_TRANSACTIONS,
  FLAG_SHIPPING_STATUS,
  FLAG_CUSTOMER_SEARCH
]
