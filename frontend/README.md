# MERN Chat Frontend

A Vite + React frontend for the MERN real-time chat app, built around the system-design specification in the companion PDF.

## Stack
- React + Vite
- React Router
- Axios
- Socket.IO client
- React Hook Form + Zod
- Lucide icons
- Responsive chat-first UI

## Environment
Create a `.env` file based on `.env.example`:

```bash
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## Start locally

```bash
npm install
npm run dev
```

Then open the local Vite URL in the browser.

## Included flows
- Register/login screens
- Protected route handling
- Session restoration
- Chat list and message view
- User search and chat creation
- Profile/logout panel
- Mobile-friendly responsive layout

## Backend contract
This frontend is structured to integrate with the backend endpoints and Socket.IO events described in the system design, while keeping the frontend API configuration centralized and environment-driven.
