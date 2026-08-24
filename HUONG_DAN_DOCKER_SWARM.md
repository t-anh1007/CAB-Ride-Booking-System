HƯỚNG DẪN TRIỂN KHAI DOCKER SWARM TRÊN LINUX (CLI)

Mô tả ngắn: Hướng dẫn này mô tả cách pull dự án từ Git, build images, push lên registry, khởi tạo Docker Swarm cluster, và triển khai stack trên Linux CLI (không dùng PowerShell).

Tổng Quan: Quy trình bao gồm:
1. Chuẩn bị máy Linux + Docker
2. Clone repo từ Git
3. Build images và push lên Container Registry
4. Khởi tạo Docker Swarm cluster
5. Cấu hình biến môi trường
6. Deploy stack lên Swarm
7. Kiểm tra và scale services

=== PHẦN 1: TIỀN ĐỀ VÀ CHUẨN BỊ ===

1.1 Yêu cầu hệ thống (Linux)
- Ubuntu 20.04 LTS hoặc CentOS 8+ hoặc Rocky Linux 9+
- Docker 24.0+ (cài đặt từ https://docs.docker.com/engine/install/)
- Docker Compose (plugin, đã có sẵn với Docker 24.0+)
- Git
- RAM: tối thiểu 4GB cho Swarm cluster (khuyến nghị 8GB+)
- CPU: tối thiểu 2 core (khuyến nghị 4+)

1.2 Cài đặt Docker trên Linux (Ubuntu):

```bash
# Update package manager
sudo apt-get update

# Cài Docker official repository
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Cài Docker & Docker Compose
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Cho phép user hiện tại chạy docker mà không cần sudo (tuỳ chọn)
sudo usermod -aG docker $USER
newgrp docker

# Kiểm tra
docker --version
docker compose version
```

1.3 Cài đặt Git:

```bash
sudo apt-get install -y git
git --version
```

=== PHẦN 2: CLONE REPO TỪ GIT ===

2.1 Clone dự án:

```bash
# Thay <your-repo-url> bằng URL repo thực tế
git clone <your-repo-url> cab-booking-system
cd cab-booking-system
git checkout main  # hoặc branch cần dùng
```

2.2 Kiểm tra cấu trúc repo:

```bash
ls -la
# Xem các thư mục chính: apps/, services/, gateway/, infra/, docs/, ...
```

=== PHẦN 3: BUILD IMAGES VÀ PUSH LÊN REGISTRY ===

3.1 Chuẩn bị Container Registry

Bạn cần một registry để lưu images (có thể dùng):
- Docker Hub (https://hub.docker.com/)
- GitHub Container Registry (GHCR)
- Private registry (nexus, harbor, etc.)

Ví dụ dùng GitHub Container Registry (GHCR):

```bash
# Login vào GHCR
docker login ghcr.io
# Nhập username (có thể là tên GitHub)
# Nhập personal access token (PAT) có scope packages:write

# Hoặc dùng Docker Hub
docker login docker.io
```

3.2 Build tất cả images

Tạo script `build-images.sh`:

```bash
#!/bin/bash

# Set registry và tag
REGISTRY=ghcr.io/your-username/cab-booking  # Thay your-username
IMAGE_TAG=latest

# Build frontend apps
docker build -t ${REGISTRY}/admin-dashboard:${IMAGE_TAG} -f apps/admin-dashboard/Dockerfile .
docker build -t ${REGISTRY}/customer-app:${IMAGE_TAG} -f apps/customer-app/Dockerfile .
docker build -t ${REGISTRY}/driver-app:${IMAGE_TAG} -f apps/driver-app/Dockerfile .

# Build API Gateway
docker build -t ${REGISTRY}/api-gateway:${IMAGE_TAG} -f gateway/api-gateway/Dockerfile .

# Build backend services
docker build -t ${REGISTRY}/auth-service:${IMAGE_TAG} -f services/auth-service/Dockerfile .
docker build -t ${REGISTRY}/booking-service:${IMAGE_TAG} -f services/booking-service/Dockerfile .
docker build -t ${REGISTRY}/driver-service:${IMAGE_TAG} -f services/driver-service/Dockerfile .
docker build -t ${REGISTRY}/payment-service:${IMAGE_TAG} -f services/payment-service/Dockerfile .
docker build -t ${REGISTRY}/pricing-service:${IMAGE_TAG} -f services/pricing-service/Dockerfile .
docker build -t ${REGISTRY}/review-service:${IMAGE_TAG} -f services/review-service/Dockerfile .
docker build -t ${REGISTRY}/ride-service:${IMAGE_TAG} -f services/ride-service/Dockerfile .
docker build -t ${REGISTRY}/notification-service:${IMAGE_TAG} -f services/notification-service/Dockerfile .
docker build -t ${REGISTRY}/user-service:${IMAGE_TAG} -f services/user-service/Dockerfile .

# Build AI/ML services
docker build -t ${REGISTRY}/matching-service:${IMAGE_TAG} -f AI-ML/matching-service/Dockerfile .
docker build -t ${REGISTRY}/eta-service:${IMAGE_TAG} -f AI-ML/eta-service/Dockerfile .
docker build -t ${REGISTRY}/surge-pricing-service:${IMAGE_TAG} -f AI-ML/surge-pricing-service/Dockerfile .

echo "Build xong tất cả images"
```

Chạy script:

```bash
chmod +x build-images.sh
./build-images.sh
```

3.3 Push images lên registry:

Tạo script `push-images.sh`:

```bash
#!/bin/bash

REGISTRY=ghcr.io/your-username/cab-booking
IMAGE_TAG=latest

# List tất cả images cần push
IMAGES=(
    "admin-dashboard"
    "customer-app"
    "driver-app"
    "api-gateway"
    "auth-service"
    "booking-service"
    "driver-service"
    "payment-service"
    "pricing-service"
    "review-service"
    "ride-service"
    "notification-service"
    "user-service"
    "matching-service"
    "eta-service"
    "surge-pricing-service"
)

for image in "${IMAGES[@]}"; do
    docker push ${REGISTRY}/${image}:${IMAGE_TAG}
done

echo "Push xong tất cả images"
```

Chạy script:

```bash
chmod +x push-images.sh
./push-images.sh
```

=== PHẦN 4: KHỞI TẠO DOCKER SWARM CLUSTER ===

4.1 Trên Manager node (Linux chính):

```bash
# Lấy IP address của node (thay eth0 nếu cần)
IP_ADDRESS=$(hostname -I | awk '{print $1}')
echo "IP address: $IP_ADDRESS"

# Khởi tạo Swarm
docker swarm init --advertise-addr $IP_ADDRESS

# Output sẽ có worker join token & manager join token
# Lưu token để thêm worker nodes
```

4.2 Trên Worker nodes (nếu có):

```bash
# Copy token từ manager node
# Lệnh: docker swarm join --token SWMTKN-xxx <MANAGER_IP>:2377

docker swarm join --token SWMTKN-xxx <MANAGER_IP>:2377
```

4.3 Kiểm tra cluster:

```bash
docker node ls
docker info --format '{{.Swarm}}'
```

=== PHẦN 5: CẤU HÌNH BIẾN MÔI TRƯỜNG ===

5.1 Tạo file .env cho Swarm:

```bash
# Copy từ file example
cp infra/docker-swarm/.env.example infra/docker-swarm/.env

# Edit file .env
nano infra/docker-swarm/.env
```

Nội dung .env:

```
STACK_NAME=cab-booking
REGISTRY=ghcr.io/your-username/cab-booking
IMAGE_TAG=latest

ADMIN_DASHBOARD_PORT=8081
CUSTOMER_APP_PORT=8082
DRIVER_APP_PORT=8083
API_GATEWAY_PORT=8080

ADMIN_DASHBOARD_REPLICAS=1
CUSTOMER_APP_REPLICAS=1
DRIVER_APP_REPLICAS=1
API_GATEWAY_REPLICAS=2
APP_SERVICE_REPLICAS=2

API_PUBLIC_URL=http://your-server-ip:8080
WS_PUBLIC_URL=ws://your-server-ip:8080

KAFKA_BROKERS=kafka:9092

POSTGRES_DB=cab_booking
POSTGRES_USER=cab_user
POSTGRES_PASSWORD=change-me-strong-password

MONGO_DB=cab_booking
MONGO_INITDB_ROOT_USERNAME=cab_root
MONGO_INITDB_ROOT_PASSWORD=change-me-strong-password

REDIS_PASSWORD=change-me-strong-password
```

5.2 Gán label cho nodes (nếu có multiple workers):

```bash
# Kiểm tra tên nodes
docker node ls

# Gán label cho từng node
# Edge tier (gateway, frontend) - thường là manager
docker node update --label-add tier=edge --label-add region=primary <MANAGER_NODE_ID>

# App tier (backend services) - worker nodes
docker node update --label-add tier=app --label-add region=primary <WORKER_1_NODE_ID>
docker node update --label-add tier=app --label-add region=secondary <WORKER_2_NODE_ID>

# Data tier (Kafka, DB, Redis) - data worker
docker node update --label-add tier=data --label-add region=primary <DATA_WORKER_NODE_ID>

# Kiểm tra labels
docker node inspect <NODE_ID> --format='{{.Spec.Labels}}'
```

=== PHẦN 6: DEPLOY STACK ===

6.1 Tạo bash script deploy (thay thế PowerShell):

```bash
#!/bin/bash
# File: deploy-stack.sh

ENV_FILE="infra/docker-swarm/.env"
STACK_FILE="infra/docker-swarm/docker-stack.yml"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: File env không tồn tại: $ENV_FILE"
    exit 1
fi

# Đọc các biến từ .env và export
set -a
source "$ENV_FILE"
set +a

if [ -z "$STACK_NAME" ]; then
    echo "Error: STACK_NAME chưa được cấu hình trong file .env"
    exit 1
fi

echo "Deploy stack: $STACK_NAME"
echo "Registry: $REGISTRY"
echo "Image tag: $IMAGE_TAG"

# Deploy stack
docker stack deploy --with-registry-auth -c "$STACK_FILE" "$STACK_NAME"

if [ $? -ne 0 ]; then
    echo "Deploy stack thất bại"
    exit 1
fi

# Kiểm tra services
echo ""
echo "Services:"
docker stack services "$STACK_NAME"
```

Chạy deploy:

```bash
chmod +x deploy-stack.sh
./deploy-stack.sh
```

6.2 Hoặc deploy trực tiếp (inline):

```bash
# Export các biến từ .env file
export $(cat infra/docker-swarm/.env | grep -v '^#' | xargs)

# Deploy stack
docker stack deploy --with-registry-auth -c infra/docker-swarm/docker-stack.yml $STACK_NAME

# Kiểm tra
docker stack services $STACK_NAME
```

=== PHẦN 7: KIỂM TRA VÀ MONITORING ===

7.1 Kiểm tra trạng thái stack:

```bash
# Xem services
docker stack services cab-booking

# Xem chi tiết một service
docker service inspect cab-booking_api-gateway

# Xem logs của một service
docker service logs cab-booking_api-gateway

# Xem tasks (containers) của một service
docker service ps cab-booking_api-gateway
```

7.2 Kiểm tra endpoints:

```bash
# API Gateway
curl -s http://localhost:8080/health | jq .

# Admin Dashboard
curl -s http://localhost:8081

# Matching Service
curl -s http://localhost:8000/health
```

7.3 Scale services:

```bash
# Scale API Gateway lên 3 replicas
docker service scale cab-booking_api-gateway=3

# Scale booking service
docker service scale cab-booking_booking-service=3

# Kiểm tra
docker stack services cab-booking
```

=== PHẦN 8: UPDATE STACK / ROLLOUT ===

8.1 Update một service:

```bash
# Update API Gateway image
docker service update --image ${REGISTRY}/api-gateway:v1.0.1 cab-booking_api-gateway

# Rollback (khôi phục version trước)
docker service rollback cab-booking_api-gateway
```

8.2 Update toàn bộ stack (deploy lại):

```bash
# Sau khi thay đổi docker-stack.yml hoặc .env
./deploy-stack.sh

# hoặc
docker stack deploy --with-registry-auth -c infra/docker-swarm/docker-stack.yml $STACK_NAME
```

=== PHẦN 9: TROUBLESHOOTING ===

9.1 Services stuck pending:

```bash
# Kiểm tra tại sao không start
docker service ps <SERVICE_NAME> --no-trunc

# Check node resources
docker node inspect <NODE_ID> --format='{{json .Status}}'

# Logs
docker service logs <SERVICE_NAME>
```

9.2 Image không tìm thấy:

```bash
# Kiểm tra image trên node
docker image ls

# Pull image manually
docker pull ${REGISTRY}/<IMAGE>:${TAG}

# Kiểm tra credentials
docker login ghcr.io
```

9.3 Network issues:

```bash
# Kiểm tra networks
docker network ls

# Inspect overlay network
docker network inspect cab-booking_backend-net

# Kiểm tra connectivity từ container
docker exec <CONTAINER_ID> ping <SERVICE_NAME>
```

9.4 Database seed / initialization:

```bash
# Nếu Postgres/Mongo cần khởi tạo, có thể manually run migration
docker exec $(docker ps -q -f "name=cab-booking_postgres") psql -U cab_user -d cab_booking -c "SELECT * FROM users;"

# Hoặc import seed file
docker exec $(docker ps -q -f "name=cab-booking_postgres") psql -U cab_user -d cab_booking < database_test/user-seed.sql
```

=== PHẦN 10: CLEANUP / REMOVE STACK ===

10.1 Xóa stack:

```bash
docker stack rm cab-booking

# Chờ services được remove (có thể mất vài giây)
docker stack ls
```

10.2 Xóa volumes (DB data):

```bash
# Volumes sẽ vẫn tồn tại sau khi remove stack
docker volume ls

# Xóa manual nếu cần
docker volume rm cab-booking_postgres_data
docker volume rm cab-booking_mongodb_data
docker volume rm cab-booking_redis_data
docker volume rm cab-booking_kafka_data
```

10.3 Leave Swarm:

```bash
# Từ worker node
docker swarm leave

# Từ manager node (phải force nếu còn workers)
docker swarm leave --force
```

=== PHẦN 11: QUICK START CHECKLIST ===

```bash
# 1. Chuẩn bị
sudo apt-get update && sudo apt-get install -y docker.io git
sudo usermod -aG docker $USER && newgrp docker

# 2. Clone repo
git clone <repo-url> cab-booking-system
cd cab-booking-system

# 3. Build & Push images
./build-images.sh
./push-images.sh

# 4. Khởi tạo Swarm
IP_ADDRESS=$(hostname -I | awk '{print $1}')
docker swarm init --advertise-addr $IP_ADDRESS

# 5. Cấu hình .env
cp infra/docker-swarm/.env.example infra/docker-swarm/.env
# Chỉnh sửa REGISTRY, PASSWORD, PUBLIC URLs

# 6. Deploy
./deploy-stack.sh

# 7. Kiểm tra
docker stack services cab-booking
curl http://localhost:8080/health

# 8. Scale (tuỳ chọn)
docker service scale cab-booking_api-gateway=2
docker service scale cab-booking_booking-service=3
```

=== PHẦN 12: GHI CHÚ BỔ SUNG ===

12.1 Cấu hình firewall (nếu cần):

```bash
# Ports cần mở
sudo ufw allow 2377/tcp  # Swarm management
sudo ufw allow 7946/tcp  # Swarm communication
sudo ufw allow 7946/udp  # Swarm communication
sudo ufw allow 4789/udp  # Overlay network

# Frontend ports
sudo ufw allow 8080/tcp  # API Gateway
sudo ufw allow 8081/tcp  # Admin Dashboard
sudo ufw allow 8082/tcp  # Customer App
sudo ufw allow 8083/tcp  # Driver App
```

12.2 DNS (nếu chạy trên cloud / multiple servers):

- Cần cấu hình DNS A record trỏ đến manager node IP
- Thay đổi API_PUBLIC_URL & WS_PUBLIC_URL trong .env

12.3 SSL/TLS (khuyến nghị cho production):

- Đặt reverse proxy (Nginx, Traefik) phía trước Swarm
- Cấu hình SSL certificates
- Forward traffic đến Swarm services

12.4 Persistent storage:

- Nếu dùng multiple nodes, cần shared storage (NFS, Ceph, etc.)
- Hoặc dùng volume plugins

---

Nếu gặp vấn đề, check:
1. docker service logs <SERVICE>
2. docker service ps <SERVICE> --no-trunc
3. docker node inspect <NODE> --format='{{json .Status}}'

Hết.
