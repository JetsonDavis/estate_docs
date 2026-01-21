# Docker Deployment Guide

## Prerequisites
- Docker installed on your system
- Access to the RDS instance: `estate-doctor.c3wee6y883xl.us-east-2.rds.amazonaws.com`

## Configuration

Before building, update the environment variables in the `Dockerfile`:
- `DATABASE_URL`: Set your RDS password
- `DB_PASSWORD`: Set your RDS password  
- `JWT_SECRET_KEY`: Generate a secure key with `openssl rand -hex 32`
- `BACKEND_CORS_ORIGINS`: Update with your actual domain

## Building the Docker Image

```bash
docker build -t estate-docs .
```

## Running the Container

```bash
docker run -d \
  --name estate-docs \
  -p 80:80 \
  -v /home/ubuntu/document_uploads:/app/document_uploads \
  estate-docs
```

Or with environment variable overrides:
```bash
docker run -d \
  --name estate-docs \
  -p 80:80 \
  -e DATABASE_URL="postgresql://postgres:REAL_PASSWORD@estate-doctor.c3wee6y883xl.us-east-2.rds.amazonaws.com:5432/estate_docs" \
  -e JWT_SECRET_KEY="your-secure-key-here" \
  -v /home/ubuntu/document_uploads:/app/document_uploads \
  estate-docs
```

## Volume Setup

Before running the container, create the document uploads directory on the host:
```bash
sudo mkdir -p /home/ubuntu/document_uploads
sudo chown -R 1000:1000 /home/ubuntu/document_uploads
```

The volume mount `-v /home/ubuntu/document_uploads:/app/document_uploads` ensures:
- Uploaded documents persist across container restarts
- Files are accessible from the host system for backup
- Data survives container rebuilds/updates

## Database Migration
Run migrations after starting the container:
```bash
docker exec estate-docs bash -c "cd /app/backend && alembic upgrade head"
```

## Stopping the Container
```bash
docker stop estate-docs
docker rm estate-docs
```

## Logs
```bash
docker logs estate-docs
docker logs -f estate-docs  # Follow logs
```

## Architecture
- **Port 80**: Nginx serves the React frontend and proxies `/api/*` requests to the backend
- **Port 8000**: FastAPI backend (internal, proxied through nginx)
- **RDS**: PostgreSQL database at `estate-doctor.c3wee6y883xl.us-east-2.rds.amazonaws.com`

## Production Notes

1. **Security**: 
   - Use `-e` flags or Docker secrets to pass credentials at runtime
   - Never commit real passwords in the Dockerfile

2. **RDS Security Group**: 
   - Ensure your EC2/container host IP is allowed in the RDS security group

3. **SSL/HTTPS**: 
   - For production, add SSL termination via a load balancer or add certbot to the container

4. **Volumes**: 
   - Mount `/app/document_uploads` for persistent file storage
