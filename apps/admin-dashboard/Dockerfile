FROM node:20-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY packages/web-shared/package.json packages/web-shared/package.json
COPY apps/admin-dashboard/package.json apps/admin-dashboard/package.json
RUN npm ci --workspace @cab/admin-dashboard --include=optional
COPY packages/web-shared packages/web-shared
COPY apps/admin-dashboard apps/admin-dashboard
RUN npm run build --workspace @cab/admin-dashboard
FROM nginx:1.27-alpine
COPY apps/admin-dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/admin-dashboard/dist /usr/share/nginx/html
EXPOSE 80
