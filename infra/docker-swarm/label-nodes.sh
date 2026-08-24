#!/bin/bash

# File: infra/docker-swarm/label-nodes.sh
# Mục đích: Gán labels cho các nodes trong Swarm cluster

set -e  # Exit if any command fails

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default node names (có thể override qua arguments)
EDGE_NODE="${1:-swarm-manager-1}"
APP_NODES="${2:-swarm-worker-app-1}"
DATA_NODE="${3:-swarm-worker-data-1}"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Labeling Swarm Nodes${NC}"
echo -e "${YELLOW}========================================${NC}"

# Function to label a node
label_node() {
    local node=$1
    local tier=$2
    local region=$3
    
    echo -e "\n${YELLOW}Labeling node: $node (tier=$tier, region=$region)${NC}"
    
    # Remove existing labels
    docker node update --label-rm tier "$node" 2>/dev/null || true
    docker node update --label-rm region "$node" 2>/dev/null || true
    
    # Add new labels
    docker node update --label-add tier="$tier" --label-add region="$region" "$node"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Labeled: $node${NC}"
    else
        echo -e "${RED}✗ Failed to label: $node${NC}"
        exit 1
    fi
}

# Get all node IDs
echo -e "\n${YELLOW}Current Swarm Nodes:${NC}"
docker node ls --format "table {{.ID}}\t{{.Hostname}}\t{{.Status}}\t{{.ManagerStatus}}"

# Label edge node (manager)
label_node "$EDGE_NODE" "edge" "primary"

# Label app nodes
IFS=',' read -ra NODES <<< "$APP_NODES"
counter=1
for node in "${NODES[@]}"; do
    node=$(echo "$node" | xargs)  # trim whitespace
    if [ -n "$node" ]; then
        if [ $counter -eq 1 ]; then
            label_node "$node" "app" "primary"
        else
            label_node "$node" "app" "secondary"
        fi
        counter=$((counter + 1))
    fi
done

# Label data node
label_node "$DATA_NODE" "data" "primary"

# Display final state
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Node labeling completed!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Node Labels Summary:${NC}"
docker node ls --format "table {{.ID}}\t{{.Hostname}}\t{{.Labels}}"
