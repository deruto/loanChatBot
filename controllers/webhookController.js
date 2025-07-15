const whatsappService = require('../services/whatsappService');
const sessionManager = require('../services/sessionManager');
const documentRequirements = require('../services/documentRequirements');
const fileHandler = require('../services/fileHandler');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * Controller for handling WhatsApp webhook events
 */
class WebhookController {
    constructor() {
        // Chat flow states
        this.STATES = {
            INITIAL: 'INITIAL',
            WAITING_LOAN_TYPE: 'WAITING_LOAN_TYPE',
            WAITING_EMPLOYMENT_TYPE: 'WAITING_EMPLOYMENT_TYPE',
            COLLECTING_DOCUMENTS: 'COLLECTING_DOCUMENTS',
            COMPLETED: 'COMPLETED'
        };

        // Bind methods to preserve context
        this.handleWebhook = this.handleWebhook.bind(this);
    }

    /**
     * Main webhook handler for incoming WhatsApp messages
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleWebhook(req, res) {
        try {
            const body = req.body;
            
            // Respond to webhook immediately
            res.status(200).send('OK');
            
            if (body.object === 'whatsapp_business_account') {
                for (const entry of body.entry || []) {
                    for (const change of entry.changes || []) {
                        if (change.field === 'messages') {
                            await this.processMessage(change.value);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('Webhook processing error:', error);
            res.status(500).send('Error processing webhook');
        }
    }

    /**
     * Process individual WhatsApp message
     * @param {Object} messageData - WhatsApp message data
     */
    async processMessage(messageData) {
        try {
            const messages = messageData.messages || [];
            
            for (const message of messages) {
                const phoneNumber = message.from;
                const messageId = message.id;
                
                // Mark message as read
                await whatsappService.markAsRead(messageId);
                
                logger.logWhatsAppMessage('incoming', phoneNumber, message.type, 
                    message.text?.body || message.interactive?.button_reply?.title || 'media');
                
                // Get user session
                const session = sessionManager.getSession(phoneNumber);
                
                // Process message based on type and current state
                await this.routeMessage(session, message);
            }
        } catch (error) {
            logger.error('Error processing message:', error);
        }
    }

    /**
     * Route message to appropriate handler based on state
     * @param {Object} session - User session
     * @param {Object} message - WhatsApp message
     */
    async routeMessage(session, message) {
        try {
            const phoneNumber = session.phoneNumber;
            
            logger.logSessionActivity(phoneNumber, 'message_received', session.state, {
                messageType: message.type,
                state: session.state
            });

            switch (session.state) {
                case this.STATES.INITIAL:
                    await this.handleInitialMessage(session, message);
                    break;
                    
                case this.STATES.WAITING_LOAN_TYPE:
                    await this.handleLoanTypeSelection(session, message);
                    break;
                    
                case this.STATES.WAITING_EMPLOYMENT_TYPE:
                    await this.handleEmploymentTypeSelection(session, message);
                    break;
                    
                case this.STATES.COLLECTING_DOCUMENTS:
                    await this.handleDocumentUpload(session, message);
                    break;
                    
                case this.STATES.COMPLETED:
                    await this.handleCompletedState(session, message);
                    break;
                    
                default:
                    await this.handleUnknownState(session, message);
            }
        } catch (error) {
            logger.error('Error routing message:', error);
            await this.sendErrorMessage(session.phoneNumber);
        }
    }

    /**
     * Handle initial welcome message
     * @param {Object} session - User session
     * @param {Object} message - WhatsApp message
     */
    async handleInitialMessage(session, message) {
        const phoneNumber = session.phoneNumber;
        
        // Send welcome message and loan type options
        const welcomeMessage = `🏦 Welcome to our Loan Application Bot!

I'll help you submit your loan documents quickly and securely.

Let's start by selecting the type of loan you're interested in:`;

        await whatsappService.sendMessage(phoneNumber, welcomeMessage);

        // Send loan type options as interactive list
        const loanTypes = documentRequirements.getAvailableLoanTypes();
        const sections = [{
            title: "Available Loan Types",
            rows: loanTypes.map(loan => ({
                id: loan.id,
                title: loan.title,
                description: loan.description
            }))
        }];

        await whatsappService.sendListMessage(
            phoneNumber,
            "Please select your loan type from the list below:",
            "Select Loan Type",
            sections
        );

        sessionManager.setState(phoneNumber, this.STATES.WAITING_LOAN_TYPE);
    }

    /**
     * Handle loan type selection
     * @param {Object} session - User session
     * @param {Object} message - WhatsApp message
     */
    async handleLoanTypeSelection(session, message) {
        const phoneNumber = session.phoneNumber;
        let selectedLoanType = null;

        // Extract selection from interactive message or text
        if (message.interactive?.list_reply) {
            selectedLoanType = message.interactive.list_reply.title;
        } else if (message.text?.body) {
            selectedLoanType = message.text.body.trim();
        }

        // Validate loan type
        if (!selectedLoanType || !documentRequirements.isValidLoanType(selectedLoanType)) {
            await whatsappService.sendMessage(phoneNumber, 
                "❌ Please select a valid loan type from the list above.");
            return;
        }

        // Update session with loan type
        sessionManager.setLoanDetails(phoneNumber, selectedLoanType);

        // Send employment type options
        const employmentMessage = `Great! You've selected: *${selectedLoanType} Loan*

Now, please tell me about your employment status:`;

        await whatsappService.sendMessage(phoneNumber, employmentMessage);

        // Send employment type buttons
        const buttons = [
            { id: 'salaried', title: 'Salaried Employee' },
            { id: 'self_employed', title: 'Self-employed' }
        ];

        await whatsappService.sendButtonMessage(
            phoneNumber,
            "Are you a salaried employee or self-employed?",
            buttons
        );

        sessionManager.setState(phoneNumber, this.STATES.WAITING_EMPLOYMENT_TYPE);
    }

    /**
     * Handle employment type selection
     * @param {Object} session - User session
     * @param {Object} message - WhatsApp message
     */
    async handleEmploymentTypeSelection(session, message) {
        const phoneNumber = session.phoneNumber;
        let selectedEmploymentType = null;

        // Extract selection from interactive message or text
        if (message.interactive?.button_reply) {
            selectedEmploymentType = message.interactive.button_reply.title;
        } else if (message.text?.body) {
            selectedEmploymentType = message.text.body.trim();
        }

        // Validate employment type
        if (!selectedEmploymentType || !documentRequirements.isValidEmploymentType(selectedEmploymentType)) {
            await whatsappService.sendMessage(phoneNumber, 
                "❌ Please select a valid employment type using the buttons above.");
            return;
        }

        // Update session with employment type
        sessionManager.setLoanDetails(phoneNumber, session.loanType, selectedEmploymentType);

        // Get required documents
        const requiredDocuments = documentRequirements.getRequiredDocuments(
            session.loanType, 
            selectedEmploymentType
        );

        if (!requiredDocuments || requiredDocuments.length === 0) {
            await whatsappService.sendMessage(phoneNumber, 
                "❌ Sorry, I couldn't determine the required documents. Please try again.");
            sessionManager.resetSession(phoneNumber);
            return;
        }

        // Set required documents in session
        sessionManager.setRequiredDocuments(phoneNumber, requiredDocuments);

        // Send document requirements summary
        const summaryMessage = `Perfect! For a *${session.loanType} Loan* as a *${selectedEmploymentType}*, you'll need to upload the following documents:

${requiredDocuments.map((doc, index) => `${index + 1}. ${doc}`).join('\n')}

📤 I'll ask you to upload each document one by one. Please make sure your documents are clear and readable.

Let's start! 👇`;

        await whatsappService.sendMessage(phoneNumber, summaryMessage);

        // Start document collection
        sessionManager.setState(phoneNumber, this.STATES.COLLECTING_DOCUMENTS);
        await this.requestNextDocument(session);
    }

    /**
     * Handle document upload
     * @param {Object} session - User session
     * @param {Object} message - WhatsApp message
     */
    async handleDocumentUpload(session, message) {
        const phoneNumber = session.phoneNumber;

        // Check if message contains media
        if (message.type === 'document' || message.type === 'image') {
            await this.processMediaUpload(session, message);
        } else if (message.text?.body) {
            const text = message.text.body.toLowerCase().trim();
            
            // Handle special commands
            if (text === 'skip' || text === 'next') {
                await this.skipCurrentDocument(session);
            } else if (text === 'status' || text === 'progress') {
                await this.sendProgressStatus(session);
            } else if (text === 'restart' || text === 'reset') {
                await this.restartProcess(session);
            } else {
                await whatsappService.sendMessage(phoneNumber, 
                    "📎 Please upload a document file (PDF, image, or Word document).\n\n" +
                    "You can also type:\n" +
                    "• 'skip' to skip current document\n" +
                    "• 'status' to see progress\n" +
                    "• 'restart' to start over");
            }
        } else {
            await whatsappService.sendMessage(phoneNumber, 
                "📎 Please upload a document file (PDF, image, or Word document).");
        }
    }

    /**
     * Process media upload from WhatsApp
     * @param {Object} session - User session
     * @param {Object} message - WhatsApp message with media
     */
    async processMediaUpload(session, message) {
        const phoneNumber = session.phoneNumber;
        
        try {
            // Get current required document
            const currentDocument = sessionManager.getCurrentRequiredDocument(phoneNumber);
            
            if (!currentDocument) {
                await whatsappService.sendMessage(phoneNumber, 
                    "✅ All documents have been collected! Processing your application...");
                await this.completeDocumentCollection(session);
                return;
            }

            await whatsappService.sendMessage(phoneNumber, "⏳ Processing your document...");

            // Extract media information
            let mediaId, fileName, mimeType;
            
            if (message.type === 'document') {
                mediaId = message.document.id;
                fileName = message.document.filename || 'document';
                mimeType = message.document.mime_type;
            } else if (message.type === 'image') {
                mediaId = message.image.id;
                fileName = 'image.jpg';
                mimeType = 'image/jpeg';
            }

            // Download media from WhatsApp
            const mediaData = await whatsappService.downloadMedia(mediaId);
            
            // Save file to user directory
            const fileInfo = await fileHandler.saveFile(
                phoneNumber,
                session.loanType,
                currentDocument,
                mediaData.buffer,
                fileName,
                mimeType
            );

            // Add to session
            sessionManager.addUploadedDocument(phoneNumber, fileInfo);
            sessionManager.nextDocument(phoneNumber);

            // Send confirmation
            await whatsappService.sendMessage(phoneNumber, 
                `✅ Document uploaded successfully!\n\n` +
                `📄 *${currentDocument}*\n` +
                `📁 File: ${fileName}\n` +
                `📊 Size: ${fileHandler.formatFileSize(fileInfo.fileSize)}`);

            // Check if more documents needed
            if (sessionManager.isDocumentCollectionComplete(phoneNumber)) {
                await whatsappService.sendMessage(phoneNumber, 
                    "🎉 All documents collected! Processing your application...");
                await this.completeDocumentCollection(session);
            } else {
                await this.requestNextDocument(session);
            }

        } catch (error) {
            logger.error('Error processing media upload:', error);
            await whatsappService.sendMessage(phoneNumber, 
                "❌ Sorry, there was an error processing your document. Please try uploading again.");
        }
    }

    /**
     * Request the next required document
     * @param {Object} session - User session
     */
    async requestNextDocument(session) {
        const phoneNumber = session.phoneNumber;
        const currentDocument = sessionManager.getCurrentRequiredDocument(phoneNumber);
        
        if (!currentDocument) {
            await this.completeDocumentCollection(session);
            return;
        }

        const progress = session.uploadedDocuments.length;
        const total = session.requiredDocuments.length;
        const description = documentRequirements.getDocumentDescription(currentDocument);

        const requestMessage = `📋 Document ${progress + 1} of ${total}

📄 *${currentDocument}*

${description}

📎 Please upload this document as a file (PDF, image, or Word document).

Progress: ${progress}/${total} ✅`;

        await whatsappService.sendMessage(phoneNumber, requestMessage);
    }

    /**
     * Complete document collection process
     * @param {Object} session - User session
     */
    async completeDocumentCollection(session) {
        const phoneNumber = session.phoneNumber;
        
        try {
            await whatsappService.sendMessage(phoneNumber, 
                "📦 Creating document package...");

            // Create zip file
            const zipInfo = await fileHandler.createUserZip(phoneNumber, session.loanType);

            // Send via email
            const emailResult = await emailService.sendDocumentPackage({
                zipPath: zipInfo.filePath,
                phoneNumber,
                loanType: session.loanType,
                employmentType: session.employmentType,
                documentList: session.uploadedDocuments
            });

            // Clean up zip file after sending
            setTimeout(() => {
                fileHandler.deleteZipFile(zipInfo.filePath);
            }, 5000);

            // Send completion message
            const completionMessage = `✅ *All documents received successfully!*

📊 *Application Summary:*
• Loan Type: ${session.loanType} Loan
• Employment: ${session.employmentType}
• Documents: ${session.uploadedDocuments.length} files uploaded
• Package Size: ${fileHandler.formatFileSize(zipInfo.fileSize)}

📧 Your documents have been forwarded to our loan experts for review.

🎯 *Next Steps:*
• Our team will review your application within 24-48 hours
• You'll receive a call for any additional information needed
• Loan approval decision will be communicated within 3-5 business days

📞 *Need assistance?* Contact our support team at: +91-XXXXXXXXXX

Thank you for choosing our loan services! 🏦`;

            await whatsappService.sendMessage(phoneNumber, completionMessage);

            // Update session state
            sessionManager.setState(phoneNumber, this.STATES.COMPLETED);

            logger.logSessionActivity(phoneNumber, 'application_completed', this.STATES.COMPLETED, {
                loanType: session.loanType,
                employmentType: session.employmentType,
                documentCount: session.uploadedDocuments.length,
                emailResult
            });

        } catch (error) {
            logger.error('Error completing document collection:', error);
            await whatsappService.sendMessage(phoneNumber, 
                "❌ There was an error processing your application. Our team has been notified and will contact you shortly.");
        }
    }

    /**
     * Handle messages when application is completed
     * @param {Object} session - User session
     * @param {Object} message - WhatsApp message
     */
    async handleCompletedState(session, message) {
        const phoneNumber = session.phoneNumber;
        
        if (message.text?.body) {
            const text = message.text.body.toLowerCase().trim();
            
            if (text.includes('new') || text.includes('start') || text.includes('another')) {
                await whatsappService.sendMessage(phoneNumber, 
                    "🆕 Starting a new loan application...");
                sessionManager.resetSession(phoneNumber);
                await this.handleInitialMessage(sessionManager.getSession(phoneNumber), message);
            } else if (text.includes('status') || text.includes('progress')) {
                await whatsappService.sendMessage(phoneNumber, 
                    `✅ Your ${session.loanType} loan application is completed and under review.\n\n` +
                    "Our team will contact you within 24-48 hours.\n\n" +
                    "📞 Support: +91-XXXXXXXXXX");
            } else {
                await whatsappService.sendMessage(phoneNumber, 
                    "✅ Your application is complete and under review.\n\n" +
                    "Type 'new' to start another application or 'status' to check your current application status.");
            }
        }
    }

    /**
     * Handle unknown state
     * @param {Object} session - User session
     * @param {Object} message - WhatsApp message
     */
    async handleUnknownState(session, message) {
        const phoneNumber = session.phoneNumber;
        
        logger.warn(`Unknown session state: ${session.state} for ${phoneNumber}`);
        
        await whatsappService.sendMessage(phoneNumber, 
            "🔄 Something went wrong. Let me restart our conversation.");
        
        sessionManager.resetSession(phoneNumber);
        await this.handleInitialMessage(sessionManager.getSession(phoneNumber), message);
    }

    /**
     * Skip current document
     * @param {Object} session - User session
     */
    async skipCurrentDocument(session) {
        const phoneNumber = session.phoneNumber;
        const currentDocument = sessionManager.getCurrentRequiredDocument(phoneNumber);
        
        if (!currentDocument) {
            await whatsappService.sendMessage(phoneNumber, "No document to skip.");
            return;
        }

        sessionManager.nextDocument(phoneNumber);
        
        await whatsappService.sendMessage(phoneNumber, 
            `⏭️ Skipped: ${currentDocument}`);

        if (sessionManager.isDocumentCollectionComplete(phoneNumber)) {
            await this.completeDocumentCollection(session);
        } else {
            await this.requestNextDocument(session);
        }
    }

    /**
     * Send progress status
     * @param {Object} session - User session
     */
    async sendProgressStatus(session) {
        const phoneNumber = session.phoneNumber;
        const uploaded = session.uploadedDocuments.length;
        const total = session.requiredDocuments.length;
        const remaining = sessionManager.getRemainingDocuments(phoneNumber);

        const statusMessage = `📊 *Application Progress*

✅ Uploaded: ${uploaded}/${total} documents
📋 Remaining: ${remaining.length} documents

${remaining.length > 0 ? 
    `*Next documents needed:*\n${remaining.slice(0, 3).map((doc, i) => `${i + 1}. ${doc}`).join('\n')}` : 
    '🎉 All documents collected!'
}`;

        await whatsappService.sendMessage(phoneNumber, statusMessage);
    }

    /**
     * Restart the application process
     * @param {Object} session - User session
     */
    async restartProcess(session) {
        const phoneNumber = session.phoneNumber;
        
        await whatsappService.sendMessage(phoneNumber, 
            "🔄 Restarting your loan application...");
        
        sessionManager.resetSession(phoneNumber);
        await this.handleInitialMessage(sessionManager.getSession(phoneNumber), {});
    }

    /**
     * Send error message
     * @param {string} phoneNumber - User's phone number
     */
    async sendErrorMessage(phoneNumber) {
        await whatsappService.sendMessage(phoneNumber, 
            "❌ Sorry, something went wrong. Please try again or type 'restart' to start over.");
    }
}

module.exports = new WebhookController();
