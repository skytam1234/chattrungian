import { Router } from 'express';
import uploadController from '../controllers/upload.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadSingle, uploadMultiple } from '../middleware/upload.middleware.js';
import { handleMulterError } from '../middleware/multerError.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/upload
 * @desc    Upload single file (any type)
 * @access  Private
 */
router.post('/', uploadSingle.single('file'), handleMulterError, uploadController.uploadSingle.bind(uploadController));

/**
 * @route   POST /api/upload/multiple
 * @desc    Upload multiple files (max 10)
 * @access  Private
 */
router.post('/multiple', uploadMultiple.array('files', 10), handleMulterError, uploadController.uploadMultiple.bind(uploadController));

/**
 * @route   POST /api/upload/avatar
 * @desc    Upload avatar image
 * @access  Private
 */
router.post('/avatar', uploadSingle.single('file'), handleMulterError, uploadController.uploadAvatar.bind(uploadController));

/**
 * @route   POST /api/upload/message
 * @desc    Upload message attachment (image, audio, video, file)
 * @access  Private
 */
router.post('/message', uploadSingle.single('file'), handleMulterError, uploadController.uploadMessageFile.bind(uploadController));

/**
 * @route   POST /api/upload/conversation-avatar
 * @desc    Upload conversation group avatar
 * @access  Private
 */
router.post('/conversation-avatar', uploadSingle.single('file'), handleMulterError, uploadController.uploadConversationAvatar.bind(uploadController));

/**
 * @route   DELETE /api/upload/:filename
 * @desc    Delete a file
 * @access  Private
 */
router.delete('/:filename(*)', uploadController.deleteFile.bind(uploadController));

/**
 * @route   GET /api/upload/:category/:filename/download
 * @desc    Download a file
 * @access  Private
 */
router.get('/:category/:filename(*)/download', uploadController.downloadFile.bind(uploadController));

/**
 * @route   GET /api/upload/:filename
 * @desc    Get file info
 * @access  Private
 */
router.get('/:filename(*)', uploadController.getFileInfo.bind(uploadController));

export default router;
