const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const librosRoutes = require('./routes/libros.routes');
const { notFound, errorHandler } = require('./middleware/error-handler');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

app.use('/auth', authRoutes);
app.use('/libros', librosRoutes);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
