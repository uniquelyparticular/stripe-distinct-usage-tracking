// TODO!!!!: this is duplicated in zendesk-commerce-plugins, move to shared project
/** ROLE FLAGS **/
const ROLE_ADMIN = 'admin'
const ROLE_AGENT = 'agent'

/** ORDER FLAGS (Commerce Provider) **/
const FLAG_ORDER_HISTORY = 'order_history'
const FLAG_ORDER_DETAILS = 'order_details'
const FLAG_ORDER_FILTER = 'order_filter'
const FLAG_ORDER_PIN = 'order_pin'
const FLAG_ORDER_SORT = 'order_sort'
const FLAG_ORDER_PAYMENT = 'order_payment'
const FLAG_ORDER_REFUND = 'order_refund'
const FLAG_ORDER_CREATE = 'order_create'
const FLAG_ORDER_DUPLICATE = 'order_duplicate'
const FLAG_ORDER_MODIFY = 'order_modify'

/** PAYMENT FLAGS (Payment or Commerce Provider) **/
const FLAG_PAYMENT_TRANSACTIONS = 'payment_transactions'
const FLAG_PAYMENT_USER_INTERFACE = 'payment_user_interface' // TODO: implement
const FLAG_PAYMENT_STORED_INTRUMENTS = 'payment_stored_instruments' // TODO: implement

/** SHIPPING FLAGS (Shipping Provider) **/
const FLAG_SHIPPING_STATUS = 'shipping_status'
const FLAG_SHIPPING_LABEL = 'shipping_label' // TODO: implement

/** SEARCH FLAGS (Search or Commerce Provider?) **/
const FLAG_SEARCH_CUSTOMERS = 'search_customers'
const FLAG_SEARCH_PRODUCTS = 'search_products' // TODO: implement

/** TAX FLAGS (Tax Provider?) **/
const FLAG_TAX_CALCULATOR = 'tax_calculator' // TODO: implement

module.exports = [
  ROLE_ADMIN,
  ROLE_AGENT,
  FLAG_ORDER_HISTORY,
  FLAG_ORDER_DETAILS,
  FLAG_ORDER_FILTER,
  FLAG_ORDER_PIN,
  FLAG_ORDER_SORT,
  FLAG_ORDER_PAYMENT,
  FLAG_ORDER_REFUND,
  FLAG_ORDER_CREATE,
  FLAG_ORDER_DUPLICATE,
  FLAG_ORDER_MODIFY,
  FLAG_PAYMENT_TRANSACTIONS,
  FLAG_PAYMENT_USER_INTERFACE,
  FLAG_PAYMENT_STORED_INTRUMENTS,
  FLAG_SHIPPING_STATUS,
  FLAG_SHIPPING_LABEL,
  FLAG_SEARCH_CUSTOMERS,
  FLAG_SEARCH_PRODUCTS,
  FLAG_TAX_CALCULATOR
]
