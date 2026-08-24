FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/pricing-service/package.json services/pricing-service/package.json
COPY platform platform
COPY services/pricing-service services/pricing-service

RUN npm ci --workspace @cab/pricing-service --include-workspace-root

WORKDIR /app/services/pricing-service

ENV PORT=3101

CMD ["npm", "run", "start"]
