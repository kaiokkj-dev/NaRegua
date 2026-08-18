require('dotenv').config();

const app = require('./app');
const { env } = require('./config/env');

app.listen(env.port, () => {
  console.log(`NaRégua disponível em http://localhost:${env.port}`);
});

