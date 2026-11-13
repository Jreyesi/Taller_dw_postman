const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const pool = require('../src/config/db');

let fallos = 0;

function verificar(condicion, nombre) {
  if (condicion) {
    console.log(`PASS | ${nombre}`);
  } else {
    fallos += 1;
    console.log(`FAIL | ${nombre}`);
  }
}

async function peticion(baseUrl, ruta, opciones = {}) {
  const encabezados = {};

  if (opciones.body !== undefined) {
    encabezados['Content-Type'] = 'application/json';
  }

  if (opciones.authorization) {
    encabezados.Authorization = opciones.authorization;
  } else if (opciones.token) {
    encabezados.Authorization = `Bearer ${opciones.token}`;
  }

  const respuesta = await fetch(`${baseUrl}${ruta}`, {
    method: opciones.method || 'GET',
    headers: encabezados,
    body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body)
  });

  const texto = await respuesta.text();
  let datos = null;

  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }

  return { estado: respuesta.status, datos };
}

async function main() {
  const servidor = app.listen(0);
  await new Promise((resolve) => servidor.once('listening', resolve));

  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;
  let idCreado = null;
  let usuarioRegistrado = null;

  console.log(`Servidor de pruebas: ${baseUrl}`);
  console.log('');

  try {
    const loginIncorrecto = await peticion(baseUrl, '/auth/login', {
      method: 'POST',
      body: { usuario: env.appUser, password: 'contrasena-incorrecta' }
    });
    verificar(loginIncorrecto.estado === 401, 'Login con credenciales incorrectas responde 401');
    verificar(!loginIncorrecto.datos.token, 'Login fallido no devuelve token');

    const loginSinDatos = await peticion(baseUrl, '/auth/login', {
      method: 'POST',
      body: {}
    });
    verificar(loginSinDatos.estado === 400, 'Login sin usuario ni contrasena responde 400');

    const usuarioNuevo = `registro_${Date.now()}`;

    const registroInvalido = await peticion(baseUrl, '/auth/register', {
      method: 'POST',
      body: { usuario: usuarioNuevo, password: '123' }
    });
    verificar(registroInvalido.estado === 400, 'Registro con contrasena corta responde 400');

    const registro = await peticion(baseUrl, '/auth/register', {
      method: 'POST',
      body: { usuario: usuarioNuevo.toUpperCase(), password: 'ClaveSegura123' }
    });
    verificar(registro.estado === 201, 'Registro valido responde 201');
    verificar(registro.datos.usuario === usuarioNuevo, 'El registro normaliza el usuario a minusculas');
    verificar(!('password_hash' in registro.datos), 'El registro no devuelve el hash de la contrasena');
    usuarioRegistrado = usuarioNuevo;

    const registroDuplicado = await peticion(baseUrl, '/auth/register', {
      method: 'POST',
      body: { usuario: usuarioNuevo, password: 'ClaveSegura123' }
    });
    verificar(registroDuplicado.estado === 409, 'Registro con usuario duplicado responde 409');

    const loginRegistrado = await peticion(baseUrl, '/auth/login', {
      method: 'POST',
      body: { usuario: usuarioNuevo, password: 'ClaveSegura123' }
    });
    verificar(loginRegistrado.estado === 200, 'El usuario registrado puede iniciar sesion');
    verificar(typeof loginRegistrado.datos.token === 'string', 'El usuario registrado recibe un JWT');

    const login = await peticion(baseUrl, '/auth/login', {
      method: 'POST',
      body: { usuario: env.appUser, password: env.appPassword }
    });
    verificar(login.estado === 200, 'Login valido responde 200');
    verificar(typeof login.datos.token === 'string' && login.datos.token.length > 20, 'Login valido devuelve un JWT');
    const token = login.datos.token;

    const tokenExpirado = jwt.sign(
      { usuario: env.appUser },
      env.jwtSecret,
      { subject: '1', expiresIn: '-1s', algorithm: 'HS256' }
    );

    const tokenFirmaInvalida = jwt.sign(
      { usuario: env.appUser },
      'secreto-distinto-para-probar-firma-invalida-123456',
      { subject: '1', expiresIn: '1h', algorithm: 'HS256' }
    );

    const cuerpoNoAutorizado = { titulo: 'Intento no autorizado', autor: 'Nadie', anio: 2020 };
    const casosProtegidos = [
      { metodo: 'GET', ruta: '/libros' },
      { metodo: 'POST', ruta: '/libros', body: cuerpoNoAutorizado },
      { metodo: 'GET', ruta: '/libros/999999' },
      { metodo: 'PUT', ruta: '/libros/999999', body: cuerpoNoAutorizado },
      { metodo: 'DELETE', ruta: '/libros/999999' }
    ];

    const { rows: conteoAntes } = await pool.query('SELECT COUNT(*)::int AS total FROM libros');

    for (const caso of casosProtegidos) {
      const etiqueta = `${caso.metodo} ${caso.ruta}`;

      const sinToken = await peticion(baseUrl, caso.ruta, {
        method: caso.metodo,
        body: caso.body
      });
      verificar(sinToken.estado === 401, `${etiqueta} sin token responde 401`);

      const tokenMalformado = await peticion(baseUrl, caso.ruta, {
        method: caso.metodo,
        authorization: 'Bearer token.invalido',
        body: caso.body
      });
      verificar(tokenMalformado.estado === 401, `${etiqueta} con token malformado responde 401`);

      const conTokenExpirado = await peticion(baseUrl, caso.ruta, {
        method: caso.metodo,
        token: tokenExpirado,
        body: caso.body
      });
      verificar(conTokenExpirado.estado === 401, `${etiqueta} con token expirado responde 401`);
    }

    const { rows: conteoDespues } = await pool.query('SELECT COUNT(*)::int AS total FROM libros');
    verificar(conteoAntes[0].total === conteoDespues[0].total, 'Las peticiones rechazadas no modificaron la base de datos');

    const conFirmaInvalida = await peticion(baseUrl, '/libros', {
      method: 'POST',
      token: tokenFirmaInvalida,
      body: { titulo: 'Firma invalida', autor: 'Nadie', anio: 2020 }
    });
    verificar(conFirmaInvalida.estado === 401, 'POST /libros con firma invalida responde 401');

    const sinCampoObligatorio = await peticion(baseUrl, '/libros', {
      method: 'POST',
      token,
      body: { autor: 'Autor sin titulo', anio: 2020 }
    });
    verificar(sinCampoObligatorio.estado === 400, 'POST /libros sin titulo responde 400');
    verificar(Array.isArray(sinCampoObligatorio.datos.details), 'La validacion devuelve detalle de campos');

    const anioInvalido = await peticion(baseUrl, '/libros', {
      method: 'POST',
      token,
      body: { titulo: 'Anio booleano', autor: 'Prueba', anio: true }
    });
    verificar(anioInvalido.estado === 400, 'POST /libros con anio no numerico responde 400');

    const creacion = await peticion(baseUrl, '/libros', {
      method: 'POST',
      token,
      body: { titulo: 'Cien anos de soledad', autor: 'Gabriel Garcia Marquez', anio: 1967 }
    });
    verificar(creacion.estado === 201, 'POST /libros valido responde 201');
    verificar(Number.isInteger(creacion.datos.id), 'La creacion devuelve el identificador');
    verificar(creacion.datos.titulo === 'Cien anos de soledad', 'La creacion devuelve los datos guardados');
    idCreado = creacion.datos.id;

    const listado = await peticion(baseUrl, '/libros', { token });
    verificar(listado.estado === 200, 'GET /libros responde 200');
    verificar(Array.isArray(listado.datos), 'GET /libros devuelve un arreglo');
    verificar(listado.datos.some((libro) => libro.id === idCreado), 'La lista contiene el libro creado');

    const consulta = await peticion(baseUrl, `/libros/${idCreado}`, { token });
    verificar(consulta.estado === 200, 'GET /libros/:id responde 200');
    verificar(consulta.datos.id === idCreado, 'GET /libros/:id devuelve el registro correcto');

    const actualizacion = await peticion(baseUrl, `/libros/${idCreado}`, {
      method: 'PUT',
      token,
      body: { titulo: 'Cien anos de soledad (edicion conmemorativa)', anio: 1968 }
    });
    verificar(actualizacion.estado === 200, 'PUT /libros/:id responde 200');
    verificar(actualizacion.datos.titulo === 'Cien anos de soledad (edicion conmemorativa)', 'La respuesta refleja el titulo actualizado');
    verificar(actualizacion.datos.anio === 1968, 'La respuesta refleja el anio actualizado');
    verificar(actualizacion.datos.autor === 'Gabriel Garcia Marquez', 'La actualizacion conserva los campos no enviados');

    const { rows: filaActualizada } = await pool.query(
      'SELECT titulo, autor, anio FROM libros WHERE id = $1',
      [idCreado]
    );
    verificar(filaActualizada.length === 1, 'El registro actualizado existe directamente en PostgreSQL');
    verificar(filaActualizada[0].titulo === 'Cien anos de soledad (edicion conmemorativa)', 'PostgreSQL contiene el titulo actualizado');
    verificar(filaActualizada[0].anio === 1968, 'PostgreSQL contiene el anio actualizado');

    const actualizacionVacia = await peticion(baseUrl, `/libros/${idCreado}`, {
      method: 'PUT',
      token,
      body: {}
    });
    verificar(actualizacionVacia.estado === 400, 'PUT /libros/:id sin campos editables responde 400');

    const idInexistente = 999999;
    const consultaInexistente = await peticion(baseUrl, `/libros/${idInexistente}`, { token });
    verificar(consultaInexistente.estado === 404, 'GET /libros/:id inexistente responde 404');

    const idInvalido = await peticion(baseUrl, '/libros/abc', { token });
    verificar(idInvalido.estado === 400, 'GET /libros/:id con id invalido responde 400');

    const idDecimal = await peticion(baseUrl, '/libros/1.5', { token });
    verificar(idDecimal.estado === 400, 'GET /libros/:id con id decimal responde 400');

    const eliminacion = await peticion(baseUrl, `/libros/${idCreado}`, {
      method: 'DELETE',
      token
    });
    verificar(eliminacion.estado === 200, 'DELETE /libros/:id responde 200');
    verificar(eliminacion.datos.libro.id === idCreado, 'La eliminacion devuelve el registro eliminado');
    idCreado = null;

    const consultaEliminada = await peticion(baseUrl, `/libros/${eliminacion.datos.libro.id}`, { token });
    verificar(consultaEliminada.estado === 404, 'GET /libros/:id despues de eliminar responde 404');

    const { rows: filaEliminada } = await pool.query(
      'SELECT id FROM libros WHERE id = $1',
      [eliminacion.datos.libro.id]
    );
    verificar(filaEliminada.length === 0, 'El registro ya no existe directamente en PostgreSQL');

    const listadoFinal = await peticion(baseUrl, '/libros', { token });
    verificar(!listadoFinal.datos.some((libro) => libro.id === eliminacion.datos.libro.id), 'La lista ya no contiene el libro eliminado');
  } finally {
    if (idCreado !== null) {
      await pool.query('DELETE FROM libros WHERE id = $1', [idCreado]).catch(() => {});
    }

    if (usuarioRegistrado !== null) {
      await pool.query('DELETE FROM usuarios WHERE usuario = $1', [usuarioRegistrado]).catch(() => {});
    }

    await new Promise((resolve) => servidor.close(resolve));
    await pool.end();
  }

  console.log('');
  if (fallos === 0) {
    console.log('RESULTADO: todas las pruebas pasaron.');
  } else {
    console.log(`RESULTADO: ${fallos} prueba(s) fallaron.`);
    process.exitCode = 1;
    assert.fail('Hay pruebas fallidas');
  }
}

main().catch((error) => {
  console.error('Error ejecutando las pruebas:', error.message);
  process.exitCode = 1;
});
