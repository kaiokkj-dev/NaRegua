const router = require('express').Router();
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

module.exports = router;
