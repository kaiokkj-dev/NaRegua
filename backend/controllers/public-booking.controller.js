const booking = require('../services/public-booking.service');
const verification = require('../services/booking-verification.service');
async function shop(request, response, next) {
  try {
    response.set('Cache-Control', 'no-store, max-age=0');
    return response.json(await booking.getShop(request.params.slug));
  } catch (error) { return next(error); }
}
async function availability(request, response, next) {
  try {
    response.set('Cache-Control', 'no-store, max-age=0');
    return response.json(await booking.getAvailability(request.params.slug, request.query));
  } catch (error) { return next(error); }
}
async function create(request, response, next) { try { return response.status(201).json(await booking.createBooking(request.params.slug, request.body)); } catch (error) { return next(error); } }
async function coupon(request, response, next) { try { return response.json(await booking.validateCoupon(request.params.slug, request.body)); } catch (error) { return next(error); } }
async function requestVerification(request, response, next) { try { return response.json(await verification.requestCode(request.params.slug, request.body.phone)); } catch (error) { return next(error); } }
async function confirmVerification(request, response, next) { try { return response.json(await verification.confirmCode(request.params.slug, request.body.phone, request.body.code)); } catch (error) { return next(error); } }
module.exports = { shop, availability, create, coupon, requestVerification, confirmVerification };
