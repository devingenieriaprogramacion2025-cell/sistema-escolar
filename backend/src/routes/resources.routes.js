const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const resourcesController = require('../controllers/resources.controller');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware);

router.get('/', authorizeRoles(ROLES.ADMIN, ROLES.DIRECTIVO, ROLES.INSPECTORIA, ROLES.DOCENTE, ROLES.ENCARGADO), asyncHandler(resourcesController.listResources));
router.get('/categories', authorizeRoles(ROLES.ADMIN, ROLES.DIRECTIVO, ROLES.INSPECTORIA, ROLES.DOCENTE, ROLES.ENCARGADO), asyncHandler(resourcesController.listCategories));

router.post('/', authorizeRoles(ROLES.ADMIN, ROLES.INSPECTORIA, ROLES.ENCARGADO), asyncHandler(resourcesController.createResource));
router.put('/:id', authorizeRoles(ROLES.ADMIN, ROLES.INSPECTORIA, ROLES.ENCARGADO), asyncHandler(resourcesController.updateResource));
router.delete('/:id', authorizeRoles(ROLES.ADMIN, ROLES.INSPECTORIA, ROLES.ENCARGADO), asyncHandler(resourcesController.deleteResource));

router.post('/categories', authorizeRoles(ROLES.ADMIN, ROLES.INSPECTORIA), asyncHandler(resourcesController.createCategory));
router.put('/categories/:id', authorizeRoles(ROLES.ADMIN, ROLES.INSPECTORIA), asyncHandler(resourcesController.updateCategory));

module.exports = router;





