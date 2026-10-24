# Knight Frank Practical Assessment

A prototype real-estate investment portal and AI-powered market assistant for Knight Frank. The project combines a modern frontend experience with a backend property search and market intelligence workflow, allowing users to browse listings, save properties, and ask assistant-driven questions about regional market trends.

## Technology Stack

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- CSS modules and component-level styling
- Lucide React for UI icons
- Three.js for lightweight visual elements

### Backend
- Python 3.x
- FastAPI
- Pydantic for validation and schemas
- Supabase for authentication and data persistence
- Uvicorn for local API serving

### AI and Search Layer
- Google Gemini for intent classification and response generation
- LangGraph for agent orchestration and workflow routing
- Pinecone for vector-based retrieval
- Structured property query building for listing search and filtering

### Data Sources and Integration
- Supabase-backed user and saved-property data
- Property data feeds and structured listing metadata
- Regional market research notes and press-release retrieval supporting AI responses

## AI Tools Used

- GitHub Copilot for building frontend code and backend APIs
- Claude for Knight Frank design research, UI planning, and database design
- ChatGPT for minor debugging fixes

## Architecture Diagram

```text
                           +---------------------------+
                           |                           |
                           |   Next.js Frontend        |
                           |   (Landing, Login,        |
                           |   Portal, Search UI)      |
                           |                           |
                           +-------------+-------------+
                                         |
                                         v
                           +---------------------------+
                           |   FastAPI Backend         |
                           |   - Auth endpoints        |
                           |   - Property APIs         |
                           |   - AI chat endpoints     |
                           +------+------+-----------+
                                  |      |
                                  |      +----------------------+
                                  |                             |
                                  v                             v
                     +---------------------+       +-------------------------+
                     | Supabase            |       | LangGraph + Gemini      |
                     | - User auth         |       | - intent routing       |
                     | - Saved properties |       | - market retrieval     |
                     +---------------------+       | - property search       |
                                                    | - response generation  |
                                                    +-----------+-------------+
                                                                |
                                                                v
                                                    +-------------------------+
                                                    | Pinecone + Dataset     |
                                                    | retrieval & metadata    |
                                                    +-------------------------+
```

## Key Decisions

- Chose a lightweight full-stack prototype architecture so the product could be demonstrated quickly without a large enterprise setup.
- Used Next.js on the frontend to deliver a polished, browser-based user experience consistent with a premium property brand.
- Kept the backend in FastAPI because it is fast to build, easy to validate, and works well with AI-powered endpoints and structured APIs.
- Centralized authentication and user-specific saved-property data in Supabase to reduce custom auth complexity during prototyping.
- Built an AI-driven assistant around LangGraph to separate tasks such as intent classification, retrieval, and answer generation.
- Used Gemini and vector retrieval for market research and property search so the interface feels more like a real investment assistant instead of a static portal.
- Prioritized a strong demo experience over deep production hardening, especially in areas such as large-scale data ingestion, enterprise governance, and production security controls.

### Decisions Made for the Sake of Prototyping

- Property and market content were curated and structured to work well in a demo context rather than a full production data pipeline.
- A simplified auth flow and local environment configuration were used so the project could run quickly on a laptop or development machine.
- AI responses were designed to be helpful and conceptually rich, but without the full operational reliability expected in a production-grade research and compliance system.
- Search and recommendation logic were tuned for a proof-of-concept experience rather than large-scale commercial deployment.

## Features Completed

### Core Features
- User sign-up and login flow with secure password handling and token-based authentication
- Landing experience designed around a global Knight Frank investment brand feel
- Property discovery and search experience across multiple markets and property types
- Saved-property functionality so a user can bookmark relevant opportunities
- Property detail view with key financial and market metadata
- AI assistant that can answer market and property-related questions
- Retrieval of market context, regional insights, and supporting references for assistant responses

### Additional Features
- Responsive portal layout for desktop and smaller screens
- Global property-market themed imagery and branded UI styling
- Interactive property collection experience with filters and listing cards
- Structured backend endpoints for property lookups and assistant chat interactions
- Search architecture designed to integrate AI-led querying with a property database layer

## Features Not Completed and What I Would Build Next

### Not Completed
- Full production-grade user management and role-based access control
- Enterprise-level property data ingestion from live market feeds
- Advanced notification and CRM workflows for agents and clients
- Multi-region admin dashboard with analytics and pipeline management
- End-to-end compliance, audit logging, and security hardening for regulated financial workflows
- Complete personalization, portfolio tracking, and recommendation engine

### Next Build Priorities
- Integrate live property listings and market datasets from trusted commercial sources
- Add a dashboard for saved properties, watchlists, and portfolio performance tracking
- Expand the AI assistant into a more robust investment advisor with calibrated market summaries and explainable recommendations
- Introduce role-based access for brokers, advisors, and client users
- Add analytics for market trends, demand signals, and property performance over time
- Improve testing, monitoring, and deployment pipelines for production readiness

## Quick Start

### Frontend

```bash
cd knight-frank-practical-assessment
npm install
npm run dev
```

### Backend

```bash
cd knight-frank-practical-assessment/src/backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The frontend expects the API at `http://localhost:8000` by default, and the backend uses Supabase environment variables and Google API configuration for authentication and AI services.

## Summary

This project demonstrates a premium property-investment portal prototype with a strong AI-driven assistant layer, built to showcase how Knight Frank-style market research, property search, and user experience can be combined into a modern digital product concept.
