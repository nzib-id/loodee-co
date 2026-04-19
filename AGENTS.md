# AGENTS.md — Loodee Co. Dashboard

> Project-specific documentation untuk Loodee Co. Dashboard.
> Untuk info global ekosistem (tim agent, infrastructure, aturan delegasi), baca dulu:
> **`/home/nzib/.openclaw/workspace/ECOSYSTEM.md`**

---

## 📖 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Struktur Folder](#struktur-folder)
4. [Server API Reference](#server-api-reference)
5. [Frontend Architecture](#frontend-architecture)
6. [Meet Room](#meet-room)
7. [Deploy Guide](#deploy-guide)
8. [Known Issues & Pending Tasks](#known-issues--pending-tasks)

---

## 🏠 Project Overview

Loodee Co. Dashboard adalah tampilan real-time bergaya idle game yang menampilkan aktivitas semua agent. Berfungsi sebagai **visual HQ** sekaligus **Meet Room** untuk komunikasi antar agent.

```
┌─────────────────────────────────────────────────────┐
│                   Loodee Co. HQ                     │
│                                                     │
│   ┌──────────────────┐   ┌──────────────────────┐  │
│   │   PixiJS Canvas  │   │    Agent Panel       │  │
│   │  (idle game map) │   │  status per agent    │  │
│   │                  │   ├──────────────────────┤  │
│   │  Sprite: Soldier │   │  ACTIVITY LOG        │  │
│   │  (Loodee), Orc   │   │  ──────────          │  │
│   │  (Kobo), dll     │   │  MEET ROOM           │  │
│   └──────────────────┘   └──────────────────────┘  │
└─────────────────────────────────────────────────────┘
               ↕ WebSocket (ws://localhost:3001)
┌─────────────────────────────────────────────────────┐
│              Backend (Node.js + Express)             │
│  - Agent status tracking + polling OpenClaw          │
│  - Meet Room messaging store                         │
│  - WebSocket broadcast ke semua client               │
└─────────────────────────────────────────────────────┘
```

| Info | Detail |
|------|--------|
| **Repo** | `/home/nzib/.openclaw/workspace/loodee-co/` |
| **Frontend Live** | https://loodee-co.vercel.app |
| **Backend** | `http://localhost:3001` |
| **Backend WS (dev)** | `ws://localhost:3001` |
| **Backend WS (prod)** | `wss://api.loodee.art` (Cloudflare Tunnel) |
| **PM2 Process** | `loodee-hq` |

---

## 🛠 Tech Stack

### Frontend
- **React** + **Vite**
- **PixiJS** — game canvas (sprite, animasi, tile map, drag physics)
- **Zustand** — global state (`agents`, `logs`, `chatMessages`)
- **Tailwind CSS** — styling
- **WebSocket** — real-time dari backend

### Backend (`server/`)
- **Node.js** + **Express**
- **`ws`** — WebSocket server, broadcast ke semua client
- **PM2** — process manager

---

## 📁 Struktur Folder

```
loodee-co/
├── AGENTS.md               # Dokumentasi ini
├── server/
│   ├── index.js            # Backend utama (Express + WebSocket)
│   └── package.json
├── src/
│   ├── App.jsx             # Root layout (desktop + mobile), init WebSocket
│   ├── main.jsx            # Entry point
│   ├── index.css           # Global styles
│   ├── game/
│   │   ├── PixiApp.jsx     # PixiJS canvas, tile map, sprite management
│   │   └── SpriteAgent.js  # Logic per sprite (animasi, physics, AI walk)
│   ├── store/
│   │   └── agentStore.js   # Zustand store
│   ├── ui/
│   │   ├── AgentPanel.jsx  # Panel kanan — list agent + status
│   │   ├── LogPanel.jsx    # Activity Log tab
│   │   └── MeetRoomPanel.jsx # Meet Room chat tab
│   └── ws/
│       └── socket.js       # WebSocket client (connect, reconnect, handle events)
├── public/assets/          # Static assets (sprites, tiles, fonts)
└── dist/                   # Build output (auto-generated, jangan edit)
```

---

## 📡 Server API Reference

Base URL: `http://localhost:3001`

### Meet Room — Messaging

#### Kirim Pesan
```
POST /api/message
```
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| `agentId` | string | ✅ | ID pengirim (`loodee`, `kobo`, dll) |
| `agentName` | string | ❌ | Display name (default: agentId) |
| `msg` | string | ✅ | Isi pesan |
| `color` | string | ❌ | Warna hex (default: `#888` abu-abu) |
| `to` | string | ❌ | Target agent ID (null = broadcast) |

Response: `{ "ok": true, "id": <messageId> }`

#### Baca Pesan Unread
```
GET /api/messages?for=<agentId>
```
Response: `{ "messages": [ { id, from, to, msg, status, timestamp } ] }`

#### Mark Pesan Dibaca
```
POST /api/messages/:id/read
```

### Agent Status

#### Set Status Manual
```
POST /api/agent-status
{ "agentId": "kobo", "status": "active"|"idle", "load": 0-100 }
```

#### Mulai Task
```
POST /api/task-start
{ "agentId": "kobo", "label": "Deskripsi task", "ttlMs": 1800000 }
```
> `ttlMs` default 30 menit. Set `0` untuk tidak auto-expire.

#### Task Selesai
```
POST /api/task-done
{ "agentId": "kobo", "label": "Konfirmasi selesai" }
```

### Health Check
```
GET /health
→ { "status": "ok", "clients": 2, "uptime": 3600 }
```

### WebSocket Events (Server → Client)

| Type | Payload | Deskripsi |
|------|---------|-----------|
| `agent_status` | `{ agentId, status, load }` | Update status agent di UI |
| `log` | `{ agentId, agentName, msg, color }` | Entry di Activity Log |
| `chat` | `{ agentId, agentName, msg, color, to }` | Pesan di Meet Room |
| `agent_update` | `{ agentId, patch }` | Patch data agent |

> Saat client baru connect, server otomatis replay **50 pesan terakhir** (chat + log).

---

## 🏗 Frontend Architecture

### Zustand Store (`agentStore.js`)

| State | Type | Deskripsi |
|-------|------|-----------|
| `agents[]` | Array | Data semua agent (id, name, role, status, load, color, sprite) |
| `logs[]` | Array | Activity Log entries (max 200, newest first) |
| `chatMessages[]` | Array | Meet Room messages (max 200, oldest first) |
| `selectedAgent` | string | Agent yang dipilih di UI |
| `wsConnected` | boolean | Status koneksi WebSocket |

### Agent Data Default (dari `agentStore.js`)

| agentId | name | role | color | sprite |
|---------|------|------|-------|--------|
| `loodee` | Loodee | Orchestrator | `#ffe500` | soldier |
| `codebot` | Kobo | Engineering | `#38bdf8` | orc |
| `researchbot` | Rebo | Intelligence | `#f59e0b` | - |
| `creativebot` | Krebo | Creative | `#f472b6` | - |

> ⚠️ Note: `agentId` di frontend masih pakai nama lama (`codebot`, `researchbot`, `creativebot`). Pending rename ke `kobo`, `rebo`, `krebo`.

### WebSocket Client (`socket.js`)
- Connect: `ws://localhost:3001` (dev) / `wss://api.loodee.art` (prod)
- Auto-reconnect delay: **3 detik**
- Replay history: **50 messages** saat pertama connect

---

## 💬 Meet Room

Meet Room adalah chat panel untuk komunikasi real-time antar agent. Tampil di tab **MEET ROOM** (toggle dari ACTIVITY LOG) di bagian bawah dashboard.

### Warna Resmi Per Agent

| Agent | agentId | Hex |
|-------|---------|-----|
| Loodee | `loodee` | `#ffe500` |
| Kobo | `kobo` | `#38bdf8` |
| Rebo | `rebo` | `#f59e0b` |
| Krebo | `krebo` | `#f472b6` |
| System | `system` | `#4ade80` |

### Contoh Penggunaan (curl)

```bash
# Loodee delegasi task ke Kobo
curl -X POST http://localhost:3001/api/message \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "loodee",
    "agentName": "LOODEE",
    "msg": "Kobo, tolong fix auto-color di /api/message endpoint.",
    "color": "#ffe500",
    "to": "kobo"
  }'

# Kobo baca pesan masuk
curl "http://localhost:3001/api/messages?for=codebot"

# Kobo mulai task
curl -X POST http://localhost:3001/api/task-start \
  -H "Content-Type: application/json" \
  -d '{"agentId": "codebot", "label": "Fix auto-color Meet Room"}'

# Kobo report selesai
curl -X POST http://localhost:3001/api/task-done \
  -H "Content-Type: application/json" \
  -d '{"agentId": "codebot", "label": "Auto-color Meet Room fixed"}'

# Kobo balas ke Loodee
curl -X POST http://localhost:3001/api/message \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "kobo",
    "agentName": "KOBO",
    "msg": "Done! Auto-color sudah fix, pm2 udah reload.",
    "color": "#38bdf8",
    "to": "loodee"
  }'
```

---

## 🚀 Deploy Guide

### Backend (Server)

```bash
# Reload setelah edit server/index.js (no downtime)
pm2 reload loodee-hq

# Cek status & logs
pm2 status
pm2 logs loodee-hq --lines 50

# Restart dari scratch
pm2 restart loodee-hq
```

### Frontend (React)

```bash
cd /home/nzib/.openclaw/workspace/loodee-co

# Build lokal (untuk test)
npm run build

# Deploy ke Vercel — cukup push ke GitHub
git add .
git commit -m "feat: deskripsi perubahan"
git push
# Vercel otomatis build & deploy dari push
```

> Frontend prod terhubung ke `wss://api.loodee.art` via Cloudflare Tunnel.
> Backend tetap jalan lokal di `localhost:3001`.

---

## 🐛 Known Issues & Pending Tasks

### 🔴 High Priority
- [ ] **Auto-color Meet Room** — `POST /api/message` default ke `#888` kalau `color` tidak di-pass. Server harus auto-map `agentId` → warna. Fix di `server/index.js` line ~64.

### 🟡 Medium Priority
- [ ] **agentId naming mismatch** — `agentState` di server (`codebot`, `researchbot`, `creativebot`) dan frontend (`agentStore.js`) perlu diupdate ke `kobo`, `rebo`, `krebo`.
- [ ] **Kobo auto-poll Meet Room** — Kobo perlu poll `GET /api/messages?for=codebot` secara periodik (via heartbeat atau cron) biar bisa auto-baca pesan dari Loodee tanpa trigger manual.

### 🟢 Low Priority
- [ ] Sprite untuk Rebo dan Krebo belum dibuat
- [ ] Mobile layout Meet Room panel agak sempit

---

*Last updated: 2026-04-19 by Loodee*
