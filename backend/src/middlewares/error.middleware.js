const ApiError = require('../utils/ApiError');

const notFoundMiddleware = (req, res, next) => {
  next(new ApiError(404, `Ruta no encontrada: ${req.originalUrl}`));
};

const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';
  let details = err.details || null;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Error de validacion';
    details = Object.values(err.errors).map((item) => item.message);
  }

  if (err.code === 11000) {
    statusCode = 409;
    const duplicatedField = Object.keys(err.keyValue || {})[0] || 'campo unico';
    message = `Valor duplicado en ${duplicatedField}`;
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Identificador invalido: ${err.value}`;
  }

  res.status(statusCode).json({
    success: false,
    message,
    details
  });
};

module.exports = {
  notFoundMiddleware,
  errorMiddleware
};
