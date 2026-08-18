function notFound(request, response, next) {
  if (request.path.startsWith('/api/')) {
    return response.status(404).json({ error: 'Recurso não encontrado.' });
  }

  return next();
}

function errorHandler(error, _request, response, _next) {
  console.error(error);
  const status = error.status || error.statusCode || 500;
  response.status(status).json({
    error: status < 500 ? error.message : 'Ocorreu um erro interno.'
  });
}

module.exports = { notFound, errorHandler };
