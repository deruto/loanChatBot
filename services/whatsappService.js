const axios = require('axios');
const logger = require('../utils/logger');

class WhatsAppService {
    constructor() {
        this.token = process.env.WHATSAPP_TOKEN;
        this.phoneId = process.env.WHATSAPP_PHONE_ID;
        this.baseURL = `https://graph.facebook.com/v19.0/${this.phoneId}`;
        
        if (!this.token || !this.phoneId) {
            logger.error('WhatsApp credentials not found in environment variables');
        }
    }

    /**
     * Send a text message to a WhatsApp number
     * @param {string} to - Recipient phone number
     * @param {string} message - Message text
     * @returns {Promise<Object>} API response
     */
    async sendMessage(to, message) {
        try {
            const response = await axios.post(
                `${this.baseURL}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'text',
                    text: {
                        body: message
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logger.info(`Message sent to ${to}: ${message.substring(0, 50)}...`);
            return response.data;
        } catch (error) {
            logger.error('Error sending WhatsApp message:', {
                error: error.response?.data || error.message,
                to,
                message: message.substring(0, 50) + '...'
            });
            throw error;
        }
    }

    /**
     * Send an interactive button message
     * @param {string} to - Recipient phone number
     * @param {string} text - Message text
     * @param {Array} buttons - Array of button objects
     * @returns {Promise<Object>} API response
     */
    async sendButtonMessage(to, text, buttons) {
        try {
            const buttonComponents = buttons.map((button, index) => ({
                type: 'reply',
                reply: {
                    id: button.id || `btn_${index}`,
                    title: button.title
                }
            }));

            const response = await axios.post(
                `${this.baseURL}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        body: {
                            text: text
                        },
                        action: {
                            buttons: buttonComponents
                        }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logger.info(`Button message sent to ${to}`);
            return response.data;
        } catch (error) {
            logger.error('Error sending button message:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Send a list message
     * @param {string} to - Recipient phone number
     * @param {string} text - Message text
     * @param {string} buttonText - List button text
     * @param {Array} sections - Array of section objects with rows
     * @returns {Promise<Object>} API response
     */
    async sendListMessage(to, text, buttonText, sections) {
        try {
            const response = await axios.post(
                `${this.baseURL}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'list',
                        body: {
                            text: text
                        },
                        action: {
                            button: buttonText,
                            sections: sections
                        }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logger.info(`List message sent to ${to}`);
            return response.data;
        } catch (error) {
            logger.error('Error sending list message:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Download media file from WhatsApp
     * @param {string} mediaId - Media ID from WhatsApp
     * @returns {Promise<Buffer>} File buffer
     */
    async downloadMedia(mediaId) {
        try {
            // First, get the media URL
            const mediaResponse = await axios.get(
                `https://graph.facebook.com/v19.0/${mediaId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                }
            );

            const mediaUrl = mediaResponse.data.url;

            // Download the actual file
            const fileResponse = await axios.get(mediaUrl, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                responseType: 'arraybuffer'
            });

            logger.info(`Media downloaded: ${mediaId}`);
            return {
                buffer: Buffer.from(fileResponse.data),
                mimeType: mediaResponse.data.mime_type,
                fileName: mediaResponse.data.filename || `file_${Date.now()}`
            };
        } catch (error) {
            logger.error('Error downloading media:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Mark message as read
     * @param {string} messageId - Message ID to mark as read
     * @returns {Promise<Object>} API response
     */
    async markAsRead(messageId) {
        try {
            const response = await axios.post(
                `${this.baseURL}/messages`,
                {
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: messageId
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            logger.error('Error marking message as read:', error.response?.data || error.message);
            // Don't throw here as this is not critical
        }
    }

    /**
     * Get WhatsApp Business Profile
     * @returns {Promise<Object>} Profile data
     */
    async getProfile() {
        try {
            const response = await axios.get(
                `https://graph.facebook.com/v19.0/${this.phoneId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            logger.error('Error getting profile:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = WhatsAppService;
