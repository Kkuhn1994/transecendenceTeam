*This project has been created as part of the 42 curriculum by kkuhn, temil-da, rwegat.*

# ft_transcendence

## Description

A secure, multiplayer web-based Pong game featuring JWT authentication, 2FA, HTTPS encryption, user management, tournaments, and AI opponents.

**Key Features:**

*Mandatory:*
- Single-command Docker deployment
- Chrome-compatible, responsive frontend
- Multi-user support with real-time updates
- Secure auth (hashed passwords)
- HTTPS everywhere
- Input validation (frontend + backend)
- Privacy Policy & Terms of Service
- SQLite database with defined schema
- Credentials in `.env` (git-ignored)
- CSS framework for styling

*Additional:*
- User registration/login
- Friends system
- Match history
- 2FA
- AI opponent
- Tournament brackets
- JWT authentication
- Microservices architecture

---

## Team Information

TODO: roles, responsibilities, member contributions

---

## Project Management

- **Organization:** Regular exchange, feature branches, code reviews, clear commits
- **Tools:** GitHub
- **Communication:** In Person Meetings and WhatsApp Communication

---

## Technical Stack

| Layer | Technology | Justification |
|-------|------------|--------|
| Frontend | TypeScript, Vite | Fast bundling, type safety |
| Backend | Node.js, Fastify | Lightweight, fast REST API |
| Database | SQLite | Simple, no server needed, file-based |
| Auth | JWT, 2FA (TOTP) | Stateless auth, added security |
| Infra | Docker, nginx | Containerized microservices, HTTPS proxy |

---

## Database Schema

```
users: id, username, email, password_hash, avatar, display_name, created_at
friends: id, user_id, friend_id, status, created_at
games: id, player1_id, player2_id, winner_id, score, created_at
tournaments: id, name, status, created_at
tournament_players: tournament_id, user_id
```

---

## Features

| Feature | Description | Contributors |
|---------|-------------|--------------|
| User Registration/Login | Signup, login, JWT tokens | rwegat |
| User Profiles | Display name, avatar, stats | rwegat |
| Friends System | Add/remove friends, status | rwegat |
| Match History | Game records, win/loss | rwegat |
| 2FA | TOTP-based two-factor auth | |
| Pong Game | Canvas-based multiplayer pong | |
| AI Opponent | Difficulty-based computer player | rwegat |
| Tournaments | Bracket system, matchmaking | |

---

## Modules

| Category | Module | Points | Contributors |
|----------|--------|:------:|--------------|
| Web | Backend Framework | 1 | |
| User Management | Standard User Management | 2 | rwegat |
| | Game Stats & Match History | 1 | rwegat|
| AI | Opponent AI | 2 | rwegat|
| Cybersecurity | 2FA | 1 | |
| Gaming & UX | Web-based Game | 2 | |
| | Tournament System | 1 | |
| DevOps | Backend as Microservices | 2 | |
| Modules of Choice | JWT Authentication | 2 | |
| | **Total** | **14** | |

---

## Individual Contributions

**kkuhn:**
**temil-da:**
**rwegat:** User profiles, friends system, match history, AI opponent module, frontend profile/friends pages, UI

---

## Instructions

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local dev)

### Setup
```bash
git clone https://github.com/Kkuhn1994/transecendenceTeam.git
cd transecendenceTeam
# Configure .env (see .env.example)
docker-compose up --build
```

### Access
Open `https://localhost:1080` in your browser.

---

## Resources

TODO: documentation links, tutorials, references, AI usage disclosure

---

## TODO

- [ ] Check no logs in frontend ("no errors should show in the console")
- [ ] Privacy Policy + Terms of Service
- [ ] Frontend responsiveness
- [ ] Test multiple users → Data races etc


