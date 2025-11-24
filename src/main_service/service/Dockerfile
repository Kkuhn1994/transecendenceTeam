FROM node:18

WORKDIR /service

# package.json kopieren
COPY json/package.json package.json

COPY json/tsconfig.json tsconfig.json

# TypeScript und Typen installieren
RUN npm install --save-dev typescript @types/node

# Fastify installieren
RUN npm install fastify @fastify/static

RUN npm install @fastify/cookie

# Quellcode kopieren
COPY . .

# public-Verzeichnis erstellen
RUN mkdir -p public

# TypeScript kompilieren
RUN npx tsc frontend/login.ts --outDir ./frontend --lib "ES2015,DOM"

# Startbefehl
CMD ["node", "index.js"]
