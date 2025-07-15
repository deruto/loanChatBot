// Simple status endpoint
module.exports = (req, res) => {
    return res.status(200).json({
        status: 'online',
        message: 'WhatsApp Bot API',
        timestamp: new Date().toISOString(),
        endpoints: {
            webhook: '/api/simple-webhook',
            status: '/api/status'
        }
    });
};