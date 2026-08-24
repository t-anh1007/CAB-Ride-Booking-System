#!/bin/bash

# File: infra/docker-swarm/init-swarm.sh
# Mục đích: Khởi tạo Docker Swarm cluster

set -e  # Exit if any command fails

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get advertise address from argument or detect automatically
ADVERTISE_ADDR="${1:=$(hostname -I | awk '{print $1}')}"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Initializing Docker Swarm${NC}"
echo -e "${YELLOW}========================================${NC}"

# Check Docker is running
echo -e "\n${YELLOW}Checking Docker status...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    exit 1
fi

# Check current Swarm state
SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")

if [ "$SWARM_STATE" = "active" ]; then
    echo -e "${GREEN}Docker Swarm is already initialized on this node${NC}"
    MANAGER_NAME=$(docker info --format '{{.Name}}')
    echo -e "${YELLOW}Manager node: ${GREEN}$MANAGER_NAME${NC}"
else
    echo -e "${YELLOW}Initializing Docker Swarm with advertise address: ${GREEN}$ADVERTISE_ADDR${NC}"
    
    if docker swarm init --advertise-addr "$ADVERTISE_ADDR"; then
        echo -e "${GREEN}✓ Docker Swarm initialized successfully${NC}"
    else
        echo -e "${RED}✗ Failed to initialize Docker Swarm${NC}"
        exit 1
    fi
fi

# Get manager name
MANAGER_NAME=$(docker info --format '{{.Name}}')

# Label the manager node
echo -e "\n${YELLOW}Labeling manager node: ${GREEN}$MANAGER_NAME${NC}"
docker node update --label-add tier=edge --label-add region=primary "$MANAGER_NAME"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Swarm Initialized Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Current Node:${NC}"
docker node ls --format "table {{.ID}}\t{{.Hostname}}\t{{.Status}}\t{{.ManagerStatus}}"

echo -e "\n${YELLOW}Swarm Join Tokens:${NC}"
echo ""
echo -e "${YELLOW}Worker join token:${NC}"
docker swarm join-token worker -q
echo ""
echo -e "${YELLOW}Manager join token:${NC}"
docker swarm join-token manager -q
echo ""

echo -e "${YELLOW}To add a worker node, run on the worker:${NC}"
echo -e "  ${GREEN}docker swarm join --token <WORKER_TOKEN> $ADVERTISE_ADDR:2377${NC}"
echo ""
echo -e "${YELLOW}After workers join, label them with:${NC}"
echo -e "  ${GREEN}./infra/docker-swarm/label-nodes.sh <MANAGER> <APP_NODES> <DATA_NODE>${NC}"
