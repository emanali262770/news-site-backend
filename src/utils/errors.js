export function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let message = error.message;
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    status = 400;
    message = 'Invalid field value';
  }
  if (error.name === 'MulterError') {
    status = 400;
    message = error.code === 'LIMIT_FILE_SIZE' ? 'Image must be at most 1 MB' : 'Upload one image using the image field';
  }
  if (error.code === 11000) { status = 409; message = 'Record already exists'; }
  if (status >= 500) {
    console.error('Request failed:', error.name);
    message = 'Internal server error';
  }
  res.status(status).json({ message });
}
