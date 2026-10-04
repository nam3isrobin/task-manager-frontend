# Task Manager UI (Frontend)

Production-ready static frontend for the Day 19 Task Manager application built with semantic HTML5, pure Vanilla CSS (zero utility frameworks), Axios, and JWT authentication.

## Features
- Complete Task CRUD operations with real-time UI synchronization
- 🔐 Dedicated Fullscreen Authentication Portal: Zero background dashboard clutter for unauthenticated users
- 🛡️ Automatic Bearer Token injection via Axios Interceptors
- 🚪 Graceful Session Expiration: Automatic 401 detection, token purge, and re-login prompt
- 👤 Authenticated user profile badge & one-click Sign Out
- ⚡ Dedicated Admin Command Center (`/admin.html`): Real-time telemetry, user management, and global cross-tenant task explorer
- Assignment 1: Modal task title & property editing
- Assignment 2: Categorization badges (`Work`, `Personal`, `Urgent`) and filter controls
- Assignment 3: Chronological ordering (Newest / Oldest first toggle)
- Strict Multi-User Isolation: Each user exclusively views and manages their own tasks
- Deployable on Netlify with zero build step


## Configuration
In `script.js`, the app automatically detects localhost vs production Render deployment:
```javascript
const LIVE_BACKEND_URL = 'https://task-manager-backend-km6q.onrender.com';
```

