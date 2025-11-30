FROM node:18

WORKDIR /service

COPY . .

RUN npm -y init

RUN npm install sqlite3 fastify @fastify/cookie


CMD ["node", "index.js"]