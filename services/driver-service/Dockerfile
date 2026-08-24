FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/driver-service/package.json services/driver-service/package.json
COPY platform platform
COPY services/driver-service services/driver-service

RUN npm ci --workspace @cab/driver-service --include-workspace-root

WORKDIR /app/services/driver-service

ENV PORT=3107

CMD ["npm", "run", "start"]
