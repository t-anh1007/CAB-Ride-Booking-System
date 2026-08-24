FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY gateway/api-gateway/package.json gateway/api-gateway/package.json
COPY platform platform
COPY gateway/api-gateway gateway/api-gateway

RUN npm ci --workspace @cab/api-gateway --include-workspace-root

WORKDIR /app/gateway/api-gateway

ENV PORT=3000

CMD ["npm", "run", "start"]
