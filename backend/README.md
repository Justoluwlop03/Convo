# Convo backend

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI` and a long `JWT_SECRET`.
2. Run `npm install`.
3. Run `npm run dev`.

The API listens on `http://localhost:5000` by default. Socket.IO clients authenticate with `auth: { token }`.

REST resources are mounted at `/api/auth`, `/api/users`, `/api/chats`, and `/api/messages`. `GET /health` is unauthenticated.
