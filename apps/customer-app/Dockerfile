FROM node:20-bookworm-slim AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/customer-app/package.json apps/customer-app/package.json

RUN npm install --workspace @cab/customer-app --include=optional
RUN npm install @rollup/rollup-linux-x64-gnu --no-save

COPY apps/customer-app apps/customer-app

WORKDIR /workspace/apps/customer-app
RUN npm run build

FROM nginx:1.27-alpine

COPY apps/customer-app/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/customer-app/docker-entrypoint.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

COPY --from=build /workspace/apps/customer-app/dist /usr/share/nginx/html

ENV API_BASE_URL=http://localhost:3000
ENV WS_BASE_URL=ws://localhost:3000

EXPOSE 80
