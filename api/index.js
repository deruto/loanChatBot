// Vercel serverless function for status endpoint
export default function handler(req, res) {
    return res.status(200).json({
        status: 'running',
        message: 'WhatsApp Loan Document Collection Bot - Serverless Version',
        timestamp: new Date().toISOString(),
        webhook_url: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/webhook`,
        verify_token: 'loan_bot_verify_token',
        version: '2.0.0',
        environment: 'production'
    });
}