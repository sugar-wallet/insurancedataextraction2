# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an insurance calculator and comparison tool that helps users understand and compare various insurance options. The application will include calculators for auto, home, life, and health insurance, along with comparison tools and risk assessment features.

## Target Architecture

Based on the PRD, this will be a full-stack web application with:

### Frontend
- Modern JavaScript framework (React/Vue/Angular)
- Responsive, mobile-first design
- Progressive Web App capabilities
- WCAG 2.1 AA accessibility compliance

### Backend
- RESTful API architecture
- Real-time calculation engine
- Microservices architecture for scalability
- Integration with insurance provider APIs

### Key Integrations
- Insurance provider APIs (Geico, State Farm, Progressive)
- Credit score services
- Property value databases (Zillow, CoreLogic)
- Vehicle databases (KBB, Edmunds)
- Payment processing (Stripe, PayPal)

## Security & Compliance Requirements

- End-to-end encryption for sensitive data
- HIPAA compliance for health data
- PCI DSS compliance for payment processing
- GDPR and CCPA compliance for data privacy
- State insurance regulations compliance

## Development Phases

### Phase 1 MVP
1. Basic auto insurance calculator
2. Simple comparison tool (2-3 providers)
3. User registration and profile creation
4. Basic educational content
5. Responsive web interface

## Key Components to Implement

### Calculators
- Auto insurance (vehicle info, driver info, coverage options)
- Home insurance (property details, coverage amounts)
- Life insurance (income replacement, debt coverage, family needs)
- Health insurance (premium estimation, deductible analysis)

### Core Features
- Side-by-side quote comparison
- Risk assessment and profiling
- User profile management with secure data storage
- Educational resources and glossary

## Development Commands

### Setup
```bash
npm run install:all  # Install all dependencies (root, backend, frontend)
```

### Development
```bash
npm run dev          # Start both frontend and backend in development mode
npm run dev:backend  # Start only backend server (port 3001)
npm run dev:frontend # Start only frontend dev server (port 3000)
```

### Production
```bash
npm run build        # Build frontend for production
npm start            # Start both services in production mode
```

## Project Structure

```
├── backend/         # Node.js/Express API server
│   ├── server.js    # Main server file with all endpoints
│   └── uploads/     # Temporary PDF storage (auto-created)
├── frontend/        # React TypeScript application
│   └── src/
│       ├── App.tsx           # Main app component
│       └── components/       # UI components
│           ├── PDFUpload.tsx    # File upload interface
│           ├── DataReview.tsx   # Data review and editing
│           └── ErrorHandler.tsx # Error handling UI
└── package.json     # Root package with dev scripts
```

## API Endpoints

- `POST /api/upload-pdf` - Upload and process PDF files
- `POST /api/save-corrections` - Save user corrections for learning
- `POST /api/generate-questionnaire` - Generate questionnaire for missing fields
- `GET /api/health` - Health check endpoint

## AI Configuration

The system uses Google's Gemini AI with the API key configured in `backend/server.js`. The AI processes PDFs to extract insurance data and categorizes fields as known/unknown based on predefined templates.

## Field Templates

Supports auto, home, life, health, and commercial insurance types with predefined field mappings for consistent data extraction and questionnaire generation.