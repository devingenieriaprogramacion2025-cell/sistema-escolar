const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const internalRequestsController = require('../controllers/internalRequests.controller');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware);

router.get('/', authorizeRoles(ROLES.DIRECTIVO), asyncHandler(internalRequestsController.listInternalRequests));
router.post('/', authorizeRoles(ROLES.ADMIN, ROLES.INSPECTORIA, ROLES.DOCENTE, ROLES.ENCARGADO, ROLES.DIRECTIVO), asyncHandler(internalRequestsController.createInternalRequest));
router.patch('/:id/review', authorizeRoles(ROLES.DIRECTIVO), asyncHandler(internalRequestsController.reviewInternalRequest));

module.exports = router;
