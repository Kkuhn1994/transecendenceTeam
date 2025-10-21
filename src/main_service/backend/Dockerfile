# FROM debian:latest

# WORKDIR /backend

# COPY . .

# RUN apt update && apt upgrade && apt install -y \
#     curl

# RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -

# RUN apt install -y nodejs && npm install

# CMD ["node", "index.js"]

FROM node:18

WORKDIR /backend

COPY . .

RUN npm -y init

RUN npm install
RUN npm install express


CMD ["node", "index.js"]

