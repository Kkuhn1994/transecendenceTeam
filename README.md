*This project has been created as part of the 42 curriculum by kkuhn, temil-da, rwegat.*

# ft_transcendence


## Description

A secure, multiplayer web-based Pong game featuring JWT authentication, 2FA, HTTPS encryption, user management, tournaments, and AI opponents.

## Team Information

**Emil:**  Project Owner, Developer  
**Kevin:**  Technical Lead, Developer  
**Rasmus:** Project Manager, Developer  

---

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
users: id, username, password_hash, avatar, display_name, created_at
friends: id, user_id, friend_id, status, created_at
games: id, player1_id, player2_id, winner_id, score, created_at
tournaments: id, name, status, created_at
tournament_players: tournament_id, user_id
```

---

## Mandatory Features

| Feature | Description | Contributors |
|---------|-------------|--------------|
| Docker Deployment | Single-command containerized deployment | kkuhn |
| Multi-user Support | Concurrent users, real-time updates, no race conditions | |
| Responsive Frontend | Chrome-compatible, mobile-friendly interface | |
| Secure Authentication | HTTPS everywhere | temil-da |
| | HTTPS everywhere | kkuhn |
| Input Validation | Frontend and backend validation on all forms | |
| Privacy & Terms | Accessible Privacy Policy and Terms of Service | rwegat |
| Database Schema | SQLite | |

---

## Modules

| Category | Module | Points | Contributors |
|----------|--------|:------:|--------------|
| Web | Backend Framework | 1 | kkuhn |
| User Management | Standard User Management | 2 | rwegat, temil-da |
| | Game Stats & Match History | 1 | temil-da, rwegat |
| AI | Opponent AI | 2 | rwegat |
| Cybersecurity | 2FA | 1 | kkuhn|
| Gaming & UX | Web-based Game | 2 | temil-da |
| | Tournament System | 1 | temil-da |
| DevOps | Backend as Microservices | 2 | kkuhn |
| Modules of Choice | JWT Authentication | 2 | kkuhn |
| | **Total** | **14** | |


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

AI disclosure: We have used AI to help with design, tracking down bugs, creating temporary content as proof of concepts
and assisting by providing pseudo code to help with getting familiar in new topics and areas.
It has also been used to create the README

---

