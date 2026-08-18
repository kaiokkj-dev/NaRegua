require('dotenv').config();
const express = require('express');

const backendApp = require('./backend/app');
const app = express();

app.use(backendApp);

module.exports = app;
