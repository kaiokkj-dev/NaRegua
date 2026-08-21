const router = require('express').Router();
const controller = require('../controllers/public-booking.controller');
const { publicBookingRateLimit } = require('../middleware/rate-limit');
router.get('/shops/:slug', controller.shop);
router.post('/shops/:slug/bookings', publicBookingRateLimit, controller.create);
router.post('/shops/:slug/coupons/validate', publicBookingRateLimit, controller.coupon);
router.post('/shops/:slug/verification/request', publicBookingRateLimit, controller.requestVerification);
router.post('/shops/:slug/verification/confirm', publicBookingRateLimit, controller.confirmVerification);
module.exports = router;
