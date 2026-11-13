const { Router } = require('express');
const { login, registrar } = require('../controllers/auth.controller');

const router = Router();

router.post('/login', login);
router.post('/register', registrar);

module.exports = router;
