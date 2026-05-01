const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const loansController = require('../controllers/loans.controller');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware);

router.get('/', authorizeRoles(ROLES.ADMIN, ROLES.DIRECTIVO, ROLES.INSPECTORIA, ROLES.DOCENTE, ROLES.ENCARGADO), asyncHandler(loansController.listLoans));
router.post('/', authorizeRoles(ROLES.ENCARGADO), asyncHandler(loansController.createLoan));
router.patch('/:id', authorizeRoles(ROLES.ENCARGADO), asyncHandler(loansController.updateLoan));
router.patch('/:id/deactivate', authorizeRoles(ROLES.ENCARGADO), asyncHandler(loansController.deactivateLoan));
router.patch('/:id/return', authorizeRoles(ROLES.ADMIN, ROLES.INSPECTORIA), asyncHandler(loansController.returnLoan));

module.exports = router;
