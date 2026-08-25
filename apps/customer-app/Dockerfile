FROM node:20-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY packages/web-shared/package.json packages/web-shared/package.json
COPY apps/customer-app/package.json apps/customer-app/package.json
RUN npm ci --workspace @cab/customer-app --include=optional
COPY packages/web-shared packages/web-shared
COPY apps/customer-app apps/customer-app
RUN npm run build --workspace @cab/customer-app
FROM nginx:1.27-alpine
COPY apps/customer-app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/customer-app/dist /usr/share/nginx/html
EXPOSE 80
