// Full WhatsApp bot webhook handler for Vercel serverless

// Dynamic imports for serverless compatibility
let WhatsAppService, SessionManager, DocumentRequirements, FileHandler, EmailService;

// Simple console logger for serverless
const logger = {
    info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
    error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
    debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data || '')
};

// Services will be initialized on demand
let whatsappService, sessionManager, documentRequirements, fileHandler, emailService;

// Initialize services function
async function initializeServices() {
    if (!whatsappService || !sessionManager || !documentRequirements || !fileHandler || !emailService) {
        logger.info('Initializing services...');
    try {
        const WhatsAppServiceClass = require('../services/whatsappService');
        const SessionManagerClass = require('../services/sessionManager');
        const DocumentRequirementsClass = require('../services/documentRequirements');
        const FileHandlerClass = require('../services/fileHandler');
        const EmailServiceClass = require('../services/emailService');

        whatsappService = new WhatsAppServiceClass();
        sessionManager = new SessionManagerClass();
        documentRequirements = new DocumentRequirementsClass();
        fileHandler = new FileHandlerClass();
        emailService = new EmailServiceClass();

        logger.info('✅ All services initialized.');
    } catch (error) {
        logger.error('❌ Failed to initialize services:', error);
        throw error;
    }
}

}

// Webhook controller logic adapted for serverless
class ServerlessWebhookController {
    async processMessage(messageData) {
        try {
            const phoneNumber = messageData.from;
            const message = messageData;
            
            logger.info('Processing message', { phoneNumber, messageType: message.type });
            
            // Get or create session
            const session = sessionManager.getSession(phoneNumber);
            
            // Route message based on current state
            await this.routeMessage(session, message);
            
        } catch (error) {
            logger.error('Error processing message:', error);
            await this.sendErrorMessage(messageData.from);
        }
    }
    
    async routeMessage(session, message) {
        switch (session.state) {
            case 'INITIAL':
                await this.handleInitialMessage(session, message);
                break;
            case 'WAITING_LOAN_TYPE':
                await this.handleLoanTypeSelection(session, message);
                break;
            case 'WAITING_EMPLOYMENT_TYPE':
                await this.handleEmploymentTypeSelection(session, message);
                break;
            case 'COLLECTING_DOCUMENTS':
                await this.handleDocumentUpload(session, message);
                break;
            case 'COMPLETED':
                await this.handleCompletedState(session, message);
                break;
            default:
                await this.handleUnknownState(session, message);
        }
    }
    
    async handleInitialMessage(session, message) {
        sessionManager.setState(session.phoneNumber, 'WAITING_LOAN_TYPE');
        
        const loanTypes = documentRequirements.getAvailableLoanTypes();
        const options = loanTypes.map((type, index) => `${index + 1}. ${type.name}`).join('\n');
        
        const welcomeMessage = `🏦 Welcome to the Loan Document Collection Service!

I'll help you collect the required documents for your loan application.

Please select your loan type:
${options}

Reply with the number of your choice (1-${loanTypes.length}).`;

        await whatsappService.sendMessage(session.phoneNumber, welcomeMessage);
        logger.info('Sent welcome message', { phoneNumber: session.phoneNumber });
    }
    
    async handleLoanTypeSelection(session, message) {
        const messageText = message.text?.body?.trim();
        const loanTypes = documentRequirements.getAvailableLoanTypes();
        
        let selectedLoanType = null;
        
        // Try to match by number
        const choice = parseInt(messageText);
        if (choice >= 1 && choice <= loanTypes.length) {
            selectedLoanType = loanTypes[choice - 1].key;
        } else {
            // Try to match by name
            selectedLoanType = documentRequirements.normalizeLoanType(messageText);
        }
        
        if (selectedLoanType) {
            sessionManager.setLoanDetails(session.phoneNumber, selectedLoanType);
            sessionManager.setState(session.phoneNumber, 'WAITING_EMPLOYMENT_TYPE');
            
            const employmentTypes = documentRequirements.getAvailableEmploymentTypes();
            const options = employmentTypes.map((type, index) => `${index + 1}. ${type.name}`).join('\n');
            
            const message = `Great! You selected: ${loanTypes.find(t => t.key === selectedLoanType).name}

Now, please select your employment type:
${options}

Reply with the number of your choice (1-${employmentTypes.length}).`;

            await whatsappService.sendMessage(session.phoneNumber, message);
        } else {
            const options = loanTypes.map((type, index) => `${index + 1}. ${type.name}`).join('\n');
            await whatsappService.sendMessage(
                session.phoneNumber,
                `Please select a valid loan type by replying with a number:\n${options}`
            );
        }
    }
    
    async handleEmploymentTypeSelection(session, message) {
        const messageText = message.text?.body?.trim();
        const employmentTypes = documentRequirements.getAvailableEmploymentTypes();
        
        let selectedEmploymentType = null;
        
        // Try to match by number
        const choice = parseInt(messageText);
        if (choice >= 1 && choice <= employmentTypes.length) {
            selectedEmploymentType = employmentTypes[choice - 1].key;
        } else {
            // Try to match by name
            selectedEmploymentType = documentRequirements.normalizeEmploymentType(messageText);
        }
        
        if (selectedEmploymentType) {
            sessionManager.setLoanDetails(session.phoneNumber, session.loanType, selectedEmploymentType);
            
            // Get required documents
            const requiredDocs = documentRequirements.getRequiredDocuments(session.loanType, selectedEmploymentType);
            sessionManager.setRequiredDocuments(session.phoneNumber, requiredDocs);
            sessionManager.setState(session.phoneNumber, 'COLLECTING_DOCUMENTS');
            
            const empType = employmentTypes.find(t => t.key === selectedEmploymentType);
            await whatsappService.sendMessage(
                session.phoneNumber,
                `Perfect! Employment type: ${empType.name}

📋 Required documents for your application:
${requiredDocs.map((doc, index) => `${index + 1}. ${documentRequirements.getDocumentDescription(doc)}`).join('\n')}

Let's start collecting your documents. Please send me your first document: **${documentRequirements.getDocumentDescription(requiredDocs[0])}**

You can send photos or PDF files. Type "skip" to skip a document or "status" to see your progress.`
            );
        } else {
            const options = employmentTypes.map((type, index) => `${index + 1}. ${type.name}`).join('\n');
            await whatsappService.sendMessage(
                session.phoneNumber,
                `Please select a valid employment type by replying with a number:\n${options}`
            );
        }
    }
    
    async handleDocumentUpload(session, message) {
        const messageText = message.text?.body?.toLowerCase().trim();
        
        // Handle commands
        if (messageText === 'skip') {
            await this.skipCurrentDocument(session);
            return;
        }
        
        if (messageText === 'status') {
            await this.sendProgressStatus(session);
            return;
        }
        
        if (messageText === 'restart') {
            await this.restartProcess(session);
            return;
        }
        
        // Handle media upload
        if (message.type === 'image' || message.type === 'document') {
            await this.processMediaUpload(session, message);
        } else {
            const currentDoc = sessionManager.getCurrentRequiredDocument(session.phoneNumber);
            await whatsappService.sendMessage(
                session.phoneNumber,
                `Please send me your **${documentRequirements.getDocumentDescription(currentDoc)}** as a photo or PDF file.

Commands:
• Type "skip" to skip this document
• Type "status" to see your progress
• Type "restart" to start over`
            );
        }
    }
    
    async processMediaUpload(session, message) {
        try {
            const currentDoc = sessionManager.getCurrentRequiredDocument(session.phoneNumber);
            
            // In serverless environment, we'll simulate file storage
            const documentInfo = {
                type: currentDoc,
                messageId: message.id,
                timestamp: new Date().toISOString(),
                mediaType: message.type
            };
            
            sessionManager.addUploadedDocument(session.phoneNumber, documentInfo);
            sessionManager.nextDocument(session.phoneNumber);
            
            await whatsappService.sendMessage(
                session.phoneNumber,
                `✅ Received your ${documentRequirements.getDocumentDescription(currentDoc)}!`
            );
            
            // Check if collection is complete
            if (sessionManager.isDocumentCollectionComplete(session.phoneNumber)) {
                await this.completeDocumentCollection(session);
            } else {
                await this.requestNextDocument(session);
            }
            
        } catch (error) {
            logger.error('Error processing media upload:', error);
            await whatsappService.sendMessage(
                session.phoneNumber,
                'Sorry, there was an error processing your document. Please try uploading it again.'
            );
        }
    }
    
    async requestNextDocument(session) {
        const currentDoc = sessionManager.getCurrentRequiredDocument(session.phoneNumber);
        const remaining = sessionManager.getRemainingDocuments(session.phoneNumber);
        
        await whatsappService.sendMessage(
            session.phoneNumber,
            `📎 Please send me your **${documentRequirements.getDocumentDescription(currentDoc)}**

Remaining documents: ${remaining.length}`
        );
    }
    
    async completeDocumentCollection(session) {
        sessionManager.setState(session.phoneNumber, 'COMPLETED');
        
        const completionMessage = `🎉 Congratulations! All required documents have been collected.

📋 **Summary:**
• Loan Type: ${session.loanType}
• Employment: ${session.employmentType}
• Documents: ${session.uploadedDocuments.length} files received

Your application package has been prepared and will be forwarded to our loan processing team. You will receive an update within 24-48 hours.

Thank you for using our document collection service!

Type "restart" if you need to submit another application.`;

        await whatsappService.sendMessage(session.phoneNumber, completionMessage);
        
        // Log completion
        logger.info('Document collection completed', {
            phoneNumber: session.phoneNumber,
            loanType: session.loanType,
            documentCount: session.uploadedDocuments.length
        });
    }
    
    async handleCompletedState(session, message) {
        const messageText = message.text?.body?.toLowerCase().trim();
        
        if (messageText === 'restart') {
            await this.restartProcess(session);
        } else {
            await whatsappService.sendMessage(
                session.phoneNumber,
                `Your loan application is complete! Type "restart" to submit a new application.`
            );
        }
    }
    
    async handleUnknownState(session, message) {
        logger.warn('Unknown session state', { phoneNumber: session.phoneNumber, state: session.state });
        await this.restartProcess(session);
    }
    
    async skipCurrentDocument(session) {
        sessionManager.nextDocument(session.phoneNumber);
        
        if (sessionManager.isDocumentCollectionComplete(session.phoneNumber)) {
            await this.completeDocumentCollection(session);
        } else {
            await this.requestNextDocument(session);
        }
    }
    
    async sendProgressStatus(session) {
        const remaining = sessionManager.getRemainingDocuments(session.phoneNumber);
        const uploaded = session.uploadedDocuments.length;
        const total = session.requiredDocuments.length;
        
        const progress = `📊 **Document Collection Progress**

✅ Uploaded: ${uploaded}/${total}
📋 Remaining: ${remaining.length}

${remaining.length > 0 ? `Next: ${documentRequirements.getDocumentDescription(remaining[0])}` : 'All documents collected!'}`;

        await whatsappService.sendMessage(session.phoneNumber, progress);
    }
    
    async restartProcess(session) {
        sessionManager.resetSession(session.phoneNumber);
        await this.handleInitialMessage(session, {});
    }
    
    async sendErrorMessage(phoneNumber) {
        await whatsappService.sendMessage(
            phoneNumber,
            'Sorry, there was an error processing your request. Please try again or type "restart" to begin a new session.'
        );
    }
}

// Main serverless function handler
module.exports = async function handler(req, res) {
    try {
        const { method, query } = req;
        
        if (method === 'GET') {
            // Webhook verification - simple and reliable
            const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'loan_bot_verify_token';
            const mode = query['hub.mode'];
            const token = query['hub.verify_token'];
            const challenge = query['hub.challenge'];
            
            console.log('Webhook verification attempt:', { mode, token, challenge });
            
            if (mode && token) {
                if (mode === 'subscribe' && token === verifyToken) {
                    console.log('✅ Webhook verified successfully');
                    return res.status(200).send(challenge);
                } else {
                    console.log('❌ Webhook verification failed - token mismatch');
                    return res.status(403).json({ error: 'Forbidden' });
                }
            } else {
                console.log('❌ Webhook verification failed - missing parameters');
                return res.status(400).json({ error: 'Bad Request' });
            }
        }
        
        if (method === 'POST') {
            // Handle incoming webhook
            console.log('📨 Received webhook POST');
            
            try {
                // Initialize services only when needed
                await initializeServices();
                
                const body = req.body;
                console.log('Webhook body:', JSON.stringify(body, null, 2));
                
                // Validate webhook structure
                if (!body.entry || !Array.isArray(body.entry)) {
                    console.log('❌ Invalid webhook structure');
                    return res.status(400).json({ error: 'Invalid webhook structure' });
                }
                
                const webhookController = new ServerlessWebhookController();
                
                // Process each entry
                for (const entry of body.entry) {
                    if (entry.changes) {
                        for (const change of entry.changes) {
                            if (change.value && change.value.messages) {
                                for (const message of change.value.messages) {
                                    await webhookController.processMessage(message);
                                }
                            }
                        }
                    }
                }
                
                return res.status(200).json({ status: 'received' });
            } catch (serviceError) {
                console.error('Service initialization error:', serviceError);
                // Fallback: just acknowledge the webhook
                return res.status(200).json({ status: 'received', error: 'Service unavailable' });
            }
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Webhook handler error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}