const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const dashboardController = require('../controllers/dashboard.controller');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.get('/', authMiddleware, authorizeRoles(ROLES.ADMIN, ROLES.DIRECTIVO, ROLES.INSPECTORIA, ROLES.DOCENTE, ROLES.ENCARGADO), asyncHandler(dashboardController.getDashboard));

module.exports = router;





