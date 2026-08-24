FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/user-service/package.json services/user-service/package.json
COPY platform platform
COPY services/user-service services/user-service

RUN npm ci --workspace @cab/user-service --include-workspace-root

WORKDIR /app/services/user-service

ENV PORT=3105

CMD ["npm", "run", "start"]
