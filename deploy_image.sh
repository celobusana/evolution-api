#!/bin/bash

# Load environment variables from .env file
if [ ! -f ".env" ]; then
    echo "Error: .env file not found!"
    exit 1
fi

# Source the .env file
set -a
source .env
set +a

# Check required variables
if [ -z "$SSH_USER" ] || [ -z "$SSH_HOST" ] || [ -z "$SSH_PORT" ]; then
    echo "Error: Required SSH variables not found in .env file!"
    echo "Please set: SSH_USER, SSH_HOST, SSH_PORT"
    exit 1
fi

if [ -z "$IMAGE_NAME" ]; then
    echo "Error: IMAGE_NAME not found in .env file!"
    exit 1
fi

# Get version from package.json
VERSION=$(grep -m 1 '"version":' package.json | sed -E 's/.*"version": "(.*)".*/\1/')
if [ -z "$VERSION" ]; then
    VERSION="latest"
fi

echo "Using version $VERSION from package.json"

# Set default values if not provided in .env
DOCKERFILE_DIR="${DOCKERFILE_DIR:-Dockerfile}"
REMOTE_IMAGE_DIR="${REMOTE_IMAGE_DIR:-/home/$SSH_USER/docker-images}"

# SSH connection multiplexing setup
SSH_CONTROL_PATH="/tmp/ssh-deploy-control-%r@%h:%p"
SSH_MASTER_OPTS="-o ControlMaster=yes -o ControlPath=$SSH_CONTROL_PATH -o ControlPersist=20m"
SSH_REUSE_OPTS="-o ControlMaster=no -o ControlPath=$SSH_CONTROL_PATH"

# Function to establish SSH master connection
establish_ssh_connection() {
    echo "Establishing SSH connection to $SSH_HOST..."
    ssh $SSH_MASTER_OPTS -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" -N -f
    if [ $? -ne 0 ]; then
        echo "Failed to establish SSH connection!"
        exit 1
    fi
    echo "SSH connection established successfully."
}

# Function to cleanup SSH master connection
cleanup_ssh_connection() {
    echo "Cleaning up SSH connection..."
    ssh $SSH_REUSE_OPTS -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" -O exit 2>/dev/null || true
}

# Trap to ensure cleanup on script exit
trap cleanup_ssh_connection EXIT

# Build the Docker image
echo "Building Docker image: $IMAGE_NAME:$VERSION..."
docker build -t "$IMAGE_NAME:$VERSION" -f "$DOCKERFILE_DIR" .

if [ $? -ne 0 ]; then
    echo "Docker build failed!"
    exit 1
fi

# Save the image as a .tar file
IMAGE_TAR_FILE="$IMAGE_NAME-$VERSION.tar"
echo "Saving Docker image as $IMAGE_TAR_FILE..."
docker save -o "$IMAGE_TAR_FILE" "$IMAGE_NAME:$VERSION"

# Establish SSH connection
establish_ssh_connection

# Create remote directory if it doesn't exist
echo "Creating remote directory if needed..."
ssh $SSH_REUSE_OPTS -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "mkdir -p $REMOTE_IMAGE_DIR"

# Transfer the Docker image to the server
echo "Transferring Docker image to server..."
scp $SSH_REUSE_OPTS -P "$SSH_PORT" "$IMAGE_TAR_FILE" "$SSH_USER@$SSH_HOST:$REMOTE_IMAGE_DIR"

if [ $? -ne 0 ]; then
    echo "Failed to transfer image!"
    rm "$IMAGE_TAR_FILE"
    exit 1
fi

# Load the image on the remote server
echo "Loading Docker image on remote server..."
ssh $SSH_REUSE_OPTS -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" <<EOF
    echo 'Loading Docker image...'
    docker load -i $REMOTE_IMAGE_DIR/$IMAGE_TAR_FILE
    
    if [ \$? -eq 0 ]; then
        echo "Image loaded successfully: $IMAGE_NAME:$VERSION"
        echo "Available images:"
        docker images | grep $IMAGE_NAME
    else
        echo "Failed to load image!"
        exit 1
    fi
    
    echo 'Cleaning up remote image file...'
    rm $REMOTE_IMAGE_DIR/$IMAGE_TAR_FILE || true
EOF

# Clean up local .tar file
echo "Cleaning up local image file..."
rm "$IMAGE_TAR_FILE"

echo "Image deployment completed successfully!"
echo "Image $IMAGE_NAME:$VERSION is now available on the remote server."