const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');

function obtenerNombreBaseDeDatos(databaseUrl) {
  const url = new URL(databaseUrl);
  const nombre = decodeURIComponent(url.pathname.replace(/^\//, ''));

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nombre)) {
    throw new Error(`Nombre de base de datos invalido: ${nombre}`);
  }

  return { nombre, url };
}

async function main() {
  if (!env.appPassword) {
    throw new Error('Debes definir APP_PASSWORD en el archivo .env para crear el usuario de prueba.');
  }

  const { nombre, url } = obtenerNombreBaseDeDatos(env.databaseUrl);

  const urlAdmin = new URL(url.toString());
  urlAdmin.pathname = '/postgres';

  const admin = new Client({ connectionString: urlAdmin.toString() });
  await admin.connect();

  const { rowCount } = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [nombre]
  );

  if (rowCount === 0) {
    await admin.query(`CREATE DATABASE "${nombre}"`);
    console.log(`Base de datos "${nombre}" creada.`);
  } else {
    console.log(`Base de datos "${nombre}" ya existe.`);
  }

  await admin.end();

  const cliente = new Client({ connectionString: env.databaseUrl });
  await cliente.connect();

  const esquema = fs.readFileSync(
    path.resolve(__dirname, '../sql/schema.sql'),
    'utf8'
  );
  await cliente.query(esquema);

  const hash = await bcrypt.hash(env.appPassword, 12);
  const usuarioPrueba = env.appUser.trim().toLowerCase();

  const { rows } = await cliente.query(
    `INSERT INTO usuarios (usuario, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (usuario)
     DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, usuario`,
    [usuarioPrueba, hash]
  );

  console.log('Esquema aplicado: tablas usuarios y libros disponibles.');
  console.log(`Usuario de prueba listo: ${rows[0].usuario} (id ${rows[0].id}).`);
  console.log('La contrasena quedo almacenada unicamente como hash bcrypt.');

  await cliente.end();
}

main().catch((error) => {
  console.error('Error inicializando la base de datos:', error.message);
  process.exitCode = 1;
});
