const HttpError = require('./http-error');

const CAMPOS = ['titulo', 'autor', 'anio'];

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function validarLibro(body, opciones = {}) {
  const parcial = opciones.parcial === true;

  if (!esObjeto(body)) {
    throw new HttpError(400, 'El cuerpo de la peticion debe ser un objeto JSON.', [
      'Envia Content-Type: application/json y un objeto JSON valido.'
    ]);
  }

  const errores = [];
  const datos = {};
  const tiene = (campo) => Object.prototype.hasOwnProperty.call(body, campo);

  if (parcial && !CAMPOS.some(tiene)) {
    errores.push('Debes enviar al menos uno de los campos: titulo, autor o anio.');
  }

  if (!parcial || tiene('titulo')) {
    if (typeof body.titulo !== 'string' || body.titulo.trim() === '') {
      errores.push('El campo "titulo" es obligatorio y no puede estar vacio.');
    } else if (body.titulo.trim().length > 150) {
      errores.push('El campo "titulo" admite un maximo de 150 caracteres.');
    } else {
      datos.titulo = body.titulo.trim();
    }
  }

  if (!parcial || tiene('autor')) {
    if (typeof body.autor !== 'string' || body.autor.trim() === '') {
      errores.push('El campo "autor" es obligatorio y no puede estar vacio.');
    } else if (body.autor.trim().length > 100) {
      errores.push('El campo "autor" admite un maximo de 100 caracteres.');
    } else {
      datos.autor = body.autor.trim();
    }
  }

  if (!parcial || tiene('anio')) {
    const valor = body.anio;
    const anioMaximo = new Date().getFullYear() + 1;
    const esEntero = typeof valor === 'number' && Number.isInteger(valor);
    const esTextoEntero = typeof valor === 'string' && /^[0-9]+$/.test(valor.trim());
    const anio = esEntero ? valor : (esTextoEntero ? Number(valor.trim()) : NaN);

    if (valor === undefined || valor === null || valor === '') {
      errores.push('El campo "anio" es obligatorio.');
    } else if (!Number.isInteger(anio) || anio < 1 || anio > anioMaximo) {
      errores.push(`El campo "anio" debe ser un entero entre 1 y ${anioMaximo}.`);
    } else {
      datos.anio = anio;
    }
  }

  if (errores.length > 0) {
    throw new HttpError(400, 'Datos invalidos.', errores);
  }

  return datos;
}

function validarId(valor) {
  const texto = String(valor);

  if (!/^[1-9][0-9]*$/.test(texto)) {
    throw new HttpError(400, 'El identificador debe ser un entero positivo.');
  }

  const id = Number(texto);

  if (!Number.isSafeInteger(id)) {
    throw new HttpError(400, 'El identificador esta fuera del rango permitido.');
  }

  return id;
}

function validarRegistro(body) {
  if (!esObjeto(body)) {
    throw new HttpError(400, 'El cuerpo de la peticion debe ser un objeto JSON.', [
      'Envia Content-Type: application/json y un objeto JSON valido.'
    ]);
  }

  const errores = [];
  let usuario = '';
  const password = body.password;

  if (typeof body.usuario !== 'string' || body.usuario.trim() === '') {
    errores.push('El campo "usuario" es obligatorio.');
  } else {
    usuario = body.usuario.trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,50}$/.test(usuario)) {
      errores.push('El usuario debe tener entre 3 y 50 caracteres y solo puede contener letras, numeros, punto, guion o guion bajo.');
    }
  }

  if (typeof password !== 'string' || password === '') {
    errores.push('El campo "password" es obligatorio.');
  } else if (password.length < 8) {
    errores.push('La contrasena debe tener al menos 8 caracteres.');
  } else if (Buffer.byteLength(password, 'utf8') > 72) {
    errores.push('La contrasena no puede superar 72 bytes.');
  }

  if (errores.length > 0) {
    throw new HttpError(400, 'Datos invalidos.', errores);
  }

  return { usuario, password };
}

module.exports = { validarLibro, validarId, validarRegistro };
