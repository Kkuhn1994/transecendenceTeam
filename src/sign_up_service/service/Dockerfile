FROM node:18

WORKDIR /service

COPY . .

RUN npm -y init

RUN npm install
RUN npm install fastify


CMD ["node", "index.js"]