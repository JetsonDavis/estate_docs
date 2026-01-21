#!/bin/bash
set -e

# Estate Docs EC2 Deployment Script
# This script stops running containers, pulls the latest image from Docker Hub, and starts the application

CONTAINER_NAME="estate-doctor"
IMAGE_NAME="jetsondavis/estate-doctor"
DOCUMENT_UPLOADS_DIR="/home/ubuntu/document_uploads"

echo "=========================================="
echo "Estate Doctor Deployment Script"
echo "=========================================="

# Create document uploads directory if it doesn't exist
echo "Checking document uploads directory..."
if [ ! -d "$DOCUMENT_UPLOADS_DIR" ]; then
    echo "Creating $DOCUMENT_UPLOADS_DIR..."
    sudo mkdir -p "$DOCUMENT_UPLOADS_DIR"
    sudo chown -R 1000:1000 "$DOCUMENT_UPLOADS_DIR"
    echo "Directory created and permissions set."
else
    echo "Directory already exists."
fi

# Stop and remove existing container if running
echo ""
echo "Stopping existing container..."
if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
    docker stop "$CONTAINER_NAME"
    echo "Container stopped."
else
    echo "No running container found."
fi

if docker ps -aq -f name="$CONTAINER_NAME" | grep -q .; then
    docker rm "$CONTAINER_NAME"
    echo "Container removed."
fi

# Pull the latest image from Docker Hub
echo ""
echo "Pulling latest image from Docker Hub..."
docker pull "$IMAGE_NAME":latest

# Run the container
echo ""
echo "Starting container..."
docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p 80:80 \
    -e DATABASE_URL="${DATABASE_URL:-postgresql://postgres:YOUR_PASSWORD@estate-doctor.c3wee6y883xl.us-east-2.rds.amazonaws.com:5432/estate_docs}" \
    -e JWT_SECRET_KEY="${JWT_SECRET_KEY:-CHANGE_THIS_TO_SECURE_KEY}" \
    -v "$DOCUMENT_UPLOADS_DIR:/app/document_uploads" \
    "$IMAGE_NAME":latest

echo ""
echo "Container started successfully!"
echo ""

# Run database migrations
echo "Running database migrations..."
sleep 5  # Wait for container to fully start
docker exec "$CONTAINER_NAME" bash -c "cd /app/backend && alembic upgrade head" || echo "Migration failed or already up to date"

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
echo ""

# Tail the logs
echo "Tailing container logs (Ctrl+C to exit)..."
docker logs -f "$CONTAINER_NAME"
