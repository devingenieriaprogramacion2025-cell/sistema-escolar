const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { getRolePermissions } = require('../constants/roles');
const { one } = require('../services/sql.service');

const extractToken = (authorizationHeader = '') => {
  if (!authorizationHeader.startsWith('Bearer ')) return null;
  return authorizationHeader.replace('Bearer ', '').trim();
};

const authMiddleware = async (req, res, next) => {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    return next(new ApiError(401, 'Token requerido'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await one(
      `
      SELECT
        u.id,
        u.nombre,
        u.email,
        u.area,
        u.estado,
        r.nombre AS role
      FROM dbo.usuarios u
      INNER JOIN dbo.roles r ON r.id = u.rol_id
      WHERE u.id = @id;
      `,
      { id: Number(payload.id) }
    );

    if (!user) {
      return next(new ApiError(401, 'Usuario no valido'));
    }

    if (user.estado !== 'ACTIVE') {
      return next(new ApiError(403, 'Cuenta desactivada'));
    }

    req.user = {
      id: String(user.id),
      _id: String(user.id),
      nombre: user.nombre,
      email: user.email,
      role: user.role,
      area: user.area,
      permissions: getRolePermissions(user.role)
    };

    next();
  } catch (error) {
    return next(new ApiError(401, 'Token invalido o expirado'));
  }
};

module.exports = authMiddleware;





