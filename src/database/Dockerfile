# Verwende das offizielle Debian-Image als Basis
FROM debian:bullseye-slim

# Installiere SQLite
RUN apt-get update && apt-get install -y sqlite3

# Erstelle das Verzeichnis für die Datenbankdatei
RUN mkdir -p /app

# Erstelle das Verzeichnis für die Datenbankdatei
RUN mkdir -p /app/data

# Erstelle eine SQLite-Datenbank-Datei und eine Beispiel-Tabelle
RUN sqlite3 /app/data/database.db "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT, password TEXT);"
# Ändere die Berechtigungen für das Verzeichnis und die Datenbankdatei
RUN chown -R www-data:www-data /app/data && chmod -R 775 /app/data
# Setze das Arbeitsverzeichnis
WORKDIR /app

# Halte den Container im Hintergrund am Leben (wird ohne weitere Aktion fortlaufen)
CMD ["tail", "-f", "/dev/null"]