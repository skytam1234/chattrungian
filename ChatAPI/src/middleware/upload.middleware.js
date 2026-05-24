import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base upload directory
const UPLOAD_BASE_DIR = path.resolve(__dirname, '../../DATA');

// Allowed file types
const ALLOWED_MIME_TYPES = {
  // Images
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  // Audio
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/aac': '.aac',
  // Video
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'video/quicktime': '.mov',
  // Documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'application/zip': '.zip',
};

// Allowed categories
export const FILE_CATEGORIES = {
  IMAGES: 'images',
  AUDIO: 'audio',
  VIDEO: 'video',
  DOCUMENTS: 'documents',
  ATTACHMENTS: 'attachments',
};

// Category to mime type mapping
const CATEGORY_MIME_TYPES = {
  [FILE_CATEGORIES.IMAGES]: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  [FILE_CATEGORIES.AUDIO]: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac'],
  [FILE_CATEGORIES.VIDEO]: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  [FILE_CATEGORIES.DOCUMENTS]: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
  ],
  [FILE_CATEGORIES.ATTACHMENTS]: Object.keys(ALLOWED_MIME_TYPES),
};

// Max file sizes (in bytes)
const MAX_FILE_SIZES = {
  [FILE_CATEGORIES.IMAGES]: 10 * 1024 * 1024, // 10MB
  [FILE_CATEGORIES.AUDIO]: 25 * 1024 * 1024, // 25MB
  [FILE_CATEGORIES.VIDEO]: 100 * 1024 * 1024, // 100MB
  [FILE_CATEGORIES.DOCUMENTS]: 25 * 1024 * 1024, // 25MB
  [FILE_CATEGORIES.ATTACHMENTS]: 100 * 1024 * 1024, // 100MB
};

// File filter function
const fileFilter = (req, file, cb) => {
  const category = req.params.category || FILE_CATEGORIES.ATTACHMENTS;
  const allowedTypes = CATEGORY_MIME_TYPES[category] || CATEGORY_MIME_TYPES[FILE_CATEGORIES.ATTACHMENTS];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

// Storage configuration
const createStorage = (subFolder) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(UPLOAD_BASE_DIR, subFolder);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with timestamp and random string
      const uniqueId = uuidv4();
      const ext = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname);
      const filename = `${Date.now()}-${uniqueId}${ext}`;
      
      cb(null, filename);
    },
  });
};

// Create multer instance factory
export const createUploadMiddleware = (category = FILE_CATEGORIES.ATTACHMENTS, customMaxSize = null) => {
  const maxSize = customMaxSize || MAX_FILE_SIZES[category] || MAX_FILE_SIZES[FILE_CATEGORIES.ATTACHMENTS];
  
  return multer({
    storage: createStorage(category),
    limits: {
      fileSize: maxSize,
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = CATEGORY_MIME_TYPES[category] || CATEGORY_MIME_TYPES[FILE_CATEGORIES.ATTACHMENTS];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} is not allowed for ${category}`), false);
      }
    },
  });
};

// Pre-configured middleware instances
export const uploadImages = createUploadMiddleware(FILE_CATEGORIES.IMAGES);
export const uploadAudio = createUploadMiddleware(FILE_CATEGORIES.AUDIO);
export const uploadVideo = createUploadMiddleware(FILE_CATEGORIES.VIDEO);
export const uploadDocuments = createUploadMiddleware(FILE_CATEGORIES.DOCUMENTS);
export const uploadAttachments = createUploadMiddleware(FILE_CATEGORIES.ATTACHMENTS);

// Extension to MIME type mapping for detection
const EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.zip': 'application/zip',
};

// Detect MIME type from filename extension
const detectMimeType = (filename, fallbackMime) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext && EXT_TO_MIME[ext]) {
    return EXT_TO_MIME[ext];
  }
  return fallbackMime;
};

// Generic single file upload (any allowed type)
export const uploadSingle = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Detect actual MIME type from extension if needed
      const actualMime = detectMimeType(file.originalname, file.mimetype);
      let subFolder = FILE_CATEGORIES.ATTACHMENTS;
      
      if (actualMime.startsWith('image/')) {
        subFolder = FILE_CATEGORIES.IMAGES;
      } else if (actualMime.startsWith('audio/')) {
        subFolder = FILE_CATEGORIES.AUDIO;
      } else if (actualMime.startsWith('video/')) {
        subFolder = FILE_CATEGORIES.VIDEO;
      } else if (actualMime.includes('pdf') || actualMime.includes('word') || actualMime.includes('excel') || actualMime.includes('document') || actualMime.includes('spreadsheet')) {
        subFolder = FILE_CATEGORIES.DOCUMENTS;
      }
      
      const uploadPath = path.join(UPLOAD_BASE_DIR, subFolder);
      
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // Detect actual MIME type from extension if needed
      const actualMime = detectMimeType(file.originalname, file.mimetype);
      const ext = ALLOWED_MIME_TYPES[actualMime] || path.extname(file.originalname);
      const uniqueId = uuidv4();
      const filename = `${Date.now()}-${uniqueId}${ext}`;
      
      cb(null, filename);
    },
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB default max
  },
  fileFilter: (req, file, cb) => {
    // Detect actual MIME type from extension if browser sends generic type
    const actualMime = detectMimeType(file.originalname, file.mimetype);
    
    if (ALLOWED_MIME_TYPES[actualMime]) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${actualMime} is not allowed`), false);
    }
  },
});

// Multiple files upload (max 10 files)
export const uploadMultiple = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const ext = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname);
      let subFolder = FILE_CATEGORIES.ATTACHMENTS;
      
      if (file.mimetype.startsWith('image/')) {
        subFolder = FILE_CATEGORIES.IMAGES;
      } else if (file.mimetype.startsWith('audio/')) {
        subFolder = FILE_CATEGORIES.AUDIO;
      } else if (file.mimetype.startsWith('video/')) {
        subFolder = FILE_CATEGORIES.VIDEO;
      } else if (file.mimetype.includes('pdf') || file.mimetype.includes('word') || file.mimetype.includes('excel') || file.mimetype.includes('document') || file.mimetype.includes('spreadsheet')) {
        subFolder = FILE_CATEGORIES.DOCUMENTS;
      }
      
      const uploadPath = path.join(UPLOAD_BASE_DIR, subFolder);
      
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueId = uuidv4();
      const ext = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname);
      const filename = `${Date.now()}-${uniqueId}${ext}`;
      
      cb(null, filename);
    },
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 10, // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  },
});

// Get file path helper
export const getFilePath = (relativePath) => {
  return path.join(UPLOAD_BASE_DIR, relativePath);
};

// Get file URL helper
export const getFileUrl = (req, relativePath) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${relativePath}`;
};

export { UPLOAD_BASE_DIR, ALLOWED_MIME_TYPES, MAX_FILE_SIZES };
