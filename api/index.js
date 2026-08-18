require('dotenv').config();

const app = require('../backend/app');

module.exports = function handler(request, response) {
  return app(request, response);
};
