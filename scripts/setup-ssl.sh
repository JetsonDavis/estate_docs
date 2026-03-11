#!/bin/bash
set -e

# SSL Certificate Setup Script for Estate Doctor
# This script sets up Let's Encrypt SSL certificates using Certbot

DOMAIN="${1:-}"
EMAIL="${2:-}"
CERT_DIR="/etc/letsencrypt"
WEBROOT_DIR="/var/www/certbot"

echo "=========================================="
echo "Estate Doctor SSL Certificate Setup"
echo "=========================================="

# Validate inputs
if [ -z "$DOMAIN" ]; then
    echo "Error: Domain name is required"
    echo "Usage: sudo ./setup-ssl.sh <domain> <email>"
    echo "Example: sudo ./setup-ssl.sh estate-doctor.example.com admin@example.com"
    exit 1
fi

if [ -z "$EMAIL" ]; then
    echo "Error: Email is required for Let's Encrypt notifications"
    echo "Usage: sudo ./setup-ssl.sh <domain> <email>"
    exit 1
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Install Certbot if not already installed
echo "Checking for Certbot installation..."
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
    echo "Certbot installed successfully."
else
    echo "Certbot is already installed."
fi

# Create webroot directory for ACME challenge
echo ""
echo "Creating webroot directory for ACME challenge..."
mkdir -p "$WEBROOT_DIR"
chown -R www-data:www-data "$WEBROOT_DIR"
echo "Webroot directory created."

# Stop the estate-doctor container temporarily to free port 80
echo ""
echo "Stopping estate-doctor container to obtain certificate..."
docker stop estate-doctor 2>/dev/null || echo "Container not running, proceeding..."

# Obtain the certificate using standalone mode
echo ""
echo "Obtaining SSL certificate from Let's Encrypt..."
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    --preferred-challenges http \
    || {
        echo "Error: Failed to obtain SSL certificate"
        echo "Please check:"
        echo "1. DNS is properly configured for $DOMAIN"
        echo "2. Port 80 is accessible from the internet"
        echo "3. Domain name is correct"
        exit 1
    }

echo ""
echo "Certificate obtained successfully!"
echo "Certificate location: /etc/letsencrypt/live/$DOMAIN/"

# Set proper permissions
echo ""
echo "Setting certificate permissions..."
chmod -R 755 /etc/letsencrypt/live/
chmod -R 755 /etc/letsencrypt/archive/

# Setup auto-renewal cron job
echo ""
echo "Setting up automatic certificate renewal..."
CRON_JOB="0 3 * * * certbot renew --quiet --post-hook 'docker restart estate-doctor 2>/dev/null || true'"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "certbot renew"; then
    echo "Cron job for certificate renewal already exists."
else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Cron job added for daily certificate renewal check at 3 AM."
fi

echo ""
echo "=========================================="
echo "SSL Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update your deploy.sh to use HTTPS (port 443)"
echo "2. Set COOKIE_SECURE=true in environment variables"
echo "3. Restart the application with: ./deploy.sh"
echo ""
echo "Certificate files:"
echo "  - Certificate: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo "  - Private Key: /etc/letsencrypt/live/$DOMAIN/privkey.pem"
echo ""
echo "The certificate will automatically renew before expiration."
echo ""
