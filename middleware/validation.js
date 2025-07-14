const logger = require('../utils/logger');

/**
 * Validation middleware for webhook requests
 */

/**
 * Validate WhatsApp webhook request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function validateWebhook(req, res, next) {
    try {
        // Log incoming webhook request
        logger.debug('Webhook request received', {
            headers: req.headers,
            body: req.body,
            method: req.method,
            url: req.url
        });

        // Validate request method
        if (req.method !== 'POST') {
            logger.warn('Invalid webhook method:', req.method);
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // Validate content type
        const contentType = req.headers['content-type'];
        if (!contentType || !contentType.includes('application/json')) {
            logger.warn('Invalid content type:', contentType);
            return res.status(400).json({ error: 'Invalid content type' });
        }

        // Validate request body structure
        const body = req.body;
        if (!body || typeof body !== 'object') {
            logger.warn('Invalid request body');
            return res.status(400).json({ error: 'Invalid request body' });
        }

        // Validate WhatsApp webhook structure
        if (!body.object) {
            logger.warn('Missing object field in webhook');
            return res.status(400).json({ error: 'Invalid webhook format' });
        }

        // Validate webhook signature (optional but recommended for production)
        const signature = req.headers['x-hub-signature-256'];
        if (process.env.WEBHOOK_SECRET && signature) {
            if (!validateSignature(req.body, signature)) {
                logger.warn('Invalid webhook signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }

        // Add validation timestamp
        req.validatedAt = new Date().toISOString();
        
        next();
    } catch (error) {
        logger.error('Webhook validation error:', error);
        res.status(500).json({ error: 'Validation failed' });
    }
}

/**
 * Validate webhook signature (for production use)
 * @param {Object} payload - Request payload
 * @param {string} signature - X-Hub-Signature-256 header
 * @returns {boolean} True if signature is valid
 */
function validateSignature(payload, signature) {
    if (!process.env.WEBHOOK_SECRET) {
        return true; // Skip validation if secret not configured
    }

    try {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', process.env.WEBHOOK_SECRET)
            .update(JSON.stringify(payload))
            .digest('hex');

        const providedSignature = signature.replace('sha256=', '');
        
        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(providedSignature, 'hex')
        );
    } catch (error) {
        logger.error('Signature validation error:', error);
        return false;
    }
}

/**
 * Validate message data structure
 * @param {Object} messageData - WhatsApp message data
 * @returns {boolean} True if valid
 */
function validateMessageData(messageData) {
    if (!messageData || typeof messageData !== 'object') {
        return false;
    }

    // Check for required fields
    const requiredFields = ['messages', 'metadata'];
    for (const field of requiredFields) {
        if (!(field in messageData)) {
            logger.warn(`Missing required field: ${field}`);
            return false;
        }
    }

    // Validate messages array
    if (!Array.isArray(messageData.messages)) {
        logger.warn('Messages field is not an array');
        return false;
    }

    // Validate individual messages
    for (const message of messageData.messages) {
        if (!validateMessage(message)) {
            return false;
        }
    }

    return true;
}

/**
 * Validate individual message structure
 * @param {Object} message - Individual WhatsApp message
 * @returns {boolean} True if valid
 */
function validateMessage(message) {
    if (!message || typeof message !== 'object') {
        return false;
    }

    // Required message fields
    const requiredFields = ['id', 'from', 'timestamp', 'type'];
    for (const field of requiredFields) {
        if (!(field in message)) {
            logger.warn(`Missing required message field: ${field}`);
            return false;
        }
    }

    // Validate phone number format
    if (!validatePhoneNumber(message.from)) {
        logger.warn('Invalid phone number format:', message.from);
        return false;
    }

    // Validate message type
    const validTypes = ['text', 'image', 'document', 'audio', 'video', 'interactive', 'button', 'list'];
    if (!validTypes.includes(message.type)) {
        logger.warn('Invalid message type:', message.type);
        return false;
    }

    return true;
}

/**
 * Validate phone number format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} True if valid
 */
function validatePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
        return false;
    }

    // Basic phone number validation (WhatsApp format)
    // Should be digits only, typically 10-15 digits
    const phoneRegex = /^\d{10,15}$/;
    return phoneRegex.test(phoneNumber);
}

/**
 * Validate file upload data
 * @param {Object} fileData - File upload data
 * @returns {Object} Validation result
 */
function validateFileUpload(fileData) {
    const errors = [];

    if (!fileData) {
        errors.push('No file data provided');
        return { valid: false, errors };
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (fileData.size > maxSize) {
        errors.push('File size exceeds 10MB limit');
    }

    // Validate file type
    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(fileData.mimetype)) {
        errors.push('Invalid file type. Only PDF, DOC, DOCX, and image files are allowed');
    }

    // Validate filename
    if (!fileData.originalname || fileData.originalname.trim().length === 0) {
        errors.push('Invalid filename');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate environment variables
 * @returns {Object} Validation result
 */
function validateEnvironment() {
    const required = [
        'WHATSAPP_TOKEN',
        'WHATSAPP_PHONE_ID'
    ];

    const optional = [
        'EMAIL_HOST',
        'EMAIL_PORT',
        'EMAIL_USER',
        'EMAIL_PASS',
        'WEBHOOK_VERIFY_TOKEN',
        'WEBHOOK_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);
    const configured = optional.filter(key => process.env[key]);

    return {
        valid: missing.length === 0,
        missing,
        configured,
        warnings: missing.length > 0 ? [`Missing required environment variables: ${missing.join(', ')}`] : []
    };
}

/**
 * Rate limiting validation
 * @param {string} phoneNumber - Phone number
 * @returns {boolean} True if within rate limits
 */
function validateRateLimit(phoneNumber) {
    // Simple in-memory rate limiting
    if (!global.rateLimitMap) {
        global.rateLimitMap = new Map();
    }

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 30; // Max 30 requests per minute per user

    const userRequests = global.rateLimitMap.get(phoneNumber) || [];
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
    
    if (recentRequests.length >= maxRequests) {
        logger.warn(`Rate limit exceeded for ${phoneNumber}`);
        return false;
    }

    // Add current request
    recentRequests.push(now);
    global.rateLimitMap.set(phoneNumber, recentRequests);

    return true;
}

/**
 * Sanitize user input
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return '';
    }

    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, 1000); // Limit length
}

/**
 * Validate session data
 * @param {Object} session - Session object
 * @returns {boolean} True if valid
 */
function validateSession(session) {
    if (!session || typeof session !== 'object') {
        return false;
    }

    const requiredFields = ['phoneNumber', 'state', 'createdAt'];
    for (const field of requiredFields) {
        if (!(field in session)) {
            return false;
        }
    }

    return validatePhoneNumber(session.phoneNumber);
}

module.exports = {
    validateWebhook,
    validateSignature,
    validateMessageData,
    validateMessage,
    validatePhoneNumber,
    validateFileUpload,
    validateEnvironment,
    validateRateLimit,
    sanitizeInput,
    validateSession
};
