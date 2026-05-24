import path from 'path';
import fs from 'fs';
import { FILE_CATEGORIES, UPLOAD_BASE_DIR } from '../middleware/upload.middleware.js';
import { successResponse, createdResponse } from '../middleware/response.middleware.js';

export class UploadController {
  /**
   * Upload single file
   * POST /api/upload
   */
  async uploadSingle(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const fileUrl = `/uploads/${path.basename(req.file.destination).replace(/\\/g, '/')}/${req.file.filename}`;

      return createdResponse(res, {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        path: path.join(path.basename(req.file.destination), req.file.filename),
      }, 'File uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload multiple files
   * POST /api/upload/multiple
   */
  async uploadMultiple(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded',
        });
      }

      const files = req.files.map((file) => {
        const fileUrl = `/uploads/${path.basename(file.destination).replace(/\\/g, '/')}/${file.filename}`;
        return {
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: fileUrl,
          path: path.join(path.basename(file.destination), file.filename),
        };
      });

      return createdResponse(res, {
        count: files.length,
        files,
      }, 'Files uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload avatar
   * POST /api/upload/avatar
   */
  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const fileUrl = `/uploads/${path.basename(req.file.destination).replace(/\\/g, '/')}/${req.file.filename}`;

      return createdResponse(res, {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        path: path.join(path.basename(req.file.destination), req.file.filename),
      }, 'Avatar uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload message attachment
   * POST /api/upload/message
   */
  async uploadMessageFile(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const fileUrl = `/uploads/${path.basename(req.file.destination).replace(/\\/g, '/')}/${req.file.filename}`;
      
      // Determine file category
      let category = FILE_CATEGORIES.ATTACHMENTS;
      if (req.file.mimetype.startsWith('image/')) {
        category = 'image';
      } else if (req.file.mimetype.startsWith('audio/')) {
        category = 'audio';
      } else if (req.file.mimetype.startsWith('video/')) {
        category = 'video';
      }

      return createdResponse(res, {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        path: path.join(path.basename(req.file.destination), req.file.filename),
        category,
      }, 'Message file uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload conversation avatar
   * POST /api/upload/conversation-avatar
   */
  async uploadConversationAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const fileUrl = `/uploads/${path.basename(req.file.destination).replace(/\\/g, '/')}/${req.file.filename}`;

      return createdResponse(res, {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        path: path.join(path.basename(req.file.destination), req.file.filename),
      }, 'Conversation avatar uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a file
   * DELETE /api/upload/:filename
   */
  async deleteFile(req, res, next) {
    try {
      const { filename } = req.params;
      
      // Find the file in DATA folder
      const categories = Object.values(FILE_CATEGORIES);
      let filePath = null;
      let foundCategory = null;

      for (const category of categories) {
        const potentialPath = path.join(UPLOAD_BASE_DIR, category, filename);
        if (fs.existsSync(potentialPath)) {
          filePath = potentialPath;
          foundCategory = category;
          break;
        }
      }

      if (!filePath) {
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }

      // Delete the file
      fs.unlinkSync(filePath);

      return successResponse(res, {
        filename,
        deleted: true,
      }, 'File deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get file info
   * GET /api/upload/:filename
   */
  async getFileInfo(req, res, next) {
    try {
      const { filename } = req.params;
      
      const categories = Object.values(FILE_CATEGORIES);
      let filePath = null;
      let foundCategory = null;

      for (const category of categories) {
        const potentialPath = path.join(UPLOAD_BASE_DIR, category, filename);
        if (fs.existsSync(potentialPath)) {
          filePath = potentialPath;
          foundCategory = category;
          break;
        }
      }

      if (!filePath) {
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }

      const stats = fs.statSync(filePath);

      return successResponse(res, {
        filename,
        category: foundCategory,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        url: `/uploads/${foundCategory}/${filename}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download a file
   * GET /api/upload/:category/:filename/download
   */
  async downloadFile(req, res, next) {
    try {
      const { category, filename } = req.params;
      
      // Validate category
      if (!Object.values(FILE_CATEGORIES).includes(category)) {
        console.log(`[Download] Invalid category: ${category}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid file category',
        });
      }

      const filePath = path.join(UPLOAD_BASE_DIR, category, filename);
      console.log(`[Download] Looking for file at: ${filePath}`);
      console.log(`[Download] Category: ${category}, Filename: ${filename}`);
      
      if (!fs.existsSync(filePath)) {
        console.log(`[Download] File not found: ${filePath}`);
        
        // Try to find the file in any category
        const categories = Object.values(FILE_CATEGORIES);
        for (const cat of categories) {
          const altPath = path.join(UPLOAD_BASE_DIR, cat, filename);
          console.log(`[Download] Checking alt path: ${altPath}`);
          if (fs.existsSync(altPath)) {
            console.log(`[Download] Found file in category: ${cat}`);
            const originalName = req.query.name || filename;
            const stats = fs.statSync(altPath);
            
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);
            res.setHeader('Content-Length', stats.size);
            
            const fileStream = fs.createReadStream(altPath);
            return fileStream.pipe(res);
          }
        }
        
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }

      const originalName = req.query.name || filename;
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Set headers for file download
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);
      res.setHeader('Content-Length', fileSize);

      // Create read stream and pipe to response
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error(`[Download] Error:`, error);
      next(error);
    }
  }
}

export default new UploadController();
