FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY server server
RUN npm run build -w server
EXPOSE 3001
CMD ["sh", "-c", "node server/dist/database/seed.js && node server/dist/main.js"]
