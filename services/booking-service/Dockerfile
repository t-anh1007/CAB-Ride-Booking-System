FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/booking-service/package.json services/booking-service/package.json
COPY platform platform
COPY services/booking-service services/booking-service

RUN npm install --workspace @cab/booking-service --include-workspace-root

WORKDIR /app/services/booking-service

ENV PORT=3103

CMD ["npm", "run", "start"]
