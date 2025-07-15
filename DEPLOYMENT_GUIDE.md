# GitHub to Vercel Deployment Guide

## Files to Push to GitHub Repository

### Required Files Structure:
```
├── server.js
├── vercel.json
├── .vercelignore
├── README.md
├── .env.example
├── controllers/
│   └── webhookController.js
├── services/
│   ├── whatsappService.js
│   ├── sessionManager.js
│   ├── documentRequirements.js
│   ├── fileHandler.js
│   └── emailService.js
├── middleware/
│   └── validation.js
├── utils/
│   └── logger.js
└── data/
    └── .gitkeep
```

## Git Commands to Push Files

1. **Clone your repository:**
```bash
git clone https://github.com/deruto/loanChatBot.git
cd loanChatBot
```

2. **Copy all files from Replit to your local repository folder**

3. **Add and commit files:**
```bash
git add .
git commit -m "Add WhatsApp loan document collection bot"
git push origin main
```

## Vercel Environment Variables

Set these in your Vercel dashboard:

```
WHATSAPP_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_ID=your_phone_number_id
WEBHOOK_VERIFY_TOKEN=loan_bot_verify_token
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_TO=team@example.com
```

## Final Webhook Configuration

After Vercel deployment, your webhook URL will be:
```
https://loan-chat-bot.vercel.app/webhook
```

Use this URL and verify token `loan_bot_verify_token` in Meta for Developers.