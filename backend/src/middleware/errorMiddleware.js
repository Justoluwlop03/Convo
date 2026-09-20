export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)
  const status = error.statusCode || (error.name === 'ValidationError' ? 400 : 500)
  if (status >= 500) console.error(error)
  res.status(status).json({ message: status >= 500 ? 'Internal server error' : error.message })
}

export function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}
