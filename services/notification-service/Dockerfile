FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/notification-service/package.json services/notification-service/package.json
COPY platform platform
COPY services/notification-service services/notification-service

RUN npm ci --workspace @cab/notification-service --include-workspace-root

WORKDIR /app/services/notification-service

ENV PORT=3108

CMD ["npm", "run", "start"]
