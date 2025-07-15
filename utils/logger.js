/**
 * Simple logging utility with different log levels (Vercel-compatible)
 */
class Logger {
    constructor() {
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        this.currentLevel = this.logLevels[process.env.LOG_LEVEL] || this.logLevels.info;
        this.isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    }

    /**
     * Format log message with timestamp and level
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {*} data - Additional data to log
     * @returns {string} Formatted log message
     */
    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const pid = process.pid;
        
        let formattedMessage = `[${timestamp}] [${pid}] [${level.toUpperCase()}] ${message}`;
        
        if (data !== null) {
            if (typeof data === 'object') {
                formattedMessage += '\n' + JSON.stringify(data, null, 2);
            } else {
                formattedMessage += ` ${data}`;
            }
        }
        
        return formattedMessage;
    }

    /**
     * Write log to file (disabled in production/Vercel)
     * @param {string} logFile - Path to log file
     * @param {string} message - Formatted log message
     */
    writeToFile(logFile, message) {
        // Skip file writing in production/Vercel environment
        if (this.isVercel) {
            return;
        }
        
        try {
            const fs = require('fs');
            const path = require('path');
            
            // Ensure directory exists only in non-production
            const logDir = path.dirname(logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            fs.appendFileSync(logFile, message + '\n');
        } catch (error) {
            // Silently fail in production
            if (!this.isVercel) {
                console.error('Failed to write to log file:', error);
            }
        }
    }

    /**
     * Log message with specified level
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {*} data - Additional data
     */
    log(level, message, data = null) {
        const levelValue = this.logLevels[level];
        
        if (levelValue === undefined || levelValue > this.currentLevel) {
            return; // Skip logging if level is higher than current level
        }
        
        const formattedMessage = this.formatMessage(level, message, data);
        
        // Console output with colors
        const colors = {
            error: '\x1b[31m', // Red
            warn: '\x1b[33m',  // Yellow
            info: '\x1b[36m',  // Cyan
            debug: '\x1b[37m'  // White
        };
        
        const reset = '\x1b[0m';
        const colorCode = colors[level] || '';
        
        console.log(`${colorCode}${formattedMessage}${reset}`);
        
        // File output (only in development)
        if (!this.isVercel) {
            const path = require('path');
            const logFile = path.join(__dirname, '..', 'logs', 'app.log');
            const errorFile = path.join(__dirname, '..', 'logs', 'error.log');
            
            this.writeToFile(logFile, formattedMessage);
            
            // Error logs also go to error file
            if (level === 'error') {
                this.writeToFile(errorFile, formattedMessage);
            }
        }
    }

    /**
     * Log error message
     * @param {string} message - Error message
     * @param {*} data - Additional error data
     */
    error(message, data = null) {
        this.log('error', message, data);
    }

    /**
     * Log warning message
     * @param {string} message - Warning message
     * @param {*} data - Additional data
     */
    warn(message, data = null) {
        this.log('warn', message, data);
    }

    /**
     * Log info message
     * @param {string} message - Info message
     * @param {*} data - Additional data
     */
    info(message, data = null) {
        this.log('info', message, data);
    }

    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {*} data - Additional data
     */
    debug(message, data = null) {
        this.log('debug', message, data);
    }

    /**
     * Log HTTP request
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {number} duration - Request duration in ms
     */
    logRequest(req, res, duration = null) {
        const method = req.method;
        const url = req.url;
        const statusCode = res.statusCode;
        const userAgent = req.get('User-Agent') || 'Unknown';
        const ip = req.ip || req.connection.remoteAddress;
        
        let message = `${method} ${url} ${statusCode}`;
        if (duration !== null) {
            message += ` - ${duration}ms`;
        }
        
        const logData = {
            method,
            url,
            statusCode,
            userAgent,
            ip,
            duration
        };
        
        if (statusCode >= 400) {
            this.error(message, logData);
        } else {
            this.info(message, logData);
        }
    }

    /**
     * Log WhatsApp message
     * @param {string} direction - 'incoming' or 'outgoing'
     * @param {string} phoneNumber - Phone number
     * @param {string} messageType - Type of message
     * @param {string} content - Message content (truncated)
     */
    logWhatsAppMessage(direction, phoneNumber, messageType, content) {
        const truncatedContent = typeof content === 'string' 
            ? content.substring(0, 100) + (content.length > 100 ? '...' : '')
            : JSON.stringify(content).substring(0, 100);
            
        this.info(`WhatsApp ${direction}`, {
            direction,
            phoneNumber,
            messageType,
            content: truncatedContent,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Log session activity
     * @param {string} phoneNumber - Phone number
     * @param {string} action - Action performed
     * @param {string} state - Current state
     * @param {*} data - Additional data
     */
    logSessionActivity(phoneNumber, action, state, data = null) {
        this.info(`Session activity: ${action}`, {
            phoneNumber,
            action,
            state,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Log file operation
     * @param {string} operation - Operation type
     * @param {string} fileName - File name
     * @param {string} phoneNumber - Phone number
     * @param {boolean} success - Operation success
     * @param {*} details - Additional details
     */
    logFileOperation(operation, fileName, phoneNumber, success, details = null) {
        const message = `File ${operation}: ${fileName}`;
        const logData = {
            operation,
            fileName,
            phoneNumber,
            success,
            details,
            timestamp: new Date().toISOString()
        };
        
        if (success) {
            this.info(message, logData);
        } else {
            this.error(message, logData);
        }
    }

    /**
     * Get log statistics
     * @returns {Object} Log statistics
     */
    getLogStats() {
        try {
            const stats = {};
            
            // Get log file stats
            if (fs.existsSync(this.logFile)) {
                const logStats = fs.statSync(this.logFile);
                stats.logFile = {
                    size: logStats.size,
                    created: logStats.birthtime,
                    modified: logStats.mtime
                };
            }
            
            // Get error file stats
            if (fs.existsSync(this.errorFile)) {
                const errorStats = fs.statSync(this.errorFile);
                stats.errorFile = {
                    size: errorStats.size,
                    created: errorStats.birthtime,
                    modified: errorStats.mtime
                };
            }
            
            stats.currentLevel = Object.keys(this.logLevels).find(
                key => this.logLevels[key] === this.currentLevel
            );
            
            return stats;
        } catch (error) {
            this.error('Error getting log stats:', error);
            return { error: error.message };
        }
    }

    /**
     * Clear log files
     * @param {boolean} clearErrors - Whether to clear error log too
     */
    clearLogs(clearErrors = false) {
        try {
            if (fs.existsSync(this.logFile)) {
                fs.truncateSync(this.logFile);
                this.info('Log file cleared');
            }
            
            if (clearErrors && fs.existsSync(this.errorFile)) {
                fs.truncateSync(this.errorFile);
                this.info('Error log file cleared');
            }
        } catch (error) {
            this.error('Error clearing log files:', error);
        }
    }

    /**
     * Change log level
     * @param {string} level - New log level
     */
    setLevel(level) {
        if (this.logLevels[level] !== undefined) {
            this.currentLevel = this.logLevels[level];
            this.info(`Log level changed to: ${level}`);
        } else {
            this.error(`Invalid log level: ${level}`);
        }
    }
}

module.exports = new Logger();
