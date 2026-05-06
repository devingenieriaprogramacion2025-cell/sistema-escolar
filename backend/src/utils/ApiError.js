class ApiError extends Error {
  constructor(estadoCode, message, detalles = null) {
    super(message);
    this.estadoCode = estadoCode;
    this.detalles = detalles;
    this.isOperational = true;
  }
}

module.exports = ApiError;





