const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const auditLogsController = require('../controllers/auditLogs.controller');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.get('/', authMiddleware, authorizeRoles(ROLES.ADMIN), asyncHandler(auditLogsController.listAuditLogs));

module.exports = router;
