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
      name: user.name
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

const login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ApiError(400, 'Correo y password son requeridos'));
  }

  const user = await one(
    `
    SELECT
      u.id,
      u.name,
      u.email,
      u.password,
      u.area,
      u.status,
      r.name AS role
    FROM dbo.users u
    INNER JOIN dbo.roles r ON r.id = u.role_id
    WHERE u.email = @email;
    `,
    { email: email.toLowerCase().trim() }
  );

  if (!user) {
    return next(new ApiError(401, 'Credenciales invalidas'));
  }

  if (user.status !== 'ACTIVE') {
    return next(new ApiError(403, 'Cuenta desactivada'));
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return next(new ApiError(401, 'Credenciales invalidas'));
  }

  const token = signToken(user);

  await audit({
    req: { user: { id: String(user.id), email: user.email, role: user.role } },
    action: 'INICIO_SESION',
    module: 'AUTENTICACION',
    entityId: String(user.id),
    details: { message: 'Usuario autenticado' }
  });

  res.json({
    success: true,
    token,
    user: {
      id: String(user.id),
      _id: String(user.id),
      name: user.name,
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

