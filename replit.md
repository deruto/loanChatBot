# replit.md

## Overview

This is a Node.js-based WhatsApp chatbot system for loan document collection. The application integrates with WhatsApp Business API to guide users through a conversational flow where they select loan types, provide employment information, and upload required documents. The system then packages and emails these documents to the loan processing team.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Express.js server with RESTful architecture
- **Runtime**: Node.js
- **File Structure**: Modular design with separated concerns:
  - Controllers for handling webhook requests
  - Services for business logic (WhatsApp, email, file handling, session management)
  - Middleware for request validation
  - Utilities for logging

### Chat Flow Management
- **Session Management**: In-memory session storage using Map data structure
- **State Machine**: Conversation states (INITIAL, WAITING_LOAN_TYPE, WAITING_EMPLOYMENT_TYPE, COLLECTING_DOCUMENTS, COMPLETED)
- **Document Requirements**: Matrix-based system determining required documents based on loan type and employment status

## Key Components

### 1. WhatsApp Integration (`services/whatsappService.js`)
- **Purpose**: Interface with WhatsApp Business API
- **Functionality**: Send messages, handle incoming webhooks
- **API**: Facebook Graph API v18.0
- **Authentication**: Bearer token-based

### 2. Session Manager (`services/sessionManager.js`)
- **Purpose**: Track user conversation state and progress
- **Storage**: In-memory Map with automatic cleanup
- **Timeout**: 30-minute session expiration
- **Data Tracked**: User state, loan preferences, document upload progress

### 3. Document Requirements (`services/documentRequirements.js`)
- **Purpose**: Define required documents based on loan type and employment
- **Structure**: Matrix mapping loan types (Home, Business, Personal, Vehicle) to employment types (Salaried, Self-employed)
- **Extensibility**: Designed to be easily configurable

### 4. File Handler (`services/fileHandler.js`)
- **Purpose**: Manage document uploads and storage
- **Storage Structure**: `data/{phoneNumber}/{loanType}/`
- **Features**: File sanitization, directory creation, ZIP packaging
- **Security**: Filename sanitization to prevent path traversal

### 5. Email Service (`services/emailService.js`)
- **Purpose**: Send collected documents to loan team
- **Transport**: Nodemailer with SMTP
- **Features**: ZIP attachment support, HTML email templates
- **Fallback**: Simulation mode when credentials unavailable

### 6. Webhook Controller (`controllers/webhookController.js`)
- **Purpose**: Main conversation flow logic
- **Responsibilities**: Message processing, state transitions, document collection orchestration

## Data Flow

1. **Incoming Message**: WhatsApp webhook → Validation middleware → Webhook controller
2. **Session Retrieval**: Controller gets/creates user session from SessionManager
3. **State Processing**: Based on current state, controller determines next action
4. **Document Requirements**: System looks up required documents based on user selections
5. **File Upload**: Documents uploaded to structured file system
6. **Completion**: When all documents collected, system packages and emails them

## External Dependencies

### Core Dependencies
- **express**: Web framework for handling HTTP requests
- **axios**: HTTP client for WhatsApp API calls
- **multer**: File upload handling middleware
- **nodemailer**: Email sending functionality
- **adm-zip**: ZIP file creation for document packaging
- **cors**: Cross-origin resource sharing middleware
- **dotenv**: Environment variable management

### WhatsApp Business API
- **Provider**: Facebook Graph API
- **Authentication**: Access token and phone number ID required
- **Webhook**: Requires HTTPS endpoint for receiving messages

### Email Service
- **SMTP**: Configurable email provider (default: Gmail)
- **Authentication**: Username/password or app-specific passwords
- **Attachments**: Support for ZIP files containing documents

## Deployment Strategy

### Environment Configuration
Required environment variables:
- `WHATSAPP_TOKEN`: WhatsApp Business API access token
- `WHATSAPP_PHONE_ID`: WhatsApp Business phone number ID
- `EMAIL_HOST`: SMTP server hostname
- `EMAIL_PORT`: SMTP server port
- `EMAIL_USER`: Email username
- `EMAIL_PASS`: Email password
- `PORT`: Server port (default: 5000)
- `LOG_LEVEL`: Logging level (error, warn, info, debug)

### Recent Changes (July 14, 2025)
- ✅ Complete WhatsApp chatbot implementation with Meta Cloud API integration
- ✅ Full conversation flow from greeting to document collection completion
- ✅ Matrix-based document requirements system supporting multiple loan types
- ✅ File upload handling with ZIP packaging and email forwarding
- ✅ Comprehensive session management with 30-minute timeout
- ✅ Server configured to run on port 5000 for Replit deployment compatibility
- ✅ Vercel serverless deployment architecture implemented
- ✅ WhatsApp API credentials verified: Token and Phone ID (640407489165993) validated
- ✅ Serverless webhook handlers created for Vercel compatibility

### File System Requirements
- **Data Directory**: `./data/` for document storage
- **Logs Directory**: `./logs/` for application logs
- **Permissions**: Write access required for file uploads and logging

### Production Considerations
- **HTTPS**: Required for WhatsApp webhook verification
- **File Storage**: Current implementation uses local storage; consider cloud storage for production
- **Session Storage**: In-memory sessions don't persist across restarts; consider Redis for production
- **Error Handling**: Comprehensive error logging and recovery mechanisms in place
- **Security**: Webhook signature verification available but needs implementation

### Scalability Notes
- **Stateless Design**: Except for in-memory sessions, application is stateless
- **Horizontal Scaling**: Would require external session storage (Redis) and shared file storage
- **Performance**: File uploads handled synchronously; consider async processing for large files