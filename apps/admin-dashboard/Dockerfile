FROM node:20-bookworm-slim AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/admin-dashboard/package.json apps/admin-dashboard/package.json

RUN npm install --workspace @cab/admin-dashboard --include=optional
RUN npm install @rollup/rollup-linux-x64-gnu --no-save

COPY apps/admin-dashboard apps/admin-dashboard

WORKDIR /workspace/apps/admin-dashboard
RUN npm run build

FROM nginx:1.27-alpine

COPY apps/admin-dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/admin-dashboard/docker-entrypoint.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

COPY --from=build /workspace/apps/admin-dashboard/dist /usr/share/nginx/html

ENV API_BASE_URL=http://localhost:3000

EXPOSE 80
