const app = require('./app');
const env = require('./config/env');
const pool = require('./config/db');

const server = app.listen(env.port, () => {
  console.log(`API escuchando en http://localhost:${env.port}`);
});

async function cerrar(signal) {
  console.log(`${signal}: cerrando servidor...`);

  server.close(async () => {
    try {
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error('Error al cerrar PostgreSQL:', error.message);
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => cerrar('SIGINT'));
process.on('SIGTERM', () => cerrar('SIGTERM'));
