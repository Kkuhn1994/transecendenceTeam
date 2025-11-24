FROM debian:latest

RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx

COPY default /etc/nginx/sites-available/.

CMD ["nginx", "-g", "daemon off;"]