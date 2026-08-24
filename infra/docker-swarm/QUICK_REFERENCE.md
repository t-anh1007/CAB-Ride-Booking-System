QUICK REFERENCE: DOCKER SWARM DEPLOYMENT

═══════════════════════════════════════════════════════════════════════════════

SCENARIO 1: Chạy setup hoàn toàn tự động (khuyến nghị lần đầu)

```bash
cd cab-booking-system
chmod +x infra/docker-swarm/*.sh
bash infra/docker-swarm/setup-complete.sh
```

Điều này sẽ hướng dẫn bạn từng bước:
✓ Clone repo (tuỳ chọn)
✓ Cấu hình registry
✓ Build & push images
✓ Khởi tạo Swarm
✓ Cấu hình .env
✓ Label nodes
✓ Deploy stack

═══════════════════════════════════════════════════════════════════════════════

SCENARIO 2: Từng bước chi tiết (kiểm soát hơn)

# 1. Chuẩn bị
sudo apt-get update && sudo apt-get install -y docker.io git
sudo usermod -aG docker $USER && newgrp docker

# 2. Clone repo
git clone <your-repo-url> cab-booking-system
cd cab-booking-system

# 3. Make scripts executable
chmod +x infra/docker-swarm/*.sh

# 4. Cấu hình registry & tag
export REGISTRY=ghcr.io/your-username/cab-booking
export IMAGE_TAG=latest

# 5. Build images
bash infra/docker-swarm/build-images.sh

# 6. Login và push images
docker login ghcr.io
bash infra/docker-swarm/push-images.sh

# 7. Khởi tạo Swarm
bash infra/docker-swarm/init-swarm.sh

# 8. Cấu hình .env
cp infra/docker-swarm/.env.example infra/docker-swarm/.env
nano infra/docker-swarm/.env  # Edit PASSWORD, URLs

# 9. Label nodes (nếu multi-node)
bash infra/docker-swarm/label-nodes.sh

# 10. Deploy stack
bash infra/docker-swarm/deploy-stack.sh

═══════════════════════════════════════════════════════════════════════════════

SCENARIO 3: Chỉ update stack (không rebuild images)

```bash
# Edit docker-stack.yml hoặc .env nếu cần
# Rồi deploy lại
bash infra/docker-swarm/deploy-stack.sh
```

═══════════════════════════════════════════════════════════════════════════════

SCENARIO 4: Troubleshooting / Monitoring

# Xem trạng thái services
docker stack services cab-booking

# Xem logs từ service cụ thể
docker service logs cab-booking_api-gateway -f

# Xem tasks/containers của service
docker stack ps cab-booking

# Xem chi tiết một service
docker service inspect cab-booking_api-gateway

# Kiểm tra cluster nodes
docker node ls

# Scale service
docker service scale cab-booking_api-gateway=3

═══════════════════════════════════════════════════════════════════════════════

SCENARIO 5: Dừng / Remove Stack

# Remove stack (services/tasks bị xóa, volumes vẫn giữ)
docker stack rm cab-booking

# Xóa volumes
docker volume rm cab-booking_postgres_data
docker volume rm cab-booking_mongodb_data

# Leave Swarm (nếu không dùng nữa)
docker swarm leave --force

═══════════════════════════════════════════════════════════════════════════════

ENVIRONMENT VARIABLES (.env) - KEY POINTS

STACK_NAME=cab-booking              # Tên stack (không đổi được dễ)
REGISTRY=ghcr.io/username/cab-booking  # URL registry
IMAGE_TAG=latest                    # Tag images

ADMIN_DASHBOARD_PORT=8081           # Port frontend dashboard
CUSTOMER_APP_PORT=8082              # Port customer app
DRIVER_APP_PORT=8083                # Port driver app
API_GATEWAY_PORT=8080               # Port API gateway

ADMIN_DASHBOARD_REPLICAS=1          # Số instances frontend
API_GATEWAY_REPLICAS=2              # Số instances gateway
APP_SERVICE_REPLICAS=2              # Số instances backend services

API_PUBLIC_URL=http://your-server-ip:8080    # Public API URL
WS_PUBLIC_URL=ws://your-server-ip:8080       # WebSocket URL

POSTGRES_PASSWORD=change-me-strong-password
MONGO_INITDB_ROOT_PASSWORD=change-me-strong-password
REDIS_PASSWORD=change-me-strong-password

═══════════════════════════════════════════════════════════════════════════════

NODE LABELS TOPOLOGY

tier=edge                           # API Gateway, Frontend
  ├─ region=primary

tier=app                            # Backend Services
  ├─ region=primary
  └─ region=secondary

tier=data                           # Kafka, PostgreSQL, MongoDB, Redis
  └─ region=primary

═══════════════════════════════════════════════════════════════════════════════

COMMON ISSUES & QUICK FIXES

Issue: Services not starting
Fix: docker service ps cab-booking <SERVICE> --no-trunc
     Check logs: docker service logs cab-booking_<SERVICE>

Issue: Image not found
Fix: docker pull ${REGISTRY}/<IMAGE>:${TAG}
     Or re-login: docker login ghcr.io

Issue: Port already in use
Fix: Change ports in .env, redeploy stack

Issue: Swarm not initialized
Fix: docker swarm init --advertise-addr <YOUR_IP>

Issue: Worker can't join
Fix: Make sure ports 2377, 7946 (tcp/udp), 4789 (udp) are open

═══════════════════════════════════════════════════════════════════════════════

VERIFY ENDPOINTS

# API Gateway health check
curl -s http://localhost:8080/health

# Admin Dashboard
curl -s http://localhost:8081

# Check if services are responding
curl -s http://localhost:8080/api/v1/health

═══════════════════════════════════════════════════════════════════════════════

PRODUCTION CHECKLIST

□ Use strong passwords in .env (not defaults)
□ Use DNS names instead of IPs in API_PUBLIC_URL
□ Enable SSL/TLS (use reverse proxy like Nginx/Traefik)
□ Configure firewall rules (allow only necessary ports)
□ Use private registry with authentication
□ Set resource limits in docker-stack.yml
□ Configure persistent volumes on shared storage (NFS/Ceph)
□ Enable Docker event logging & monitoring
□ Set up backups for database volumes
□ Configure health checks & auto-restart policies

═══════════════════════════════════════════════════════════════════════════════

MORE INFORMATION

See HUONG_DAN_DOCKER_SWARM.md for detailed documentation:
- Full prerequisites & installation steps
- Step-by-step deployment procedure
- Multi-node cluster setup
- Monitoring & scaling
- Troubleshooting guide
- Production hardening tips

═══════════════════════════════════════════════════════════════════════════════
