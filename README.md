# WhatsApp Loan Document Collection Bot

A Node.js WhatsApp chatbot using Meta's Cloud API for automated loan document collection with file handling and email forwarding.

## Features

- **WhatsApp Integration**: Uses Meta's WhatsApp Cloud API
- **Smart Document Collection**: Matrix-based requirements by loan type and employment status
- **File Management**: Automatic ZIP packaging and email forwarding
- **Session Management**: In-memory state tracking with 30-minute timeout
- **Comprehensive Logging**: Full request/response logging with file output

## Deployment to Vercel

### 1. Environment Variables Required

Set these in your Vercel dashboard:

```
WHATSAPP_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_ID=your_phone_number_id
WEBHOOK_VERIFY_TOKEN=your_verify_token
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_TO=team@example.com
```

### 2. Webhook Configuration

After deployment, use these values in Meta for Developers:

- **Webhook URL**: `https://your-project.vercel.app/webhook`
- **Verify Token**: Use the value you set for `WEBHOOK_VERIFY_TOKEN`

### 3. Supported Loan Types

- Home/Housing Loan
- Business Loan
- Education Loan
- Personal Loan
- Vehicle Loan

### 4. Document Requirements

Documents vary by loan type and employment status (Salaried vs Self-employed). The bot automatically determines required documents and guides users through upload process.

## API Endpoints

- `GET /` - Bot status and webhook information
- `GET /webhook` - Webhook verification endpoint
- `POST /webhook` - WhatsApp message handler
- `GET /health` - Health check endpoint

## Chat Flow

1. Welcome message with loan type selection
2. Employment status selection
3. Document requirements display
4. Sequential document upload with progress tracking
5. ZIP packaging and email forwarding
6. Completion confirmation with contact information

## Local Development

```bash
npm install
node server.js
```

Server runs on port 5000 by default.