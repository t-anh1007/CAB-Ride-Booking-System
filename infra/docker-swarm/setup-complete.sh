#!/bin/bash

# File: infra/docker-swarm/setup-complete.sh
# Mục đích: Hướng dẫn setup toàn bộ từ clone repo đến deploy stack

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print header
print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}\n"
}

# Function to print step
print_step() {
    echo -e "${YELLOW}➜ $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Main setup flow
print_header "CAB-BOOKING: Complete Setup Guide for Docker Swarm"

print_step "Step 1: Verify Prerequisites"
echo "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    echo "Install from: https://docs.docker.com/engine/install/"
    exit 1
fi
print_success "Docker is installed: $(docker --version)"

echo "Checking Git installation..."
if ! command -v git &> /dev/null; then
    print_error "Git is not installed"
    exit 1
fi
print_success "Git is installed: $(git --version | head -n1)"

print_header "Step 2: Clone Repository"
read -p "Enter repository URL [press Enter to skip if already cloned]: " REPO_URL
if [ -n "$REPO_URL" ]; then
    print_step "Cloning repository..."
    git clone "$REPO_URL" cab-booking-system || print_error "Clone failed"
    cd cab-booking-system || exit 1
    print_success "Repository cloned"
else
    print_step "Skipping clone - assuming you're already in the repo directory"
fi

print_header "Step 3: Registry Configuration"
read -p "Enter Docker Registry (e.g., ghcr.io/your-username/cab-booking): " REGISTRY
read -p "Enter Image Tag (default: latest): " IMAGE_TAG
IMAGE_TAG=${IMAGE_TAG:-latest}

print_step "Setting up environment variables..."
export REGISTRY=$REGISTRY
export IMAGE_TAG=$IMAGE_TAG

cat > /tmp/registry.env << EOF
REGISTRY=$REGISTRY
IMAGE_TAG=$IMAGE_TAG
EOF

print_success "Registry configured: $REGISTRY:$IMAGE_TAG"

print_header "Step 4: Build Docker Images"
read -p "Do you want to build images now? (y/n) [default: y]: " BUILD_CHOICE
BUILD_CHOICE=${BUILD_CHOICE:-y}

if [[ "$BUILD_CHOICE" == "y" ]]; then
    print_step "Building images... (this may take 15-30 minutes)"
    print_step "Run: source /tmp/registry.env && bash infra/docker-swarm/build-images.sh"
    
    if [ -f "infra/docker-swarm/build-images.sh" ]; then
        source /tmp/registry.env
        bash infra/docker-swarm/build-images.sh
        if [ $? -eq 0 ]; then
            print_success "All images built successfully"
        else
            print_error "Image build failed"
            exit 1
        fi
    else
        print_error "build-images.sh not found"
    fi
else
    print_step "Skipping image build"
fi

print_header "Step 5: Push Images to Registry"
read -p "Do you want to push images to registry now? (y/n) [default: n]: " PUSH_CHOICE
PUSH_CHOICE=${PUSH_CHOICE:-n}

if [[ "$PUSH_CHOICE" == "y" ]]; then
    print_step "Logging into registry..."
    docker login "$REGISTRY" || print_error "Registry login failed"
    
    print_step "Pushing images... (this may take 10-20 minutes)"
    if [ -f "infra/docker-swarm/push-images.sh" ]; then
        source /tmp/registry.env
        bash infra/docker-swarm/push-images.sh
        if [ $? -eq 0 ]; then
            print_success "All images pushed successfully"
        else
            print_error "Image push failed"
        fi
    else
        print_error "push-images.sh not found"
    fi
else
    print_step "Skipping image push"
fi

print_header "Step 6: Initialize Docker Swarm"
print_step "Detecting IP address for Swarm..."
IP_ADDRESS=$(hostname -I | awk '{print $1}')
print_step "Using IP address: $IP_ADDRESS"

read -p "Do you want to initialize Docker Swarm now? (y/n) [default: y]: " SWARM_CHOICE
SWARM_CHOICE=${SWARM_CHOICE:-y}

if [[ "$SWARM_CHOICE" == "y" ]]; then
    if [ -f "infra/docker-swarm/init-swarm.sh" ]; then
        bash infra/docker-swarm/init-swarm.sh "$IP_ADDRESS"
        if [ $? -eq 0 ]; then
            print_success "Docker Swarm initialized"
        else
            print_error "Swarm initialization failed"
        fi
    else
        print_error "init-swarm.sh not found"
    fi
else
    print_step "Skipping Swarm initialization"
fi

print_header "Step 7: Configure Environment Variables"
print_step "Creating .env file for deployment..."

if [ ! -f "infra/docker-swarm/.env" ]; then
    cp infra/docker-swarm/.env.example infra/docker-swarm/.env
    print_success ".env file created from .env.example"
else
    print_step ".env file already exists"
fi

print_step "Updating .env with registry information..."
sed -i "s|REGISTRY=.*|REGISTRY=$REGISTRY|g" infra/docker-swarm/.env
sed -i "s|IMAGE_TAG=.*|IMAGE_TAG=$IMAGE_TAG|g" infra/docker-swarm/.env

echo ""
print_step "Please review and edit infra/docker-swarm/.env"
echo -e "Key variables to check:"
echo -e "  - REGISTRY: Should be $REGISTRY"
echo -e "  - IMAGE_TAG: Should be $IMAGE_TAG"
echo -e "  - Passwords for POSTGRES, MONGO, REDIS"
echo -e "  - API_PUBLIC_URL and WS_PUBLIC_URL"
echo ""

read -p "Press Enter to continue after you've reviewed .env..."

print_header "Step 8: Label Cluster Nodes"
print_step "Current cluster nodes:"
docker node ls --format "table {{.ID}}\t{{.Hostname}}\t{{.Status}}\t{{.ManagerStatus}}"

echo ""
read -p "Do you have multiple worker nodes to label? (y/n) [default: n]: " LABEL_CHOICE
LABEL_CHOICE=${LABEL_CHOICE:-n}

if [[ "$LABEL_CHOICE" == "y" ]]; then
    read -p "Enter manager node name: " MANAGER_NODE
    read -p "Enter app node names (comma-separated): " APP_NODES
    read -p "Enter data node name: " DATA_NODE
    
    if [ -f "infra/docker-swarm/label-nodes.sh" ]; then
        bash infra/docker-swarm/label-nodes.sh "$MANAGER_NODE" "$APP_NODES" "$DATA_NODE"
    else
        print_error "label-nodes.sh not found"
    fi
else
    print_step "Skipping node labeling"
fi

print_header "Step 9: Deploy Stack"
read -p "Do you want to deploy the stack now? (y/n) [default: y]: " DEPLOY_CHOICE
DEPLOY_CHOICE=${DEPLOY_CHOICE:-y}

if [[ "$DEPLOY_CHOICE" == "y" ]]; then
    print_step "Deploying stack..."
    if [ -f "infra/docker-swarm/deploy-stack.sh" ]; then
        bash infra/docker-swarm/deploy-stack.sh infra/docker-swarm/.env infra/docker-swarm/docker-stack.yml
        if [ $? -eq 0 ]; then
            print_success "Stack deployed successfully"
        else
            print_error "Stack deployment failed"
        fi
    else
        print_error "deploy-stack.sh not found"
    fi
else
    print_step "Skipping deployment"
fi

print_header "Step 10: Monitor Deployment"
print_step "Useful commands to monitor your deployment:"
echo ""
echo -e "${YELLOW}Check services status:${NC}"
echo "  docker stack services cab-booking"
echo ""
echo -e "${YELLOW}Check task status:${NC}"
echo "  docker stack ps cab-booking"
echo ""
echo -e "${YELLOW}View service logs:${NC}"
echo "  docker service logs cab-booking_api-gateway"
echo ""
echo -e "${YELLOW}Scale a service:${NC}"
echo "  docker service scale cab-booking_api-gateway=3"
echo ""

print_header "Setup Complete!"
print_success "Docker Swarm deployment is ready"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Monitor the services: docker stack services cab-booking"
echo "2. Check logs: docker service logs <SERVICE_NAME>"
echo "3. Scale services as needed"
echo "4. Configure DNS and SSL (for production)"
echo ""
