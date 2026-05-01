const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/login', asyncHandler(authController.login));
router.get('/me', authMiddleware, asyncHandler(authController.me));

module.exports = router;
