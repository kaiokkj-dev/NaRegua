const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const controller = require('../controllers/schedule.controller');

router.use(authenticate);
router.get('/dashboard', controller.dashboard);
router.post('/appointments', controller.create);
router.patch('/appointments/:id/status', controller.updateStatus);
router.get('/clients', controller.clients);
router.post('/clients', controller.createClient);
router.get('/services', controller.services);
router.post('/services', controller.createService);
router.patch('/services/:id', controller.updateService);
router.get('/professionals', controller.professionals);
router.post('/professionals', controller.createProfessional);
router.patch('/professionals/:id', controller.updateProfessional);
router.get('/reservations', controller.reservations);
router.get('/coupons', controller.coupons);
router.post('/coupons', controller.createCoupon);
router.patch('/coupons/:id', controller.updateCoupon);
router.delete('/coupons/:id', controller.deleteCoupon);
router.get('/settings/payment', controller.paymentSettings);
router.patch('/settings/payment', controller.updatePaymentSettings);
router.get('/settings/hours', controller.hoursSettings);
router.patch('/settings/hours', controller.updateHoursSettings);

module.exports = router;
