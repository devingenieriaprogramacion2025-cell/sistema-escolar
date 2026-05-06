const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const reservationsController = require('../controllers/reservations.controller');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware);

router.get('/', authorizeRoles(ROLES.ADMIN, ROLES.INSPECTORIA, ROLES.DOCENTE, ROLES.ENCARGADO), asyncHandler(reservationsController.listReservations));
router.post('/', authorizeRoles(ROLES.ADMIN, ROLES.INSPECTORIA, ROLES.DOCENTE), asyncHandler(reservationsController.createReservation));
router.patch('/:id/review', authorizeRoles(ROLES.ADMIN, ROLES.INSPECTORIA), asyncHandler(reservationsController.reviewReservation));
router.patch('/:id/cancel', authorizeRoles(ROLES.ADMIN, ROLES.INSPECTORIA, ROLES.DOCENTE), asyncHandler(reservationsController.cancelReservation));

module.exports = router;





