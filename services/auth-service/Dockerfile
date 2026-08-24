FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/auth-service/package.json services/auth-service/package.json
COPY platform platform
COPY services/auth-service services/auth-service

RUN npm ci --workspace @cab/auth-service --include-workspace-root

WORKDIR /app/services/auth-service

ENV PORT=3104
EXPOSE 3104

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const http=require('http'); const req=http.get('http://127.0.0.1:3104/api/v1/auth/health',(res)=>{res.resume(); res.on('end',()=>process.exit(res.statusCode===200?0:1));}); req.on('error',()=>process.exit(1)); req.setTimeout(2000,()=>{req.destroy(); process.exit(1);});"

CMD ["npm", "run", "start"]
