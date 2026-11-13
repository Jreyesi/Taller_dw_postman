function notFound(req, res) {
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `No existe la ruta ${req.method} ${req.originalUrl}.`
  });
}

function errorHandler(error, req, res, next) {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Solicitud invalida',
      message: 'El cuerpo de la peticion no contiene un JSON valido.'
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Solicitud demasiado grande',
      message: 'El cuerpo de la peticion supera el limite permitido.'
    });
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  const etiquetas = {
    400: 'Solicitud invalida',
    401: 'No autorizado',
    404: 'No encontrado',
    409: 'Conflicto'
  };

  if (status >= 500) {
    console.error('Error interno:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Ocurrio un error inesperado. Intenta nuevamente.'
    });
  }

  const respuesta = {
    error: etiquetas[status] || 'Error',
    message: error.message
  };

  if (error.details) {
    respuesta.details = error.details;
  }

  return res.status(status).json(respuesta);
}

module.exports = { notFound, errorHandler };
