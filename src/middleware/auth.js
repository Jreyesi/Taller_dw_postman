const jwt = require('jsonwebtoken');
const env = require('../config/env');

function requireAuth(req, res, next) {
  const encabezado = req.headers.authorization || '';
  const partes = encabezado.split(' ');

  if (partes.length !== 2 || partes[0] !== 'Bearer' || !partes[1]) {
    return res.status(401).json({
      error: 'No autorizado',
      message: 'Debes enviar el encabezado Authorization: Bearer <token>.'
    });
  }

  try {
    const payload = jwt.verify(partes[1], env.jwtSecret, { algorithms: ['HS256'] });

    if (!payload.sub || !payload.usuario) {
      throw new Error('El token no contiene los datos requeridos');
    }

    req.user = { id: payload.sub, usuario: payload.usuario };
    return next();
  } catch (error) {
    const message = error.name === 'TokenExpiredError'
      ? 'El token ha expirado. Inicia sesion nuevamente.'
      : 'El token es invalido.';

    return res.status(401).json({
      error: 'No autorizado',
      message
    });
  }
}

module.exports = { requireAuth };
