const router = require('express').Router();
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const scheduleRoutes = require('./schedule.routes');
const publicBookingRoutes = require('./public-booking.routes');
const subscriptionRoutes = require('./subscription.routes');

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/schedule', scheduleRoutes);
router.use('/public', publicBookingRoutes);
router.use('/subscription', subscriptionRoutes);

module.exports = router;
