const subscriptions = require('../services/subscription.service');

async function overview(request, response, next) {
  try { return response.json(await subscriptions.getOverview(request.user.sub)); }
  catch (error) { return next(error); }
}

async function checkout(request, response, next) {
  try { return response.status(201).json(await subscriptions.createCheckout(request.user.sub, request.user.email, request.body.plan)); }
  catch (error) { return next(error); }
}

async function sync(request, response, next) {
  try { return response.json(await subscriptions.syncCheckout(request.user.sub, request.body.preapprovalId)); }
  catch (error) { return next(error); }
}

async function webhook(request, response, next) {
  try {
    await subscriptions.handleWebhook({
      type: request.query.type || request.body?.type,
      dataId: request.query['data.id'] || request.body?.data?.id,
      signature: request.get('x-signature'),
      requestId: request.get('x-request-id')
    });
    return response.status(200).json({ received: true });
  } catch (error) { return next(error); }
}

module.exports = { overview, checkout, sync, webhook };
