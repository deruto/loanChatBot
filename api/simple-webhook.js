// Ultra-simple webhook for testing verification
module.exports = async function handler(req, res) {
    console.log('Simple webhook called:', req.method, req.url);
    console.log('Query params:', req.query);
    
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        console.log('Verification data:', { mode, token, challenge });
        
        if (mode === 'subscribe' && token === 'loan_bot_verify_token') {
            console.log('✅ Verification successful');
            return res.status(200).send(challenge);
        } else {
            console.log('❌ Verification failed');
            return res.status(403).send('Verification failed');
        }
    }
    
    if (req.method === 'POST') {
        console.log('📨 POST received');
        return res.status(200).json({ status: 'received' });
    }
    
    return res.status(405).send('Method not allowed');
}