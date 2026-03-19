# SendFlow Clone Architecture

This project is a clone of SendFlow, designed to handle WhatsApp automation with high throughput using Evolution API.

## Architecture Overview

- **Frontend (Dashboard)**: Next.js (located in `dashboard` folder)
- **Backend**: NestJS (located in `backend` folder)
- **WhatsApp Engine**: Evolution API (v2)
- **Queue**: Redis + BullMQ
- **Database**: PostgreSQL

## Prerequisites

- Docker & Docker Compose
- Node.js (for local development)

## Getting Started

1.  **Clone the repository** (if you haven't already).
2.  **Environment Variables**:
    - Copy `backend/.env.example` to `backend/.env` and adjust values.
    - Copy `.env.example` to `.env` and adjust values for `docker-compose.yml`.

3.  **Run with Docker Compose**:

    ```bash
    docker-compose up -d --build
    ```

    This command starts:
    - Postgres (Port 5432)
    - Redis (Port 6379)
    - Evolution API (Port 8080)
    - Backend API (Port 3000)
    - Frontend Dashboard (Port 3001)

4.  **Access the Application**:
    - **Dashboard**: http://localhost:3001
    - **Backend API**: http://localhost:3000
    - **Evolution API**: http://localhost:8080

## Webhook Configuration

To enable automated responses (keyword triggers):

1.  Access your Evolution API instance (usually at http://localhost:8080 or your VPS IP).
2.  Configure the Webhook URL to point to your backend:
    - URL: `http://host.docker.internal:3000/whatsapp/webhook` (if running locally via Docker) or `http://YOUR_VPS_IP:3000/whatsapp/webhook`
    - Events: Check `messages-upsert` or similar message events.

## Project Structure

- `backend/`: NestJS application.
    - `src/whatsapp`: Handles connection, message sending, and webhooks via Evolution API.
    - `src/campaigns`: Manages campaigns and queues messages using BullMQ (staggered delay).
    - `src/contacts`: CRUD for contacts.
    - `src/automations`: Logic for keyword triggers and auto-responses.
- `dashboard/`: Next.js application.
    - `app/`: Next.js App Router pages (Dashboard, Contacts, Campaigns).

## Key Features Implemented

- **WhatsApp Connection**: Endpoint to connect instance via Evolution API.
- **Message Queuing**: Messages are added to Redis queue with 5-second delay to avoid bans.
- **Campaign Management**: Create campaigns and bulk send messages.
- **Contacts Management**: Store and manage contacts.
- **Automations**: Keyword-based auto-replies via Webhooks.
