// Simple webhook test that will definitely work on Vercel
export default function handler(req, res) {
    console.log('Webhook called:', req.method, req.url);
    
    if (req.method === 'GET') {
        const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
        
        console.log('Verification request:', { mode, token, challenge });
        
        if (mode === 'subscribe' && token === 'loan_bot_verify_token') {
            console.log('✅ Webhook verified successfully');
            return res.status(200).send(challenge);
        } else {
            console.log('❌ Verification failed', { mode, token });
            return res.status(403).json({ error: 'Forbidden' });
        }
    }
    
    if (req.method === 'POST') {
        console.log('📨 Received webhook POST:', JSON.stringify(req.body, null, 2));
        return res.status(200).json({ status: 'received' });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
}