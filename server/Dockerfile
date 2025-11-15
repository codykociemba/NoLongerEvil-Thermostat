FROM node:24.11.1

WORKDIR /app
COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 443 8081

CMD ["node", "index.js"]