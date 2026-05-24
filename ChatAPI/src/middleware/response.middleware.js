// Response helper functions
export const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

export const createdResponse = (res, data = null, message = 'Created successfully') => {
  return successResponse(res, data, message, 201);
};

export const noContentResponse = (res) => {
  return res.status(204).send();
};

export const paginatedResponse = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasMore: pagination.page * pagination.limit < pagination.total,
    },
    timestamp: new Date().toISOString(),
  });
};

export const errorResponse = (res, message, statusCode = 500, code = 'ERROR') => {
  return res.status(statusCode).json({
    success: false,
    error: message,
    code,
    timestamp: new Date().toISOString(),
  });
};

export const validationErrorResponse = (res, message, errors = []) => {
  return res.status(400).json({
    success: false,
    error: message,
    code: 'VALIDATION_ERROR',
    errors,
    timestamp: new Date().toISOString(),
  });
};

export const unauthorizedResponse = (res, message = 'Unauthorized') => {
  return errorResponse(res, message, 401, 'UNAUTHORIZED');
};

export const forbiddenResponse = (res, message = 'Forbidden') => {
  return errorResponse(res, message, 403, 'FORBIDDEN');
};

export const notFoundResponse = (res, resource = 'Resource') => {
  return errorResponse(res, `${resource} not found`, 404, 'NOT_FOUND');
};

// Response normalizer middleware - removed as it causes issues
export const responseNormalizer = (req, res, next) => {
  next();
};

export const responseTimeHeader = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    if (!res.headersSent) {
      res.set('X-Response-Time', `${Date.now() - start}ms`);
    }
  });
  
  next();
};

export const securityHeaders = (req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  });
  
  next();
};

export default {
  successResponse,
  createdResponse,
  noContentResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  responseNormalizer,
  responseTimeHeader,
  securityHeaders,
};
