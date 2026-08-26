FROM node:20-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY packages/web-shared/package.json packages/web-shared/package.json
COPY apps/driver-app/package.json apps/driver-app/package.json
RUN npm ci --workspace @cab/driver-app --include=optional
COPY packages/web-shared packages/web-shared
COPY apps/driver-app apps/driver-app
RUN npm run build --workspace @cab/driver-app
FROM nginx:1.27-alpine
COPY apps/driver-app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/driver-app/dist /usr/share/nginx/html
EXPOSE 80
