#!/bin/bash

# File: infra/docker-swarm/build-images.sh
# Mục đích: Build tất cả Docker images cho Swarm deployment

set -e  # Exit if any command fails

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY=${REGISTRY:-ghcr.io/your-username/cab-booking}
IMAGE_TAG=${IMAGE_TAG:-latest}

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Building Docker Images for Swarm${NC}"
echo -e "${YELLOW}Registry: $REGISTRY${NC}"
echo -e "${YELLOW}Tag: $IMAGE_TAG${NC}"
echo -e "${YELLOW}========================================${NC}"

# Function to build image
build_image() {
    local name=$1
    local dockerfile=$2
    local image="${REGISTRY}/${name}:${IMAGE_TAG}"
    
    echo -e "\n${YELLOW}Building: $name${NC}"
    docker build -t "$image" -f "$dockerfile" .
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Built: $image${NC}"
    else
        echo -e "${RED}✗ Failed to build: $image${NC}"
        exit 1
    fi
}

# Build Frontend Apps
echo -e "\n${YELLOW}--- Building Frontend Apps ---${NC}"
build_image "admin-dashboard" "apps/admin-dashboard/Dockerfile"
build_image "customer-app" "apps/customer-app/Dockerfile"
build_image "driver-app" "apps/driver-app/Dockerfile"

# Build API Gateway
echo -e "\n${YELLOW}--- Building API Gateway ---${NC}"
build_image "api-gateway" "gateway/api-gateway/Dockerfile"

# Build Backend Services
echo -e "\n${YELLOW}--- Building Backend Services ---${NC}"
build_image "auth-service" "services/auth-service/Dockerfile"
build_image "booking-service" "services/booking-service/Dockerfile"
build_image "driver-service" "services/driver-service/Dockerfile"
build_image "payment-service" "services/payment-service/Dockerfile"
build_image "pricing-service" "services/pricing-service/Dockerfile"
build_image "review-service" "services/review-service/Dockerfile"
build_image "ride-service" "services/ride-service/Dockerfile"
build_image "notification-service" "services/notification-service/Dockerfile"
build_image "user-service" "services/user-service/Dockerfile"

# Build AI/ML Services
echo -e "\n${YELLOW}--- Building AI/ML Services ---${NC}"
build_image "matching-service" "AI-ML/matching-service/Dockerfile"
build_image "eta-service" "AI-ML/eta-service/Dockerfile"
build_image "surge-pricing-service" "AI-ML/surge-pricing-service/Dockerfile"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}All images built successfully!${NC}"
echo -e "${GREEN}========================================${NC}"

# List built images
echo -e "\n${YELLOW}Built Images:${NC}"
docker image ls | grep "${REGISTRY}"
