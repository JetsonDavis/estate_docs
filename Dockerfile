# syntax=docker/dockerfile:1.4

FROM --platform=linux/amd64 python:3.11-slim-bullseye

# Create the app user
RUN addgroup --system app && adduser --system --group app

WORKDIR /app/
EXPOSE 80
EXPOSE 8000

# Environment variables
ENV AWS_DEFAULT_REGION=us-east-2 \
    AWS_REGION=us-east-2 \
    BACKEND_CORS_ORIGINS='["http://localhost", "http://localhost:80"]' \
    DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@estate-doctor.c3wee6y883xl.us-east-2.rds.amazonaws.com:5432/estate_docs" \
    DB_HOST="estate-doctor.c3wee6y883xl.us-east-2.rds.amazonaws.com" \
    DB_PORT="5432" \
    DB_NAME="estate_docs" \
    DB_USER="postgres" \
    DB_PASSWORD="YOUR_PASSWORD" \
    ENVIRONMENT=production \
    JWT_SECRET_KEY="CHANGE_THIS_TO_SECURE_KEY" \
    JWT_ALGORITHM="HS256" \
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES="60" \
    JWT_REFRESH_TOKEN_EXPIRE_DAYS="7" \
    UPLOAD_DIR="/app/temp_uploads" \
    GENERATED_DIR="/app/generated" \
    DOCUMENT_UPLOADS_DIR="/app/document_uploads" \
    MAX_UPLOAD_SIZE_MB="10" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH="/app/backend" \
    PYTHONUNBUFFERED=1

# Remove Debian sources list and configure HTTPS repositories
RUN rm -f /etc/apt/sources.list.d/debian.sources

RUN if [ -f /etc/apt/sources.list ]; then \
      sed -i 's|http://deb.debian.org/debian|https://deb.debian.org/debian|g' /etc/apt/sources.list; \
    fi

RUN echo "deb https://deb.debian.org/debian bullseye main" > /etc/apt/sources.list && \
    echo "deb https://deb.debian.org/debian bullseye-updates main" >> /etc/apt/sources.list && \
    echo "deb https://deb.debian.org/debian-security bullseye-security main" >> /etc/apt/sources.list

RUN echo 'Acquire::AllowInsecureRepositories "true";' > /etc/apt/apt.conf.d/99allowinsecure && \
    echo 'Acquire::AllowDowngradeToInsecureRepositories "true";' >> /etc/apt/apt.conf.d/99allowinsecure

# Install system dependencies
RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && \
    apt-get install -y --no-install-recommends debian-archive-keyring && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
         curl \
         build-essential \
         python3-dev \
         python3-pip \
         libffi-dev \
         libpq-dev \
         nginx \
         pandoc \
         gnupg && \
    rm -rf /var/lib/apt/lists/*

# Add PostgreSQL 15 repository and install client
RUN curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt bullseye-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client-15 && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js and npm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Copy backend requirements and install Python dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy the entire application
COPY . /app/

# Create directories for file uploads
RUN mkdir -p /app/temp_uploads /app/document_uploads /app/generated

# Define volume for persistent document storage
VOLUME ["/app/document_uploads"]

# Set up frontend
WORKDIR /app/frontend

# Create production env file for Vite build
RUN echo "VITE_API_BASE_URL=/api/v1" > .env.production

# Install dependencies
RUN npm ci || npm install

# Build frontend - show errors if build fails
RUN npm run build && ls -la /app/frontend/dist/

# Return to app directory
WORKDIR /app/

# Configure nginx
RUN cp /app/nginx.conf /etc/nginx/nginx.conf && \
    mkdir -p /usr/share/nginx/html && \
    cp -r /app/frontend/dist/* /usr/share/nginx/html/ && \
    chown -R www-data:www-data /usr/share/nginx/html && \
    chown -R www-data:www-data /var/log/nginx && \
    chown -R www-data:www-data /var/lib/nginx

# Set ownership
RUN chown -R app:app /app
RUN chown -R app:app /app/temp_uploads /app/document_uploads /app/generated

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "Starting Estate Docs application..."\n\
\n\
# Start nginx as root\n\
echo "Starting nginx on port 80..."\n\
nginx\n\
echo "Nginx started"\n\
\n\
# Switch to app user and start backend\n\
echo "Starting backend API server on port 8000 as app user..."\n\
cd /app/backend\n\
export PYTHONPATH=/app/backend\n\
export HOST=0.0.0.0\n\
export PORT=8000\n\
\n\
# Log environment variables for debugging\n\
echo "Environment:"\n\
echo "- PYTHONPATH: $PYTHONPATH"\n\
echo "- HOST: $HOST"\n\
echo "- PORT: $PORT"\n\
echo "- DATABASE_URL: $DATABASE_URL"\n\
\n\
# Start the backend server as app user\n\
exec su -s /bin/bash app -c "cd /app/backend && uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level info"\n\
' > /app/start_all.sh && \
chmod +x /app/start_all.sh

# Set the entrypoint
ENTRYPOINT ["/app/start_all.sh"]
