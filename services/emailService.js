const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Email service for sending document packages to the loan team
 */
class EmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
        this.initializeTransporter();
    }

    /**
     * Initialize email transporter with configuration
     */
    initializeTransporter() {
        try {
            const emailConfig = {
                host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.EMAIL_PORT) || 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            };

            // Check if email credentials are provided
            if (!emailConfig.auth.user || !emailConfig.auth.pass) {
                logger.warn('Email credentials not found in environment variables');
                logger.warn('Email service will be simulated');
                return;
            }

            this.transporter = nodemailer.createTransporter(emailConfig);
            this.isConfigured = true;

            // Verify connection
            this.transporter.verify((error, success) => {
                if (error) {
                    logger.error('Email transporter verification failed:', error);
                    this.isConfigured = false;
                } else {
                    logger.info('Email service initialized successfully');
                }
            });

        } catch (error) {
            logger.error('Error initializing email service:', error);
            this.isConfigured = false;
        }
    }

    /**
     * Send loan document package via email
     * @param {Object} packageInfo - Package information
     * @param {string} packageInfo.zipPath - Path to zip file
     * @param {string} packageInfo.phoneNumber - User's phone number
     * @param {string} packageInfo.loanType - Type of loan
     * @param {string} packageInfo.employmentType - Employment type
     * @param {Array} packageInfo.documentList - List of uploaded documents
     * @returns {Promise<Object>} Email send result
     */
    async sendDocumentPackage(packageInfo) {
        try {
            const {
                zipPath,
                phoneNumber,
                loanType,
                employmentType,
                documentList = []
            } = packageInfo;

            // Check if zip file exists
            if (!fs.existsSync(zipPath)) {
                throw new Error('Zip file not found');
            }

            const zipStats = fs.statSync(zipPath);
            const zipFileName = path.basename(zipPath);

            // Prepare email content
            const emailContent = this.generateEmailContent({
                phoneNumber,
                loanType,
                employmentType,
                documentList,
                zipFileName,
                zipSize: this.formatFileSize(zipStats.size)
            });

            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: process.env.EMAIL_TO || 'team@example.com',
                subject: `Loan Application Documents - ${loanType} Loan - ${phoneNumber}`,
                html: emailContent.html,
                text: emailContent.text,
                attachments: [
                    {
                        filename: zipFileName,
                        path: zipPath,
                        contentType: 'application/zip'
                    }
                ]
            };

            if (this.isConfigured && this.transporter) {
                // Send actual email
                const info = await this.transporter.sendMail(mailOptions);
                logger.info(`Email sent successfully: ${info.messageId}`);
                
                return {
                    success: true,
                    messageId: info.messageId,
                    method: 'email',
                    recipient: mailOptions.to,
                    attachmentSize: this.formatFileSize(zipStats.size)
                };
            } else {
                // Simulate email sending
                logger.info('Simulating email send (no email configuration found)');
                return this.simulateEmailSend(mailOptions, zipStats.size);
            }

        } catch (error) {
            logger.error('Error sending email:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    /**
     * Generate email content (HTML and text versions)
     * @param {Object} params - Email content parameters
     * @returns {Object} Email content object
     */
    generateEmailContent(params) {
        const {
            phoneNumber,
            loanType,
            employmentType,
            documentList,
            zipFileName,
            zipSize
        } = params;

        const currentDate = new Date().toLocaleString();

        // HTML version
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .info-section { background-color: #f9f9f9; padding: 15px; margin: 10px 0; border-radius: 5px; }
                    .document-list { background-color: #fff; border: 1px solid #ddd; border-radius: 5px; padding: 15px; }
                    .document-item { padding: 5px 0; border-bottom: 1px solid #eee; }
                    .document-item:last-child { border-bottom: none; }
                    .footer { background-color: #f1f1f1; padding: 15px; text-align: center; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🏦 Loan Application Documents</h1>
                    <p>New loan application documents received</p>
                </div>
                
                <div class="content">
                    <div class="info-section">
                        <h2>📋 Application Details</h2>
                        <p><strong>Phone Number:</strong> ${phoneNumber}</p>
                        <p><strong>Loan Type:</strong> ${loanType} Loan</p>
                        <p><strong>Employment Type:</strong> ${employmentType}</p>
                        <p><strong>Submission Date:</strong> ${currentDate}</p>
                        <p><strong>Document Package:</strong> ${zipFileName} (${zipSize})</p>
                    </div>
                    
                    <div class="document-list">
                        <h3>📄 Uploaded Documents</h3>
                        ${documentList.map(doc => `
                            <div class="document-item">
                                <strong>${doc.documentType}</strong><br>
                                <small>File: ${doc.originalFileName} | Size: ${this.formatFileSize(doc.fileSize)} | Uploaded: ${new Date(doc.uploadedAt).toLocaleString()}</small>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="info-section">
                        <h3>🚀 Next Steps</h3>
                        <ol>
                            <li>Download and extract the attached document package</li>
                            <li>Review all submitted documents for completeness</li>
                            <li>Contact the applicant at ${phoneNumber} for any clarifications</li>
                            <li>Proceed with loan application processing</li>
                        </ol>
                    </div>
                </div>
                
                <div class="footer">
                    <p>This email was automatically generated by the WhatsApp Loan Document Collection Bot</p>
                    <p>Generated on ${currentDate}</p>
                </div>
            </body>
            </html>
        `;

        // Text version
        const text = `
LOAN APPLICATION DOCUMENTS
=========================

Application Details:
- Phone Number: ${phoneNumber}
- Loan Type: ${loanType} Loan
- Employment Type: ${employmentType}
- Submission Date: ${currentDate}
- Document Package: ${zipFileName} (${zipSize})

Uploaded Documents:
${documentList.map(doc => `- ${doc.documentType}: ${doc.originalFileName} (${this.formatFileSize(doc.fileSize)})`).join('\n')}

Next Steps:
1. Download and extract the attached document package
2. Review all submitted documents for completeness
3. Contact the applicant at ${phoneNumber} for any clarifications
4. Proceed with loan application processing

---
This email was automatically generated by the WhatsApp Loan Document Collection Bot
Generated on ${currentDate}
        `;

        return { html, text };
    }

    /**
     * Simulate email sending when email is not configured
     * @param {Object} mailOptions - Email options
     * @param {number} attachmentSize - Size of attachment
     * @returns {Object} Simulation result
     */
    simulateEmailSend(mailOptions, attachmentSize) {
        const simulatedMessageId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        logger.info('EMAIL SIMULATION', {
            to: mailOptions.to,
            subject: mailOptions.subject,
            attachmentSize: this.formatFileSize(attachmentSize),
            messageId: simulatedMessageId
        });

        return {
            success: true,
            messageId: simulatedMessageId,
            method: 'simulation',
            recipient: mailOptions.to,
            attachmentSize: this.formatFileSize(attachmentSize),
            note: 'Email was simulated - no actual email sent'
        };
    }

    /**
     * Send notification email to user (optional feature)
     * @param {string} phoneNumber - User's phone number
     * @param {string} loanType - Type of loan
     * @param {string} userEmail - User's email (if available)
     * @returns {Promise<Object>} Email send result
     */
    async sendUserNotification(phoneNumber, loanType, userEmail = null) {
        if (!userEmail || !this.isConfigured) {
            logger.info('User notification not sent - no email or service not configured');
            return { success: false, reason: 'No email address or service not configured' };
        }

        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: userEmail,
                subject: `Loan Application Received - ${loanType} Loan`,
                html: `
                    <h2>Thank you for your loan application!</h2>
                    <p>We have successfully received all your documents for your ${loanType} loan application.</p>
                    <p>Our loan experts will review your application and contact you shortly.</p>
                    <p>Reference: ${phoneNumber}</p>
                    <br>
                    <p>Best regards,<br>Loan Team</p>
                `,
                text: `
Thank you for your loan application!

We have successfully received all your documents for your ${loanType} loan application.
Our loan experts will review your application and contact you shortly.

Reference: ${phoneNumber}

Best regards,
Loan Team
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            logger.info(`User notification sent: ${info.messageId}`);
            
            return {
                success: true,
                messageId: info.messageId,
                recipient: userEmail
            };

        } catch (error) {
            logger.error('Error sending user notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Test email configuration
     * @returns {Promise<Object>} Test result
     */
    async testEmailConfig() {
        if (!this.isConfigured || !this.transporter) {
            return { success: false, error: 'Email service not configured' };
        }

        try {
            await this.transporter.verify();
            return { success: true, message: 'Email configuration is valid' };
        } catch (error) {
            return { success: false, error: error.message };
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

    /**
     * Get email service status
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            configured: this.isConfigured,
            host: process.env.EMAIL_HOST || 'not configured',
            port: process.env.EMAIL_PORT || 'not configured',
            user: process.env.EMAIL_USER ? 'configured' : 'not configured',
            ready: this.isConfigured && this.transporter !== null
        };
    }
}

module.exports = EmailService; // 

