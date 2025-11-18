FROM node:24.11.1

WORKDIR /app
COPY server/package*.json ./
RUN npm install
COPY server/. .

WORKDIR /app
COPY entrypoint.sh .

EXPOSE 80 443 8081

CMD ["/bin/sh", "/app/entrypoint.sh"]