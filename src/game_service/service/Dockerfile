FROM node:18

WORKDIR /service

COPY . .

RUN apt-get update && apt-get install -y sqlite3

RUN npm -y init

RUN npm install sqlite3 fastify @fastify/cookie undici


CMD ["node", "index.js"]