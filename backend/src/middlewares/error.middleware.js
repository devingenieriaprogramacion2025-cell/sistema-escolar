const ApiError = require('../utils/ApiError');

const notFoundMiddleware = (req, res, next) => {
  next(new ApiError(404, `Ruta no encontrada: ${req.originalUrl}`));
};

const errorMiddleware = (err, req, res, next) => {
  let estadoCode = err.estadoCode || 500;
  let message = err.message || 'Error interno del servidor';
  let detalles = err.detalles || null;

  if (err.nombre === 'ValidationError') {
    estadoCode = 400;
    message = 'Error de validacion';
    detalles = Object.values(err.errors).map((item) => item.message);
  }

  if (err.codigo === 11000) {
    estadoCode = 409;
    const duplicatedField = Object.keys(err.keyValue || {})[0] || 'campo unico';
    message = `Valor duplicado en ${duplicatedField}`;
  }

  if (err.nombre === 'CastError') {
    estadoCode = 400;
    message = `Identificador invalido: ${err.value}`;
  }

  res.status(estadoCode).json({
    success: false,
    message,
    detalles
  });
};

module.exports = {
  notFoundMiddleware,
  errorMiddleware
};





