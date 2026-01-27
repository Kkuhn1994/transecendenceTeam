# Verwende das offizielle Debian-Image als Basis
FROM debian:bullseye-slim

# Installiere SQLite
RUN apt-get update && apt-get install -y sqlite3

# Erstelle das Verzeichnis für die Datenbankdatei
RUN mkdir -p /app

# Erstelle das Verzeichnis für die Datenbankdatei
RUN mkdir -p /app/data

# Erstelle eine SQLite-Datenbank-Datei und eine Beispiel-Tabelle
# Erstelle die Datenbank und beide Tabellen in einem einzigen RUN-Befehl
RUN sqlite3 /app/data/database.db " \

    CREATE TABLE IF NOT EXISTS users ( \
        id INTEGER PRIMARY KEY, \
        email TEXT UNIQUE, \
        password TEXT, \
        session_cookie TEXT,\
        secret TEXT, \
        nickname TEXT, \
        avatar TEXT DEFAULT '/avatars/default.png', \
        is_active BOOLEAN DEFAULT 0, \
        last_login DATETIME, \
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP \
    ); \

    CREATE TABLE IF NOT EXISTS game_sessions ( \
        id INTEGER PRIMARY KEY AUTOINCREMENT, \
        player1_id INTEGER NOT NULL, \
        player2_id INTEGER NOT NULL, \
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP, \
        ended_at DATETIME, \
        score1 INTEGER DEFAULT 0, \
        score2 INTEGER DEFAULT 0, \
        winner_id INTEGER, \
        tournament_id INTEGER, \
        FOREIGN KEY (player1_id) REFERENCES users(id), \
        FOREIGN KEY (player2_id) REFERENCES users(id) \
    ); \
    CREATE TABLE IF NOT EXISTS friends ( \
        id INTEGER PRIMARY KEY AUTOINCREMENT, \
        user_id INTEGER NOT NULL, \
        friend_id INTEGER NOT NULL, \
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, \
        FOREIGN KEY (user_id) REFERENCES users(id), \
        FOREIGN KEY (friend_id) REFERENCES users(id), \
        UNIQUE(user_id, friend_id) \
    ); \
    CREATE TABLE IF NOT EXISTS tournaments ( \
        id INTEGER PRIMARY KEY AUTOINCREMENT, \
        name TEXT, \
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, \
        winner_id INTEGER, \
        FOREIGN KEY (winner_id) REFERENCES users(id) \
    ); \
    CREATE TABLE IF NOT EXISTS tournament_matches ( \
        id INTEGER PRIMARY KEY AUTOINCREMENT, \
        tournament_id INTEGER NOT NULL, \
        round INTEGER NOT NULL, \
        match_index INTEGER NOT NULL, \
        player1_id INTEGER NOT NULL, \
        player2_id INTEGER, \
        session_id INTEGER, \
        winner_id INTEGER,  \
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, \
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id), \
        FOREIGN KEY (player1_id) REFERENCES users(id), \
        FOREIGN KEY (player2_id) REFERENCES users(id), \
        FOREIGN KEY (session_id) REFERENCES game_sessions(id), \
        FOREIGN KEY (winner_id) REFERENCES users(id) \
    ); \
    CREATE TABLE IF NOT EXISTS game_data ( \
        id INTEGER PRIMARY KEY AUTOINCREMENT, \
        sessionId INTEGER NOT NULL, \
        scoreLeft INTEGER, \
        scoreRight INTEGER, \
        ballSpeedX INTEGER, \
        ballSpeedY INTEGER, \
        canvaswidth INTEGER, \
        canvasheight INTEGER, \
        rightPaddleY INTEGER, \
        leftPaddleY INTEGER, \
        ballX INTEGER, \
        ballY INTEGER \
    ); \
"





# Ändere die Berechtigungen für das Verzeichnis und die Datenbankdatei
RUN chown -R www-data:www-data /app/data && chmod -R 775 /app/data
# Setze das Arbeitsverzeichnis
WORKDIR /app

# Halte den Container im Hintergrund am Leben (wird ohne weitere Aktion fortlaufen)
CMD ["tail", "-f", "/dev/null"]