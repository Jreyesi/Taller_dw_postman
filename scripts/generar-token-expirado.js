const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

const token = jwt.sign(
  { usuario: env.appUser },
  env.jwtSecret,
  { subject: '1', expiresIn: '-1s', algorithm: 'HS256' }
);

console.log(token);
