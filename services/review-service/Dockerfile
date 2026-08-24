FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/review-service/package.json services/review-service/package.json
COPY platform platform
COPY services/review-service services/review-service

RUN npm ci --workspace @cab/review-service --include-workspace-root

WORKDIR /app/services/review-service

ENV PORT=3106

CMD ["npm", "run", "start"]
