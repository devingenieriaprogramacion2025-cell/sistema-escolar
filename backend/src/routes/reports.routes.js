const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const reportsController = require('../controllers/reports.controller');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware);

router.get('/summary', authorizeRoles(ROLES.ADMIN, ROLES.DIRECTIVO, ROLES.INSPECTORIA, ROLES.DOCENTE, ROLES.ENCARGADO), asyncHandler(reportsController.getSummaryReport));
router.get('/export', authorizeRoles(ROLES.ADMIN, ROLES.DIRECTIVO, ROLES.INSPECTORIA), asyncHandler(reportsController.exportSummaryPdf));

module.exports = router;





