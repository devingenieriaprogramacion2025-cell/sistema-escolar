const ApiError = require('../utils/ApiError');

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'No tienes permisos para esta accion'));
    }
    next();
  };
};

const authorizePermissions = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Usuario no autenticado'));
    }

    if (req.user.permisos.includes('*')) {
      return next();
    }

    const hasPermission = requiredPermissions.some((permiso) => req.user.permisos.includes(permiso));

    if (!hasPermission) {
      return next(new ApiError(403, 'No tienes permisos para esta accion'));
    }

    return next();
  };
};

module.exports = {
  authorizeRoles,
  authorizePermissions
};





