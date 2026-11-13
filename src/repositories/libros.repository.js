const pool = require('../config/db');

const COLUMNAS = 'id, titulo, autor, anio, creado_en, actualizado_en';

async function listar() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} FROM libros ORDER BY id ASC`
  );
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} FROM libros WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function crear(datos) {
  const { rows } = await pool.query(
    `INSERT INTO libros (titulo, autor, anio)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNAS}`,
    [datos.titulo, datos.autor, datos.anio]
  );
  return rows[0];
}

async function actualizar(id, datos) {
  const asignaciones = [];
  const valores = [];
  let indice = 1;

  for (const [campo, valor] of Object.entries(datos)) {
    asignaciones.push(`${campo} = $${indice}`);
    valores.push(valor);
    indice += 1;
  }

  valores.push(id);

  const { rows } = await pool.query(
    `UPDATE libros
     SET ${asignaciones.join(', ')}, actualizado_en = NOW()
     WHERE id = $${indice}
     RETURNING ${COLUMNAS}`,
    valores
  );

  return rows[0] || null;
}

async function eliminar(id) {
  const { rows } = await pool.query(
    `DELETE FROM libros WHERE id = $1 RETURNING ${COLUMNAS}`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { listar, buscarPorId, crear, actualizar, eliminar };
