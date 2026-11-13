const librosRepository = require('../repositories/libros.repository');
const HttpError = require('../utils/http-error');
const { validarLibro, validarId } = require('../utils/validators');

async function listar(req, res, next) {
  try {
    const libros = await librosRepository.listar();
    return res.status(200).json(libros);
  } catch (error) {
    return next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const libro = await librosRepository.buscarPorId(id);

    if (!libro) {
      throw new HttpError(404, `No existe un libro con id ${id}.`);
    }

    return res.status(200).json(libro);
  } catch (error) {
    return next(error);
  }
}

async function crear(req, res, next) {
  try {
    const datos = validarLibro(req.body);
    const libro = await librosRepository.crear(datos);
    return res.status(201).json(libro);
  } catch (error) {
    return next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const datos = validarLibro(req.body, { parcial: true });
    const libro = await librosRepository.actualizar(id, datos);

    if (!libro) {
      throw new HttpError(404, `No existe un libro con id ${id}.`);
    }

    return res.status(200).json(libro);
  } catch (error) {
    return next(error);
  }
}

async function eliminar(req, res, next) {
  try {
    const id = validarId(req.params.id);
    const libro = await librosRepository.eliminar(id);

    if (!libro) {
      throw new HttpError(404, `No existe un libro con id ${id}.`);
    }

    return res.status(200).json({
      message: 'Libro eliminado correctamente.',
      libro
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
