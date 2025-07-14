// Full WhatsApp bot as Vercel serverless function
const webhookController = require('../controllers/webhookController');
const { validateWebhook } = require('../middleware/validation');

export default async function handler(req, res) {
    try {
        const { method, query } = req;
        
        if (method === 'GET') {
            // Webhook verification
            const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'loan_bot_verify_token';
            const mode = query['hub.mode'];
            const token = query['hub.verify_token'];
            const challenge = query['hub.challenge'];
            
            if (mode && token) {
                if (mode === 'subscribe' && token === verifyToken) {
                    console.log('Webhook verified successfully');
                    return res.status(200).send(challenge);
                } else {
                    console.log('Webhook verification failed');
                    return res.status(403).json({ error: 'Forbidden' });
                }
            } else {
                return res.status(400).json({ error: 'Bad Request' });
            }
        }
        
        if (method === 'POST') {
            // Validate webhook
            const validation = validateWebhook(req, res, () => {});
            if (validation === false) {
                return res.status(400).json({ error: 'Invalid webhook data' });
            }
            
            // Handle webhook
            return await webhookController.handleWebhook(req, res);
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}