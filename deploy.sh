#!/bin/bash
set -e

# Estate Docs EC2 Deployment Script
# This script stops running containers, pulls the latest image from Docker Hub, and starts the application

CONTAINER_NAME="estate-doctor"
IMAGE_NAME="jetsondavis/estate-doctor"
DOCUMENT_UPLOADS_DIR="/home/ubuntu/document_uploads"
SSL_CERTS_DIR="/etc/letsencrypt"
IMAGE_HASH="$1"
DOMAIN="${2:-}"

echo "=========================================="
echo "Estate Doctor Deployment Script"
echo "=========================================="

if [ -n "$IMAGE_HASH" ]; then
    echo "Deploying specific image: $IMAGE_NAME@$IMAGE_HASH"
else
    echo "Deploying latest :amd tag"
fi

# Check for SSL certificate setup
if [ -d "$SSL_CERTS_DIR/live" ] && [ "$(ls -A $SSL_CERTS_DIR/live 2>/dev/null)" ]; then
    SSL_ENABLED=true
    echo "SSL certificates found - HTTPS will be enabled"
    if [ -z "$DOMAIN" ]; then
        # Auto-detect domain from certificate (only directories, not README file)
        DOMAIN=$(find "$SSL_CERTS_DIR/live" -maxdepth 1 -type d ! -name live 2>/dev/null | head -1 | xargs basename)
        echo "Auto-detected domain: $DOMAIN"
    fi
else
    SSL_ENABLED=false
    echo "No SSL certificates found - running in HTTP mode"
    echo "To enable HTTPS, run: sudo ./scripts/setup-ssl.sh <domain> <email>"
fi

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

# Pull the image from Docker Hub
echo ""
if [ -n "$IMAGE_HASH" ]; then
    echo "Pulling image by digest from Docker Hub..."
    docker pull "$IMAGE_NAME@$IMAGE_HASH"
else
    echo "Pulling latest image from Docker Hub..."
    docker pull "$IMAGE_NAME":amd
fi

# Run the container
echo ""
echo "Starting container..."
if [ -n "$IMAGE_HASH" ]; then
    RUN_IMAGE="$IMAGE_NAME@$IMAGE_HASH"
else
    RUN_IMAGE="$IMAGE_NAME:amd"
fi

# Build Docker run command based on SSL availability
if [ "$SSL_ENABLED" = true ]; then
    echo "Configuring for HTTPS (port 443)..."
    echo "Using SSL certificates for domain: $DOMAIN"

    docker run -d \
        --name "$CONTAINER_NAME" \
        --restart unless-stopped \
        -p 80:80 \
        -p 443:443 \
        -e DOMAIN="$DOMAIN" \
        -e DATABASE_URL="${DATABASE_URL:-postgresql://jeff:YOUR_PASSWORD@estate-doctor.c3wee6y883xl.us-east-2.rds.amazonaws.com:5432/estate_docs?sslmode=require}" \
        -e JWT_SECRET_KEY="${JWT_SECRET_KEY:-CHANGE_THIS_TO_SECURE_KEY}" \
        -e COOKIE_SECURE="${COOKIE_SECURE:-true}" \
        -v "$DOCUMENT_UPLOADS_DIR:/app/document_uploads" \
        -v "$SSL_CERTS_DIR:/etc/letsencrypt:ro" \
        "$RUN_IMAGE"

else
    echo "Configuring for HTTP (port 80 only)..."
    docker run -d \
        --name "$CONTAINER_NAME" \
        --restart unless-stopped \
        -p 80:80 \
        -e DATABASE_URL="${DATABASE_URL:-postgresql://jeff:YOUR_PASSWORD@estate-doctor.c3wee6y883xl.us-east-2.rds.amazonaws.com:5432/estate_docs?sslmode=require}" \
        -e JWT_SECRET_KEY="${JWT_SECRET_KEY:-CHANGE_THIS_TO_SECURE_KEY}" \
        -e COOKIE_SECURE="${COOKIE_SECURE:-false}" \
        -v "$DOCUMENT_UPLOADS_DIR:/app/document_uploads" \
        "$RUN_IMAGE"
fi

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
