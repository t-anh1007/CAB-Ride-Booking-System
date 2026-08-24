FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY AI-ML/eta-service/package.json AI-ML/eta-service/package.json
COPY platform platform

RUN npm ci --workspace @cab/eta-ai-service --include-workspace-root

COPY AI-ML/eta-service AI-ML/eta-service

WORKDIR /app/AI-ML/eta-service

ENV PORT=3110
EXPOSE 3110

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const http=require('http'); const req=http.get('http://127.0.0.1:3110/health',(res)=>{res.resume(); res.on('end',()=>process.exit(res.statusCode===200?0:1));}); req.on('error',()=>process.exit(1)); req.setTimeout(2000,()=>{req.destroy(); process.exit(1);});"

CMD ["npm", "run", "start"]
