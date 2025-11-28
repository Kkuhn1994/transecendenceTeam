FROM node:18

WORKDIR /service

COPY . .

RUN npm -y init

RUN npm install

# SQLite3-Modul installieren (für Node.js)
RUN npm install sqlite3

RUN npm install fastify @fastify/cookie

CMD ["node", "index.js"]