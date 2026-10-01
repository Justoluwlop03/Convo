# Convo Mobile

React Native mobile app built with Expo. It connects to the existing backend for account sign-in, conversations, and live incoming messages.

## Run it

1. Set `EXPO_PUBLIC_API_URL` in `.env` to the backend API address reachable from the phone, for example `http://192.168.1.20:5000/api`.
2. From this directory, run `npm install` once and then `npm start`.
3. Open the project in Expo Go or an Android emulator.

## Current scope

The mobile app currently supports account login/registration, listing existing one-to-one chats, loading message history, sending text messages, and receiving new messages over Socket.IO. The API address must be reachable from the device. Expo's Metro tunnel carries the JavaScript bundle, not API requests; if router isolation blocks LAN access, use a separate API tunnel or allow device-to-device access on the Wi-Fi network.

For a phone that cannot reach the PC over Wi-Fi, start a temporary API tunnel in another terminal while the backend is running with `cloudflared tunnel --url http://localhost:5000`. Put the generated `https://…trycloudflare.com/api` address in `EXPO_PUBLIC_API_URL`, then restart Expo. This exposes the development API publicly while the tunnel is active; stop it with Ctrl+C when finished.
