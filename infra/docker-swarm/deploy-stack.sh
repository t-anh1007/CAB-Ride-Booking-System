#!/bin/bash

# File: infra/docker-swarm/deploy-stack.sh
# Mục đích: Deploy stack lên Docker Swarm cluster

set -e  # Exit if any command fails

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE="${1:-infra/docker-swarm/.env}"
STACK_FILE="${2:-infra/docker-swarm/docker-stack.yml}"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Deploying Docker Stack to Swarm${NC}"
echo -e "${YELLOW}========================================${NC}"

# Check if env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: Environment file not found: $ENV_FILE${NC}"
    exit 1
fi

# Check if stack file exists
if [ ! -f "$STACK_FILE" ]; then
    echo -e "${RED}Error: Stack file not found: $STACK_FILE${NC}"
    exit 1
fi

# Load environment variables
echo -e "\n${YELLOW}Loading environment from: $ENV_FILE${NC}"
set -a
source "$ENV_FILE"
set +a

# Validate required variables
if [ -z "$STACK_NAME" ]; then
    echo -e "${RED}Error: STACK_NAME not defined in $ENV_FILE${NC}"
    exit 1
fi

if [ -z "$REGISTRY" ]; then
    echo -e "${RED}Error: REGISTRY not defined in $ENV_FILE${NC}"
    exit 1
fi

if [ -z "$IMAGE_TAG" ]; then
    echo -e "${RED}Error: IMAGE_TAG not defined in $ENV_FILE${NC}"
    exit 1
fi

# Check Docker Swarm status
echo -e "\n${YELLOW}Checking Docker Swarm status...${NC}"
SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")

if [ "$SWARM_STATE" != "active" ]; then
    echo -e "${RED}Error: Docker Swarm is not active${NC}"
    echo -e "${YELLOW}Initialize Swarm with: docker swarm init --advertise-addr <IP>${NC}"
    exit 1
fi

# Display deployment info
echo -e "\n${GREEN}Deployment Configuration:${NC}"
echo -e "  Stack Name:  ${GREEN}$STACK_NAME${NC}"
echo -e "  Registry:    ${GREEN}$REGISTRY${NC}"
echo -e "  Image Tag:   ${GREEN}$IMAGE_TAG${NC}"
echo -e "  Stack File:  ${GREEN}$STACK_FILE${NC}"
echo ""

# Deploy stack
echo -e "${YELLOW}Deploying stack...${NC}"
docker stack deploy --with-registry-auth -c "$STACK_FILE" "$STACK_NAME"

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to deploy stack${NC}"
    exit 1
fi

# Wait a moment for services to be created
sleep 2

# Display deployed services
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Stack deployed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n${YELLOW}Services:${NC}"
docker stack services "$STACK_NAME"

echo -e "\n${YELLOW}Waiting for services to converge (this may take a few minutes)...${NC}"
echo -e "Run 'docker stack ps $STACK_NAME' to check task status"
echo -e "Run 'docker service logs <SERVICE_NAME>' to view logs"
