/**
 * File attachment helper functions
 * Provides utilities for handling file metadata in messages
 */

/**
 * File type categories
 */
export const FILE_TYPES = {
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  FILE: 'file',
};

/**
 * Get file type from MIME type
 * @param {string} mimetype - MIME type of the file
 * @returns {string} File type category
 */
export const getFileType = (mimetype) => {
  if (mimetype.startsWith('image/')) return FILE_TYPES.IMAGE;
  if (mimetype.startsWith('audio/')) return FILE_TYPES.AUDIO;
  if (mimetype.startsWith('video/')) return FILE_TYPES.VIDEO;
  return FILE_TYPES.FILE;
};

/**
 * Create file metadata for image message
 * @param {Object} fileData - File data from upload response
 * @returns {Object} Metadata object for image
 */
export const createImageMetadata = (fileData) => ({
  fileType: FILE_TYPES.IMAGE,
  url: fileData.url,
  filename: fileData.filename,
  originalName: fileData.originalName,
  mimetype: fileData.mimetype,
  size: fileData.size,
  width: fileData.width || null,
  height: fileData.height || null,
  thumbnailUrl: fileData.thumbnailUrl || null,
});

/**
 * Create file metadata for audio message
 * @param {Object} fileData - File data from upload response
 * @returns {Object} Metadata object for audio
 */
export const createAudioMetadata = (fileData) => ({
  fileType: FILE_TYPES.AUDIO,
  url: fileData.url,
  filename: fileData.filename,
  originalName: fileData.originalName,
  mimetype: fileData.mimetype,
  size: fileData.size,
  duration: fileData.duration || null,
});

/**
 * Create file metadata for video message
 * @param {Object} fileData - File data from upload response
 * @returns {Object} Metadata object for video
 */
export const createVideoMetadata = (fileData) => ({
  fileType: FILE_TYPES.VIDEO,
  url: fileData.url,
  filename: fileData.filename,
  originalName: fileData.originalName,
  mimetype: fileData.mimetype,
  size: fileData.size,
  duration: fileData.duration || null,
  thumbnailUrl: fileData.thumbnailUrl || null,
  width: fileData.width || null,
  height: fileData.height || null,
});

/**
 * Create file metadata for generic file message
 * @param {Object} fileData - File data from upload response
 * @returns {Object} Metadata object for file
 */
export const createFileMetadata = (fileData) => ({
  fileType: FILE_TYPES.FILE,
  url: fileData.url,
  filename: fileData.filename,
  originalName: fileData.originalName,
  mimetype: fileData.mimetype,
  size: fileData.size,
  extension: getFileExtension(fileData.originalName),
});

/**
 * Create file metadata based on file type
 * @param {Object} fileData - File data from upload response
 * @returns {Object} Metadata object
 */
export const createFileMetadataByType = (fileData) => {
  const fileType = getFileType(fileData.mimetype);

  switch (fileType) {
    case FILE_TYPES.IMAGE:
      return createImageMetadata(fileData);
    case FILE_TYPES.AUDIO:
      return createAudioMetadata(fileData);
    case FILE_TYPES.VIDEO:
      return createVideoMetadata(fileData);
    default:
      return createFileMetadata(fileData);
  }
};

/**
 * Get file extension from filename
 * @param {string} filename - Original filename
 * @returns {string} File extension
 */
export const getFileExtension = (filename) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

/**
 * Format file size to human readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Check if metadata contains a file attachment
 * @param {Object} metadata - Message metadata
 * @returns {boolean} True if contains file
 */
export const hasFileAttachment = (metadata) => {
  return metadata && metadata.url && metadata.fileType;
};

/**
 * Get file URL from message metadata
 * @param {Object} metadata - Message metadata
 * @returns {string|null} File URL or null
 */
export const getFileUrl = (metadata) => {
  return metadata?.url || null;
};
