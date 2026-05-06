const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const usersController = require('../controllers/users.controller');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.get('/me', authMiddleware, asyncHandler(usersController.getMyProfile));
router.get(
  '/operational',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.INSPECTORIA, ROLES.ENCARGADO),
  asyncHandler(usersController.listOperationalUsers)
);

router.use(authMiddleware, authorizeRoles(ROLES.ADMIN));

router.get('/', asyncHandler(usersController.listUsers));
router.get('/roles', asyncHandler(usersController.listRoles));
router.post('/', asyncHandler(usersController.createUser));
router.put('/:id', asyncHandler(usersController.updateUser));
router.patch('/:id/estado', asyncHandler(usersController.updateUserStatus));

module.exports = router;





