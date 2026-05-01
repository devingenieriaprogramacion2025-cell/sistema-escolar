const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const printRequestsController = require('../controllers/printRequests.controller');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware);

router.get('/', authorizeRoles(ROLES.ADMIN, ROLES.DIRECTIVO, ROLES.INSPECTORIA, ROLES.DOCENTE, ROLES.ENCARGADO), asyncHandler(printRequestsController.listPrintRequests));
router.post('/', authorizeRoles(ROLES.ADMIN, ROLES.DIRECTIVO, ROLES.INSPECTORIA, ROLES.DOCENTE, ROLES.ENCARGADO), asyncHandler(printRequestsController.createPrintRequest));
router.patch('/:id/review', authorizeRoles(ROLES.ENCARGADO), asyncHandler(printRequestsController.reviewPrintRequest));

module.exports = router;
