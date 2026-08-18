const booking = require('../services/public-booking.service');
async function shop(request, response, next) { try { return response.json(await booking.getShop(request.params.slug)); } catch (error) { return next(error); } }
async function create(request, response, next) { try { return response.status(201).json(await booking.createBooking(request.params.slug, request.body)); } catch (error) { return next(error); } }
async function coupon(request, response, next) { try { return response.json(await booking.validateCoupon(request.params.slug, request.body)); } catch (error) { return next(error); } }
module.exports = { shop, create, coupon };
