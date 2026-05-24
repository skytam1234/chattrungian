import multer from 'multer';

/**
 * Handle Multer errors middleware
 * This middleware catches Multer errors and passes them to the error handler
 */
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 100MB.',
          code: 'FILE_TOO_LARGE',
          timestamp: new Date().toISOString(),
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files. Maximum is 10 files.',
          code: 'TOO_MANY_FILES',
          timestamp: new Date().toISOString(),
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field.',
          code: 'UNEXPECTED_FILE',
          timestamp: new Date().toISOString(),
        });
      default:
        return res.status(400).json({
          success: false,
          error: err.message,
          code: 'UPLOAD_ERROR',
          timestamp: new Date().toISOString(),
        });
    }
  }

  // Pass to next middleware if not a Multer error
  next(err);
};
