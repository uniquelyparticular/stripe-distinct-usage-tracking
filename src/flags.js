// TODO!!!!: this is duplicated in zendesk-commerce-plugins, move to shared project
/** ROLE FLAGS **/
const ROLE_ADMIN = 'admin'
const ROLE_AGENT = 'agent'

/** ORDER FLAGS (Commerce Provider) **/
const FLAG_ORDERS_LIST = 'orders_list' // FREE
const FLAG_ORDER_DETAILS = 'order_details' // FREE

const FLAG_ORDER_FILTER = 'order_filter' // STARTER
const FLAG_ORDER_PIN = 'order_pin' // STARTER
const FLAG_ORDER_SORT = 'order_sort' // STARTER

const FLAG_ORDER_TIMELINE = 'order_timeline' // PROFESIONAL

const FLAG_ORDER_PAYMENT = 'order_payment' // ENTERPRISE
const FLAG_ORDER_REFUND = 'order_refund' // ENTERPRISE
const FLAG_ORDER_CREATE = 'order_create' // ENTERPRISE
const FLAG_ORDER_DUPLICATE = 'order_duplicate' // ENTERPRISE
const FLAG_ORDER_MODIFY = 'order_modify' // ENTERPRISE

/** PAYMENT FLAGS (Payment or Commerce Provider) **/
const FLAG_PAYMENT_TRANSACTIONS = 'payment_transactions' // PROFESSIONAL
const FLAG_PAYMENT_USER_INTERFACE = 'payment_user_interface' // TODO: implement
const FLAG_PAYMENT_STORED_INTRUMENTS = 'payment_stored_instruments' // TODO: implement

/** SHIPPING FLAGS (Shipping Provider) **/
const FLAG_SHIPPING_STATUS = 'shipping_status' // PROFESSIONAL
const FLAG_SHIPPING_LABEL = 'shipping_label' // ENTERPRISE TODO: implement

/** SEARCH FLAGS (Search or Commerce Provider?) **/
const FLAG_SEARCH_CUSTOMERS = 'search_customers' // STARTER
const FLAG_SEARCH_PRODUCTS = 'search_products' // ENTERPRISE TODO: implement

/** TAX FLAGS (Tax Provider?) **/
const FLAG_TAX_CALCULATOR = 'tax_calculator' // ENTERPRISE TODO: implement

module.exports = [
  ROLE_ADMIN,
  ROLE_AGENT,
  FLAG_ORDERS_LIST,
  FLAG_ORDER_DETAILS,
  FLAG_ORDER_FILTER,
  FLAG_ORDER_PIN,
  FLAG_ORDER_SORT,
  FLAG_ORDER_TIMELINE,
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
