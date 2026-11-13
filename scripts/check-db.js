const pool = require('../src/config/db');

async function main() {
  const { rows: conexion } = await pool.query(
    `SELECT current_database() AS base,
            current_user AS usuario,
            inet_server_addr() AS servidor,
            inet_server_port() AS puerto`
  );

  console.log('Conexion PostgreSQL:', conexion[0]);

  const { rows: tablas } = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name`
  );

  console.log('Tablas:', tablas.map((tabla) => tabla.table_name).join(', '));

  const { rows: conteo } = await pool.query(
    'SELECT COUNT(*)::int AS total FROM libros'
  );

  console.log('Total de libros:', conteo[0].total);

  const { rows: libros } = await pool.query(
    `SELECT id, titulo, autor, anio, creado_en, actualizado_en
     FROM libros
     ORDER BY id`
  );

  console.log('Contenido de la tabla libros:');
  console.table(libros);

  const { rows: usuarios } = await pool.query(
    'SELECT id, usuario, LEFT(password_hash, 20) || \'...\' AS hash_parcial FROM usuarios ORDER BY id'
  );

  console.log('Usuarios (sin contrasena en texto plano):');
  console.table(usuarios);

  await pool.end();
}

main().catch(async (error) => {
  console.error('Error consultando la base de datos:', error.message);
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
