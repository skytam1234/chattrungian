import { notFoundResponse } from './response.middleware.js';

export const notFoundHandler = (req, res, next) => {
  notFoundResponse(res, `Route ${req.method} ${req.path}`);
};

export default { notFoundHandler };
