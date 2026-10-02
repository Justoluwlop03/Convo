# Convo backend

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI` and a long `JWT_SECRET`.
   For Web Push, generate one VAPID key pair with `npx web-push generate-vapid-keys` and set
   `VAPID_SUBJECT` (for example `mailto:you@example.com`), `VAPID_PUBLIC_KEY`, and
   `VAPID_PRIVATE_KEY`. The private key must only exist in the backend environment.
2. Run `npm install`.
3. Run `npm run dev`.

## Password reset email

Password reset emails are sent through Brevo. Configure `BREVO_API_KEY`,
`BREVO_SENDER_EMAIL` (a sender address verified in Brevo), and optionally
`BREVO_SENDER_NAME`; set `CLIENT_URL`
to the frontend origin so reset links return to the deployed app. Reset links
expire after 30 minutes and can only be used once. The reset request endpoint
returns the same response whether or not the email has an account.

The API listens on `http://localhost:5000` by default. Socket.IO clients authenticate with `auth: { token }`.

## API rate limits

API mutations are limited to 120 requests per IP per minute. Media uploads have an
additional limit of 20 per IP per 15 minutes. Login, password reset, search, anonymous
messages, TURN credentials, and admin broadcasts have their own tighter limits. A
limited request returns HTTP 429 with standard rate-limit headers. The in-memory
limiter is per server process; use a shared store if running multiple API instances.

When running behind a trusted reverse proxy in production, `TRUST_PROXY_HOPS` controls
how many proxy hops Express trusts for client IP detection. It defaults to `1` in
production and `0` locally. Set it to the number of trusted proxies in front of the API;
do not set it to `true`.

## Admin dashboard

Set `ADMIN_EMAILS` to a comma-separated list of account email addresses in the backend environment. Those accounts can open `/admin` in the frontend to view service health, aggregate usage, recent signups, and seven-day message activity. The dashboard also lets admins search accounts, ban or unban users, send email announcements to all registered addresses, and delete completed broadcast records from history. Deleting a record does not recall emails already sent. Broadcasts use the configured Brevo sender and are limited to three per hour. A ban signs the user out of active sockets and blocks future HTTP and Socket.IO authentication; allowlisted admins cannot be banned. Admin endpoints are authenticated and check this server-side allowlist; they do not expose message contents or recipient email addresses in broadcast history.

REST resources are mounted at `/api/auth`, `/api/users`, `/api/chats`, and `/api/messages`. `GET /health` is unauthenticated.

## Production push setup

For a Vercel frontend and Render API, set the same VAPID values in Render's environment
settings, set `CLIENT_URL` to the Vercel HTTPS origin, and set `VITE_API_URL` and
`VITE_SOCKET_URL` to the public Render HTTPS API origin when building the frontend. A phone
cannot use `localhost:5000`; `localhost` refers to the phone itself. After deployment, open
the installed PWA once with notifications allowed so it can create and save its PushSubscription.
