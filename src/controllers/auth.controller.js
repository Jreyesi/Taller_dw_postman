const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const env = require('../config/env');
const HttpError = require('../utils/http-error');
const { validarRegistro } = require('../utils/validators');

async function login(req, res, next) {
  try {
    const { usuario, password } = req.body || {};

    if (typeof usuario !== 'string' || usuario.trim() === '' ||
        typeof password !== 'string' || password === '') {
      throw new HttpError(400, 'Usuario y contrasena son obligatorios.');
    }

    const { rows } = await pool.query(
      'SELECT id, usuario, password_hash FROM usuarios WHERE usuario = $1',
      [usuario.trim().toLowerCase()]
    );

    const cuenta = rows[0];
    const coincide = cuenta
      ? await bcrypt.compare(password, cuenta.password_hash)
      : false;

    if (!cuenta || !coincide) {
      throw new HttpError(401, 'Credenciales invalidas.');
    }

    const token = jwt.sign(
      { usuario: cuenta.usuario },
      env.jwtSecret,
      {
        subject: String(cuenta.id),
        expiresIn: env.jwtExpiresIn,
        algorithm: 'HS256'
      }
    );

    return res.status(200).json({
      token,
      tokenType: 'Bearer',
      expiresIn: env.jwtExpiresIn,
      usuario: cuenta.usuario
    });
  } catch (error) {
    return next(error);
  }
}

async function registrar(req, res, next) {
  try {
    const { usuario, password } = validarRegistro(req.body);
    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO usuarios (usuario, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (usuario) DO NOTHING
       RETURNING id, usuario, creado_en`,
      [usuario, passwordHash]
    );

    if (!rows[0]) {
      throw new HttpError(409, 'El nombre de usuario ya esta registrado.');
    }

    return res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return next(new HttpError(409, 'El nombre de usuario ya esta registrado.'));
    }
    return next(error);
  }
}

module.exports = { login, registrar };
