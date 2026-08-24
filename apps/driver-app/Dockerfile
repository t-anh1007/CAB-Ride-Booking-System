FROM node:20-bookworm-slim AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/driver-app/package.json apps/driver-app/package.json

RUN npm install --workspace @cab/driver-app --include=optional
RUN npm install @rollup/rollup-linux-x64-gnu --no-save

COPY apps/driver-app apps/driver-app

WORKDIR /workspace/apps/driver-app
RUN npm run build

FROM nginx:1.27-alpine

COPY apps/driver-app/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/driver-app/docker-entrypoint.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

COPY --from=build /workspace/apps/driver-app/dist /usr/share/nginx/html

ENV API_BASE_URL=http://localhost:3000
ENV WS_BASE_URL=ws://localhost:3000

EXPOSE 80
