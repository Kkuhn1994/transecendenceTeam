FROM node:18

WORKDIR /service

# package.json kopieren
COPY package.json .

# TypeScript und Typen installieren
RUN npm install --save-dev typescript @types/node

# Fastify installieren
RUN npm install fastify @fastify/static

# Quellcode kopieren
COPY . .

# public-Verzeichnis erstellen
RUN mkdir -p public

# TypeScript kompilieren
RUN npx tsc login.ts --outDir ./public --lib "ES2015,DOM"

# Startbefehl
CMD ["node", "index.js"]
