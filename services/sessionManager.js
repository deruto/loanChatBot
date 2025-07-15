const logger = require('../utils/logger');

/**
 * In-memory session manager for tracking user conversations
 * Each session contains user state, progress, and collected data
 */
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        
        // Clean up expired sessions every 5 minutes
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000);
    }

    /**
     * Get or create a session for a user
     * @param {string} phoneNumber - User's phone number
     * @returns {Object} User session
     */
    getSession(phoneNumber) {
        if (!this.sessions.has(phoneNumber)) {
            this.createSession(phoneNumber);
        }
        
        const session = this.sessions.get(phoneNumber);
        session.lastActivity = Date.now();
        return session;
    }

    /**
     * Create a new session for a user
     * @param {string} phoneNumber - User's phone number
     * @returns {Object} New session
     */
    createSession(phoneNumber) {
        const session = {
            phoneNumber,
            state: 'INITIAL', // Current conversation state
            loanType: null,
            employmentType: null,
            requiredDocuments: [],
            uploadedDocuments: [],
            currentDocumentIndex: 0,
            userData: {},
            createdAt: Date.now(),
            lastActivity: Date.now()
        };

        this.sessions.set(phoneNumber, session);
        logger.info(`New session created for ${phoneNumber}`);
        return session;
    }

    /**
     * Update session data
     * @param {string} phoneNumber - User's phone number
     * @param {Object} updates - Data to update
     * @returns {Object} Updated session
     */
    updateSession(phoneNumber, updates) {
        const session = this.getSession(phoneNumber);
        Object.assign(session, updates);
        session.lastActivity = Date.now();
        
        logger.debug(`Session updated for ${phoneNumber}:`, updates);
        return session;
    }

    /**
     * Set the conversation state
     * @param {string} phoneNumber - User's phone number
     * @param {string} state - New state
     * @returns {Object} Updated session
     */
    setState(phoneNumber, state) {
        return this.updateSession(phoneNumber, { state });
    }

    /**
     * Set loan type and employment type
     * @param {string} phoneNumber - User's phone number
     * @param {string} loanType - Type of loan
     * @param {string} employmentType - Employment type
     * @returns {Object} Updated session
     */
    setLoanDetails(phoneNumber, loanType, employmentType = null) {
        const updates = { loanType };
        if (employmentType) {
            updates.employmentType = employmentType;
        }
        return this.updateSession(phoneNumber, updates);
    }

    /**
     * Set required documents list
     * @param {string} phoneNumber - User's phone number
     * @param {Array} documents - List of required documents
     * @returns {Object} Updated session
     */
    setRequiredDocuments(phoneNumber, documents) {
        return this.updateSession(phoneNumber, { 
            requiredDocuments: documents,
            currentDocumentIndex: 0,
            uploadedDocuments: []
        });
    }

    /**
     * Add an uploaded document
     * @param {string} phoneNumber - User's phone number
     * @param {Object} documentInfo - Document information
     * @returns {Object} Updated session
     */
    addUploadedDocument(phoneNumber, documentInfo) {
        const session = this.getSession(phoneNumber);
        session.uploadedDocuments.push({
            ...documentInfo,
            uploadedAt: Date.now()
        });
        session.lastActivity = Date.now();
        
        logger.info(`Document uploaded for ${phoneNumber}: ${documentInfo.type}`);
        return session;
    }

    /**
     * Move to next required document
     * @param {string} phoneNumber - User's phone number
     * @returns {Object} Updated session
     */
    nextDocument(phoneNumber) {
        const session = this.getSession(phoneNumber);
        session.currentDocumentIndex++;
        session.lastActivity = Date.now();
        return session;
    }

    /**
     * Check if all documents are collected
     * @param {string} phoneNumber - User's phone number
     * @returns {boolean} True if all documents collected
     */
    isDocumentCollectionComplete(phoneNumber) {
        const session = this.getSession(phoneNumber);
        return session.uploadedDocuments.length >= session.requiredDocuments.length;
    }

    /**
     * Get the current required document
     * @param {string} phoneNumber - User's phone number
     * @returns {string|null} Current document type or null if complete
     */
    getCurrentRequiredDocument(phoneNumber) {
        const session = this.getSession(phoneNumber);
        
        if (session.currentDocumentIndex >= session.requiredDocuments.length) {
            return null; // All documents collected
        }
        
        return session.requiredDocuments[session.currentDocumentIndex];
    }

    /**
     * Get remaining documents to upload
     * @param {string} phoneNumber - User's phone number
     * @returns {Array} List of remaining documents
     */
    getRemainingDocuments(phoneNumber) {
        const session = this.getSession(phoneNumber);
        return session.requiredDocuments.slice(session.currentDocumentIndex);
    }

    /**
     * Reset session to initial state
     * @param {string} phoneNumber - User's phone number
     * @returns {Object} Reset session
     */
    resetSession(phoneNumber) {
        const session = {
            phoneNumber,
            state: 'INITIAL',
            loanType: null,
            employmentType: null,
            requiredDocuments: [],
            uploadedDocuments: [],
            currentDocumentIndex: 0,
            userData: {},
            createdAt: Date.now(),
            lastActivity: Date.now()
        };

        this.sessions.set(phoneNumber, session);
        logger.info(`Session reset for ${phoneNumber}`);
        return session;
    }

    /**
     * Delete a session
     * @param {string} phoneNumber - User's phone number
     */
    deleteSession(phoneNumber) {
        if (this.sessions.has(phoneNumber)) {
            this.sessions.delete(phoneNumber);
            logger.info(`Session deleted for ${phoneNumber}`);
        }
    }

    /**
     * Get all active sessions
     * @returns {Array} Array of session objects
     */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }

    /**
     * Get session statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        const now = Date.now();
        const activeSessions = Array.from(this.sessions.values());
        
        return {
            totalSessions: activeSessions.length,
            activeLastHour: activeSessions.filter(s => now - s.lastActivity < 60 * 60 * 1000).length,
            byState: activeSessions.reduce((acc, session) => {
                acc[session.state] = (acc[session.state] || 0) + 1;
                return acc;
            }, {}),
            byLoanType: activeSessions.reduce((acc, session) => {
                if (session.loanType) {
                    acc[session.loanType] = (acc[session.loanType] || 0) + 1;
                }
                return acc;
            }, {})
        };
    }

    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [phoneNumber, session] of this.sessions.entries()) {
            if (now - session.lastActivity > this.sessionTimeout) {
                this.sessions.delete(phoneNumber);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.info(`Cleaned up ${cleanedCount} expired sessions`);
        }
    }

    /**
     * Export session data (for debugging or backup)
     * @param {string} phoneNumber - User's phone number
     * @returns {Object} Session data
     */
    exportSession(phoneNumber) {
        return this.sessions.get(phoneNumber) || null;
    }
}

module.exports = new SessionManager();
