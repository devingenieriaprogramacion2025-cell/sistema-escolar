const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const { one } = require('../services/sql.service');
const { audit } = require('../services/audit.service');

const signToken = (user) =>
  jwt.sign(
    {
      id: String(user.id),
      email: user.email,
      role: user.role,
      name: user.nombre,
      nombre: user.nombre
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

const login = async (req, res, next) => {
  const { email, contrasena, password } = req.body;
  const plainPassword = contrasena ?? password;

  if (!email || !plainPassword) {
    return next(new ApiError(400, 'Correo y contrasena son requeridos'));
  }

  const user = await one(
    `
    SELECT
      u.id,
      u.nombre,
      u.email,
      u.contrasena,
      u.area,
      u.estado,
      r.nombre AS role
    FROM dbo.usuarios u
    INNER JOIN dbo.roles r ON r.id = u.rol_id
    WHERE u.email = @email;
    `,
    { email: email.toLowerCase().trim() }
  );

  if (!user) {
    return next(new ApiError(401, 'Credenciales invalidas'));
  }

  if (user.estado !== 'ACTIVE') {
    return next(new ApiError(403, 'Cuenta desactivada'));
  }

  const isPasswordValid = await bcrypt.compare(plainPassword, user.contrasena);
  if (!isPasswordValid) {
    return next(new ApiError(401, 'Credenciales invalidas'));
  }

  const token = signToken(user);

  await audit({
    req: { user: { id: String(user.id), email: user.email, role: user.role } },
    accion: 'INICIO_SESION',
    modulo: 'AUTENTICACION',
    entityId: String(user.id),
    detalles: { message: 'Usuario autenticado' }
  });

  res.json({
    success: true,
    token,
    user: {
      id: String(user.id),
      _id: String(user.id),
      name: user.nombre,
      nombre: user.nombre,
      email: user.email,
      role: user.role,
      area: user.area
    }
  });
};

const me = async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
};

module.exports = {
  login,
  me
};






