const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const apiRouter = require('./routes');
const { notFound, errorHandler } = require('./middleware/error-handler');
const { requirePageAuth } = require('./middleware/auth');
const { passport } = require('./config/passport');
const { env } = require('./config/env');

const app = express();
const frontendPath = path.resolve(__dirname, '..', 'frontend');

app.disable('x-powered-by');
app.set('trust proxy', env.isProduction ? 1 : false);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(Object.assign(new Error('Origem não permitida.'), { status: 403 }));
  },
  credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(cookieParser());
app.use(passport.initialize());
app.use('/api', apiRouter);
app.use(express.static(frontendPath));

app.get('/', (_request, response) => {
  response.sendFile(path.join(frontendPath, 'pages', 'index.html'));
});

app.get('/dashboard', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(frontendPath, 'pages', 'dashboard.html'));
});

app.get('/agenda', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(frontendPath, 'pages', 'agenda.html'));
});

app.get('/clientes', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(frontendPath, 'pages', 'clientes.html'));
});

app.get('/servicos', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(frontendPath, 'pages', 'servicos.html'));
});

app.get('/profissionais', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(frontendPath, 'pages', 'profissionais.html'));
});

app.get('/cupons', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(frontendPath, 'pages', 'cupons.html'));
});

app.get('/reservas', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(frontendPath, 'pages', 'reservas.html'));
});

app.get('/agendar/:slug', (_request, response) => {
  response.sendFile(path.join(frontendPath, 'pages', 'booking.html'));
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
