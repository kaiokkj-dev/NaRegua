const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const controller = require('../controllers/subscription.controller');

router.post('/webhook', controller.webhook);
router.use(authenticate);
router.get('/', controller.overview);
router.post('/checkout', controller.checkout);
router.post('/sync', controller.sync);

module.exports = router;
