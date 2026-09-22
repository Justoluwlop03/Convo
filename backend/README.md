# Convo backend

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI` and a long `JWT_SECRET`.
   For Web Push, generate one VAPID key pair with `npx web-push generate-vapid-keys` and set
   `VAPID_SUBJECT` (for example `mailto:you@example.com`), `VAPID_PUBLIC_KEY`, and
   `VAPID_PRIVATE_KEY`. The private key must only exist in the backend environment.
2. Run `npm install`.
3. Run `npm run dev`.

The API listens on `http://localhost:5000` by default. Socket.IO clients authenticate with `auth: { token }`.

REST resources are mounted at `/api/auth`, `/api/users`, `/api/chats`, and `/api/messages`. `GET /health` is unauthenticated.

## Production push setup

For a Vercel frontend and Render API, set the same VAPID values in Render's environment
settings, set `CLIENT_URL` to the Vercel HTTPS origin, and set `VITE_API_URL` and
`VITE_SOCKET_URL` to the public Render HTTPS API origin when building the frontend. A phone
cannot use `localhost:5000`; `localhost` refers to the phone itself. After deployment, open
the installed PWA once with notifications allowed so it can create and save its PushSubscription.
