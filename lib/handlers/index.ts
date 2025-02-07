import { CheckOrderStatusHandler } from './check-order-status/handler'
import { CheckOrderStatusInjector } from './check-order-status/injector'
import { GetDocsHandler } from './get-docs/GetDocsHandler'
import { GetDocsInjector } from './get-docs/GetDocsInjector'
import { GetDocsUIHandler } from './get-docs/GetDocsUIHandler'
import { GetDocsUIInjector } from './get-docs/GetDocsUIInjector'
import { GetLimitOrdersInjector } from './get-limit-orders/injector'
import { GetNonceHandler } from './get-nonce/handler'
import { GetNonceInjector } from './get-nonce/injector'
import { GetOrdersHandler } from './get-orders/handler'
import { GetOrdersInjector } from './get-orders/injector'
import { OrderNotificationHandler } from './order-notification/handler'
import { OrderNotificationInjector } from './order-notification/injector'
import { PostLimitOrderInjector } from './post-limit-order/injector'
import { PostOrderHandler } from './post-order/handler'
import { PostOrderInjector } from './post-order/injector'

const getNonceInjectorPromise = new GetNonceInjector('getNonceInjector').build()
const getNonceHandler = new GetNonceHandler('getNonceHandler', getNonceInjectorPromise)

const getOrdersInjectorPromise = new GetOrdersInjector('getOrdersInjector').build()
const getOrdersHandler = new GetOrdersHandler('getOrdersHandler', getOrdersInjectorPromise)

const getLimitOrdersInjectorPromise = new GetLimitOrdersInjector('getLimitOrdersInjector').build()
const getLimitOrdersHandler = new GetOrdersHandler('getLimitOrdersHandler', getLimitOrdersInjectorPromise)

const postOrderInjectorPromise = new PostOrderInjector('postOrderInjector').build()
const postOrderHandler = new PostOrderHandler('postOrdersHandler', postOrderInjectorPromise)

const postLimitOrderInjectorPromise = new PostLimitOrderInjector('postLimitOrderInjector').build()
const postLimitOrderHandler = new PostOrderHandler('postLimitOrdersHandler', postLimitOrderInjectorPromise)

const checkOrderStatusInjectorPromise = new CheckOrderStatusInjector('checkOrderStatusInjector').build()
const checkOrderStatusHandler = new CheckOrderStatusHandler('checkOrderStatusHandler', checkOrderStatusInjectorPromise)

const getDocsInjectorPromise = new GetDocsInjector('getDocsInjector').build()
const getDocsHandler = new GetDocsHandler('get-docs', getDocsInjectorPromise)

const getDocsUIInjectorPromise = new GetDocsUIInjector('getDocsUIInjector').build()
const getDocsUIHandler = new GetDocsUIHandler('get-docs', getDocsUIInjectorPromise)

const orderNotificationInjectorPromise = new OrderNotificationInjector('orderNotificationInjector').build()
const orderNotificationHandler = new OrderNotificationHandler(
  'orderNotificationHandler',
  orderNotificationInjectorPromise
)

module.exports = {
  getOrdersHandler: getOrdersHandler.handler,
  postOrderHandler: postOrderHandler.handler,
  getNonceHandler: getNonceHandler.handler,
  checkOrderStatusHandler: checkOrderStatusHandler.handler,
  getDocsHandler: getDocsHandler.handler,
  getDocsUIHandler: getDocsUIHandler.handler,
  orderNotificationHandler: orderNotificationHandler.handler,
  postLimitOrderHandler: postLimitOrderHandler.handler,
  getLimitOrdersHandler: getLimitOrdersHandler.handler,
}
