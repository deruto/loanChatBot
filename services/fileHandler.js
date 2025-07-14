const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const logger = require('../utils/logger');

/**
 * File handling service for managing document uploads and storage
 */
class FileHandler {
    constructor() {
        this.baseDataPath = path.join(__dirname, '..', 'data');
        this.ensureDataDirectory();
    }

    /**
     * Ensure the base data directory exists
     */
    ensureDataDirectory() {
        if (!fs.existsSync(this.baseDataPath)) {
            fs.mkdirSync(this.baseDataPath, { recursive: true });
            logger.info('Created base data directory');
        }
    }

    /**
     * Get user's document directory path
     * @param {string} phoneNumber - User's phone number
     * @param {string} loanType - Type of loan
     * @returns {string} Directory path
     */
    getUserDirectory(phoneNumber, loanType) {
        // Sanitize phone number and loan type for file system
        const sanitizedPhone = this.sanitizeFileName(phoneNumber);
        const sanitizedLoanType = this.sanitizeFileName(loanType);
        
        return path.join(this.baseDataPath, sanitizedPhone, sanitizedLoanType);
    }

    /**
     * Sanitize filename for file system compatibility
     * @param {string} fileName - Original filename
     * @returns {string} Sanitized filename
     */
    sanitizeFileName(fileName) {
        return fileName
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_|_$/g, '');
    }

    /**
     * Create user directory if it doesn't exist
     * @param {string} phoneNumber - User's phone number
     * @param {string} loanType - Type of loan
     * @returns {string} Created directory path
     */
    createUserDirectory(phoneNumber, loanType) {
        const dirPath = this.getUserDirectory(phoneNumber, loanType);
        
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            logger.info(`Created user directory: ${dirPath}`);
        }
        
        return dirPath;
    }

    /**
     * Save file from WhatsApp media
     * @param {string} phoneNumber - User's phone number
     * @param {string} loanType - Type of loan
     * @param {string} documentType - Type of document
     * @param {Buffer} fileBuffer - File content buffer
     * @param {string} originalFileName - Original file name
     * @param {string} mimeType - File MIME type
     * @returns {Object} File save result
     */
    async saveFile(phoneNumber, loanType, documentType, fileBuffer, originalFileName, mimeType) {
        try {
            const userDir = this.createUserDirectory(phoneNumber, loanType);
            
            // Generate unique filename
            const timestamp = Date.now();
            const sanitizedDocType = this.sanitizeFileName(documentType);
            const sanitizedOriginalName = this.sanitizeFileName(originalFileName);
            const extension = this.getFileExtension(originalFileName, mimeType);
            
            const fileName = `${timestamp}_${sanitizedDocType}_${sanitizedOriginalName}${extension}`;
            const filePath = path.join(userDir, fileName);
            
            // Write file to disk
            fs.writeFileSync(filePath, fileBuffer);
            
            const fileInfo = {
                fileName,
                filePath,
                originalFileName,
                documentType,
                mimeType,
                fileSize: fileBuffer.length,
                uploadedAt: new Date().toISOString(),
                phoneNumber,
                loanType
            };
            
            // Save file metadata
            const metadataPath = path.join(userDir, `${fileName}.meta.json`);
            fs.writeFileSync(metadataPath, JSON.stringify(fileInfo, null, 2));
            
            logger.info(`File saved: ${fileName} for ${phoneNumber}`);
            return fileInfo;
            
        } catch (error) {
            logger.error('Error saving file:', error);
            throw new Error(`Failed to save file: ${error.message}`);
        }
    }

    /**
     * Get file extension from filename or mime type
     * @param {string} fileName - Original filename
     * @param {string} mimeType - File MIME type
     * @returns {string} File extension with dot
     */
    getFileExtension(fileName, mimeType) {
        // Try to get extension from filename
        if (fileName && path.extname(fileName)) {
            return path.extname(fileName).toLowerCase();
        }
        
        // Fallback to mime type mapping
        const mimeToExt = {
            'application/pdf': '.pdf',
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'text/plain': '.txt'
        };
        
        return mimeToExt[mimeType] || '.bin';
    }

    /**
     * List all files for a user
     * @param {string} phoneNumber - User's phone number
     * @param {string} loanType - Type of loan
     * @returns {Array} Array of file information objects
     */
    listUserFiles(phoneNumber, loanType) {
        try {
            const userDir = this.getUserDirectory(phoneNumber, loanType);
            
            if (!fs.existsSync(userDir)) {
                return [];
            }
            
            const files = fs.readdirSync(userDir);
            const fileInfos = [];
            
            for (const file of files) {
                if (file.endsWith('.meta.json')) {
                    const metadataPath = path.join(userDir, file);
                    try {
                        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                        fileInfos.push(metadata);
                    } catch (error) {
                        logger.warn(`Failed to read metadata for ${file}:`, error);
                    }
                }
            }
            
            return fileInfos.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
            
        } catch (error) {
            logger.error('Error listing user files:', error);
            return [];
        }
    }

    /**
     * Create zip file of all user documents
     * @param {string} phoneNumber - User's phone number
     * @param {string} loanType - Type of loan
     * @returns {Object} Zip file information
     */
    async createUserZip(phoneNumber, loanType) {
        try {
            const userDir = this.getUserDirectory(phoneNumber, loanType);
            
            if (!fs.existsSync(userDir)) {
                throw new Error('No documents found for user');
            }
            
            const zip = new AdmZip();
            const files = fs.readdirSync(userDir);
            let addedFiles = 0;
            
            // Add all non-metadata files to zip
            for (const file of files) {
                if (!file.endsWith('.meta.json')) {
                    const filePath = path.join(userDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.isFile()) {
                        zip.addLocalFile(filePath);
                        addedFiles++;
                    }
                }
            }
            
            if (addedFiles === 0) {
                throw new Error('No valid documents found to zip');
            }
            
            // Generate zip filename
            const sanitizedPhone = this.sanitizeFileName(phoneNumber);
            const sanitizedLoanType = this.sanitizeFileName(loanType);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const zipFileName = `${sanitizedPhone}_${sanitizedLoanType}_${timestamp}.zip`;
            const zipPath = path.join(this.baseDataPath, zipFileName);
            
            // Write zip file
            zip.writeZip(zipPath);
            
            const zipStats = fs.statSync(zipPath);
            const zipInfo = {
                fileName: zipFileName,
                filePath: zipPath,
                fileSize: zipStats.size,
                fileCount: addedFiles,
                createdAt: new Date().toISOString(),
                phoneNumber,
                loanType
            };
            
            logger.info(`Created zip file: ${zipFileName} with ${addedFiles} files`);
            return zipInfo;
            
        } catch (error) {
            logger.error('Error creating zip file:', error);
            throw new Error(`Failed to create zip file: ${error.message}`);
        }
    }

    /**
     * Delete user directory and all files
     * @param {string} phoneNumber - User's phone number
     * @param {string} loanType - Type of loan
     * @returns {boolean} Success status
     */
    deleteUserFiles(phoneNumber, loanType) {
        try {
            const userDir = this.getUserDirectory(phoneNumber, loanType);
            
            if (fs.existsSync(userDir)) {
                fs.rmSync(userDir, { recursive: true, force: true });
                logger.info(`Deleted user directory: ${userDir}`);
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error('Error deleting user files:', error);
            return false;
        }
    }

    /**
     * Delete a zip file
     * @param {string} zipPath - Path to zip file
     * @returns {boolean} Success status
     */
    deleteZipFile(zipPath) {
        try {
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
                logger.info(`Deleted zip file: ${zipPath}`);
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error('Error deleting zip file:', error);
            return false;
        }
    }

    /**
     * Get storage statistics
     * @returns {Object} Storage statistics
     */
    getStorageStats() {
        try {
            const stats = {
                totalUsers: 0,
                totalFiles: 0,
                totalSize: 0,
                byLoanType: {}
            };
            
            if (!fs.existsSync(this.baseDataPath)) {
                return stats;
            }
            
            const userDirs = fs.readdirSync(this.baseDataPath);
            
            for (const userDir of userDirs) {
                const userPath = path.join(this.baseDataPath, userDir);
                const userStat = fs.statSync(userPath);
                
                if (userStat.isDirectory()) {
                    stats.totalUsers++;
                    
                    const loanTypeDirs = fs.readdirSync(userPath);
                    for (const loanTypeDir of loanTypeDirs) {
                        const loanTypePath = path.join(userPath, loanTypeDir);
                        const loanTypeStat = fs.statSync(loanTypePath);
                        
                        if (loanTypeStat.isDirectory()) {
                            if (!stats.byLoanType[loanTypeDir]) {
                                stats.byLoanType[loanTypeDir] = { users: 0, files: 0, size: 0 };
                            }
                            stats.byLoanType[loanTypeDir].users++;
                            
                            const files = fs.readdirSync(loanTypePath);
                            for (const file of files) {
                                if (!file.endsWith('.meta.json')) {
                                    const filePath = path.join(loanTypePath, file);
                                    const fileStat = fs.statSync(filePath);
                                    
                                    if (fileStat.isFile()) {
                                        stats.totalFiles++;
                                        stats.totalSize += fileStat.size;
                                        stats.byLoanType[loanTypeDir].files++;
                                        stats.byLoanType[loanTypeDir].size += fileStat.size;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            return stats;
        } catch (error) {
            logger.error('Error getting storage stats:', error);
            return { error: error.message };
        }
    }

    /**
     * Format file size in human readable format
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = new FileHandler();
