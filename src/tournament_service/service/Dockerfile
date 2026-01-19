FROM node:18

WORKDIR /service
COPY . .

RUN npm -y init
RUN npm install sqlite3 fastify

CMD ["node", "index.js"]
