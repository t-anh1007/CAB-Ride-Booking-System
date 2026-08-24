FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/ride-service/package.json services/ride-service/package.json
COPY platform platform
COPY services/ride-service services/ride-service

RUN npm ci --workspace @cab/ride-service --include-workspace-root

WORKDIR /app/services/ride-service

ENV PORT=3109
EXPOSE 3109

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const http=require('http'); const req=http.get('http://127.0.0.1:3109/health',(res)=>{res.resume(); res.on('end',()=>process.exit(res.statusCode===200?0:1));}); req.on('error',()=>process.exit(1)); req.setTimeout(2000,()=>{req.destroy(); process.exit(1);});"

CMD ["npm", "run", "start"]
