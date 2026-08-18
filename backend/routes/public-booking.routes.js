const router = require('express').Router();
const controller = require('../controllers/public-booking.controller');
const { publicBookingRateLimit } = require('../middleware/rate-limit');
router.get('/shops/:slug', controller.shop);
router.post('/shops/:slug/bookings', publicBookingRateLimit, controller.create);
router.post('/shops/:slug/coupons/validate', publicBookingRateLimit, controller.coupon);
module.exports = router;
