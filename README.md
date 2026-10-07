# Realtime Chat — Portfolio Demo

Flagship demo from my backend / fullstack work: a messaging system with production-style realtime concerns.

I work primarily on **backend** (APIs, auth, data modeling, realtime) and ship **fullstack** features when needed. This project showcases the realtime side of that skill set — not the only thing I build.

## What this demo shows

- Socket.IO messaging: delivery, read receipts, typing indicators
- Live conversation list (last message + unread) without full page refresh
- WebRTC 1:1 call signaling
- Groups, media messages, edit/delete with in-app UI
- NestJS + MongoDB + Redis + JWT sessions
- PWA-oriented client with offline-aware behavior

## Stack

| Layer | Tech |
|--------|------|
| Backend | NestJS, TypeScript, MongoDB, Redis, Socket.IO, JWT |
| Frontend | TypeScript (vanilla SPA), PWA assets |
| Realtime | Socket rooms, user channels, presence-oriented design |
| Calls | WebRTC (signaling over sockets; quality depends on network / TURN) |

## Demo

- Video: 

## Scope notes

Call quality depends on network path (STUN/TURN). This build focuses on a solid messaging core and a credible realtime architecture rather than claiming a full Telegram-scale product.

## Author

Backend-focused fullstack developer. Open to backend roles, fullstack product work, and freelance realtime systems.


