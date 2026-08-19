require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const apiRouter = require('./backend/routes');
const { notFound, errorHandler } = require('./backend/middleware/error-handler');
const { requirePageAuth } = require('./backend/middleware/auth');
const { passport } = require('./backend/config/passport');
const { env } = require('./backend/config/env');

const app = express();
const publicPath = path.join(__dirname, 'public');

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
const normalizeOrigin = value => String(value || '').trim().replace(/\/$/, '').toLowerCase();
const configuredOrigins = env.allowedOrigins.map(normalizeOrigin);

app.use((request, response, next) => {
  const forwardedProtocol = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProtocol || request.protocol;
  const currentOrigin = normalizeOrigin(`${protocol}://${request.get('host')}`);

  return cors({
    origin(origin, callback) {
      const requestedOrigin = normalizeOrigin(origin);
      if (!origin || requestedOrigin === currentOrigin || configuredOrigins.includes(requestedOrigin)) {
        return callback(null, true);
      }
      return callback(Object.assign(new Error('Origem não permitida.'), { status: 403 }));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })(request, response, next);
});
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(cookieParser());
app.use(passport.initialize());
app.use('/api', apiRouter);
app.use(express.static(publicPath));

app.get('/', (_request, response) => {
  response.sendFile(path.join(publicPath, 'pages', 'index.html'));
});

app.get('/dashboard', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(publicPath, 'pages', 'dashboard.html'));
});

app.get('/agenda', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(publicPath, 'pages', 'agenda.html'));
});

app.get('/clientes', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(publicPath, 'pages', 'clientes.html'));
});

app.get('/servicos', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(publicPath, 'pages', 'servicos.html'));
});

app.get('/profissionais', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(publicPath, 'pages', 'profissionais.html'));
});

app.get('/cupons', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(publicPath, 'pages', 'cupons.html'));
});

app.get('/configuracoes', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(publicPath, 'pages', 'configuracoes.html'));
});

app.get('/reservas', requirePageAuth, (_request, response) => {
  response.sendFile(path.join(publicPath, 'pages', 'reservas.html'));
});

app.get('/agendar/:slug', (_request, response) => {
  response.sendFile(path.join(publicPath, 'pages', 'booking.html'));
});

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`NaRégua disponível na porta ${env.port}`);
});

module.exports = app;
