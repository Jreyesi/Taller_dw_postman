const { Router } = require('express');
const controlador = require('../controllers/libros.controller');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.use(requireAuth);

router.get('/', controlador.listar);
router.post('/', controlador.crear);
router.get('/:id', controlador.obtener);
router.put('/:id', controlador.actualizar);
router.delete('/:id', controlador.eliminar);

module.exports = router;
