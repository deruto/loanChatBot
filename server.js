const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const webhookController = require('./controllers/webhookController');
const whatsappService = require('./services/whatsappService');
const logger = require('./utils/logger');
const { validateWebhook } = require('./middleware/validation');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info('Created data directory');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userPhone = req.body.userPhone;
        const loanType = req.body.loanType;
        const uploadPath = path.join(dataDir, userPhone, loanType);
        
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const originalName = file.originalname;
        cb(null, `${timestamp}_${originalName}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow common document formats
        const allowedMimes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/jpg',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Please upload PDF, DOC, DOCX, or image files.'));
        }
    }
});

// Routes
app.get('/', (req, res) => {
    res.json({ 
        status: 'running',
        message: 'WhatsApp Loan Document Collection Bot',
        timestamp: new Date().toISOString(),
        webhook_url: `${req.protocol}://${req.get('host')}/webhook`,
        verify_token: 'loan_bot_verify_token'
    });
});

// WhatsApp webhook verification
app.get('/webhook', (req, res) => {
    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'loan_bot_verify_token';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (mode && token) {
        if (mode === 'subscribe' && token === verifyToken) {
            logger.info('Webhook verified successfully');
            res.status(200).send(challenge);
        } else {
            logger.warn('Webhook verification failed');
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// WhatsApp webhook for receiving messages
app.post('/webhook', validateWebhook, webhookController.handleWebhook);

// File upload endpoint (for web interface if needed)
app.post('/upload', upload.single('document'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        logger.info(`File uploaded: ${req.file.filename}`);
        res.json({ 
            success: true, 
            filename: req.file.filename,
            path: req.file.path
        });
    } catch (error) {
        logger.error('File upload error:', error);
        res.status(500).json({ error: 'File upload failed' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
    }
    
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info('WhatsApp Loan Document Collection Bot started successfully');
    
    // Log webhook URL for easy access
    if (process.env.REPLIT_DEV_DOMAIN) {
        logger.info(`Webhook URL: https://${process.env.REPLIT_DEV_DOMAIN}/webhook`);
        logger.info(`Verify Token: ${process.env.WEBHOOK_VERIFY_TOKEN || 'loan_bot_verify_token'}`);
    }
    
    // Validate required environment variables
    const requiredEnvVars = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        logger.warn(`Missing environment variables: ${missingVars.join(', ')}`);
        logger.warn('Please check your .env file');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

module.exports = app;
