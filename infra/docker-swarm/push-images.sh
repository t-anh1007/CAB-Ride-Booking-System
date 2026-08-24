#!/bin/bash

# File: infra/docker-swarm/push-images.sh
# Mục đích: Push tất cả Docker images lên registry

set -e  # Exit if any command fails

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY=${REGISTRY:-ghcr.io/your-username/cab-booking}
IMAGE_TAG=${IMAGE_TAG:-latest}

# List of images to push
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

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Pushing Docker Images to Registry${NC}"
echo -e "${YELLOW}Registry: $REGISTRY${NC}"
echo -e "${YELLOW}Tag: $IMAGE_TAG${NC}"
echo -e "${YELLOW}========================================${NC}"

# Check docker login
echo -e "\n${YELLOW}Checking Docker login status...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker daemon is not running${NC}"
    exit 1
fi

# Try to check if logged in by pulling a non-existent image
if ! docker pull "${REGISTRY}/test:latest" > /dev/null 2>&1; then
    echo -e "${YELLOW}You may not be logged in to ${REGISTRY}${NC}"
    echo -e "${YELLOW}Please run: docker login ghcr.io (or your registry)${NC}"
    exit 1
fi

# Push images
for image in "${IMAGES[@]}"; do
    local_image="${REGISTRY}/${image}:${IMAGE_TAG}"
    
    echo -e "\n${YELLOW}Pushing: $image${NC}"
    
    if docker push "$local_image"; then
        echo -e "${GREEN}✓ Pushed: $local_image${NC}"
    else
        echo -e "${RED}✗ Failed to push: $local_image${NC}"
        exit 1
    fi
done

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}All images pushed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
