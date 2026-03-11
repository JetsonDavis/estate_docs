# SSL/HTTPS Setup Guide for Estate Doctor

This guide explains how to set up SSL/TLS certificates on your EC2 instance to enable HTTPS for the Estate Doctor application.

## Overview

The application now supports HTTPS using Let's Encrypt free SSL certificates. The deployment system automatically detects whether SSL certificates are present and configures the application accordingly.

## Prerequisites

1. **Domain Name**: You must have a domain name pointed to your EC2 instance's public IP address
2. **DNS Configuration**: Ensure your domain's A record points to the EC2 instance
3. **Port Access**: Ensure ports 80 and 443 are open in your EC2 security group
4. **Root Access**: SSL setup requires root/sudo privileges

## Initial SSL Certificate Setup

### Step 1: Verify DNS Configuration

Before running the SSL setup, verify your domain is correctly configured:

```bash
# Check if your domain resolves to your EC2 IP
dig +short your-domain.com

# Or use nslookup
nslookup your-domain.com
```

The result should match your EC2 instance's public IP address.

### Step 2: Run SSL Setup Script

On your EC2 instance, run the SSL setup script:

```bash
sudo ./scripts/setup-ssl.sh your-domain.com your-email@example.com
```

Replace:
- `your-domain.com` with your actual domain name
- `your-email@example.com` with your email (for Let's Encrypt notifications)

**What this script does:**
1. Installs Certbot (if not already installed)
2. Temporarily stops the application container
3. Obtains SSL certificate from Let's Encrypt
4. Configures automatic certificate renewal (daily check at 3 AM)
5. Sets proper file permissions

### Step 3: Deploy with HTTPS

After SSL certificates are obtained, deploy the application:

```bash
# Deploy latest version with auto-detected domain
./deploy.sh

# Or specify image hash and domain explicitly
./deploy.sh sha256:abc123... your-domain.com
```

The deploy script will automatically:
- Detect SSL certificates
- Configure nginx for HTTPS
- Enable secure cookies (COOKIE_SECURE=true)
- Set up HTTP to HTTPS redirect
- Mount SSL certificates into the container

## Certificate Management

### Automatic Renewal

Certificates are automatically renewed by a cron job that:
- Runs daily at 3 AM
- Checks if certificates need renewal (Let's Encrypt certs expire after 90 days)
- Renews certificates if they're within 30 days of expiration
- Restarts the application container after successful renewal

You can manually check the cron job:

```bash
sudo crontab -l | grep certbot
```

### Manual Renewal

To manually renew certificates:

```bash
sudo certbot renew
docker restart estate-doctor
```

### Check Certificate Status

```bash
# View certificate information
sudo certbot certificates

# Check certificate expiration
sudo openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -noout -dates
```

## Configuration Details

### Port Configuration

- **Port 80 (HTTP)**: Redirects to HTTPS and handles ACME challenges
- **Port 443 (HTTPS)**: Main application traffic with SSL/TLS encryption

### SSL/TLS Settings

The nginx configuration includes:
- **Protocols**: TLS 1.2 and TLS 1.3 only (modern and secure)
- **Ciphers**: Strong cipher suites (ECDHE, AES-GCM, ChaCha20-Poly1305)
- **HSTS**: HTTP Strict Transport Security enabled (1 year)
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.

### Cookie Security

When HTTPS is enabled:
- `COOKIE_SECURE=true` ensures cookies are only sent over HTTPS
- Session cookies are protected from network interception
- Secure flag prevents cookie transmission over HTTP

## Troubleshooting

### Certificate Acquisition Fails

**Problem**: `certbot certonly` command fails

**Solutions**:
1. Verify DNS is correctly configured
2. Check port 80 is accessible from internet:
   ```bash
   sudo netstat -tlnp | grep :80
   ```
3. Ensure no firewall blocking port 80:
   ```bash
   sudo ufw status
   ```
4. Check EC2 security group allows inbound traffic on port 80

### Container Fails to Start with SSL

**Problem**: Container exits after deployment with SSL

**Check nginx configuration**:
```bash
docker logs estate-doctor
```

**Common issues**:
- Domain name mismatch in certificate path
- Certificate files not properly mounted
- Incorrect certificate permissions

**Solution**:
```bash
# Check certificate files exist
sudo ls -la /etc/letsencrypt/live/your-domain.com/

# Fix permissions if needed
sudo chmod -R 755 /etc/letsencrypt/live/
sudo chmod -R 755 /etc/letsencrypt/archive/

# Redeploy
./deploy.sh
```

### HTTPS Not Working After Deployment

**Problem**: Site not accessible via HTTPS

**Solutions**:
1. Check port 443 is exposed:
   ```bash
   docker ps | grep estate-doctor
   ```
   Should show `0.0.0.0:443->443/tcp`

2. Check nginx is running:
   ```bash
   docker exec estate-doctor nginx -t
   ```

3. Verify certificate paths:
   ```bash
   docker exec estate-doctor ls -la /etc/letsencrypt/live/
   ```

4. Check container logs:
   ```bash
   docker logs estate-doctor | grep -i ssl
   ```

### Certificate Renewal Fails

**Problem**: Automatic renewal fails

**Check renewal logs**:
```bash
sudo cat /var/log/letsencrypt/letsencrypt.log
```

**Manual renewal with verbose output**:
```bash
sudo certbot renew --dry-run
```

**Common causes**:
- Port 80 not accessible during renewal
- Container not restarting properly after renewal
- Domain DNS changed

## Switching Back to HTTP

If you need to temporarily disable HTTPS:

```bash
# Rename certificate directory
sudo mv /etc/letsencrypt/live /etc/letsencrypt/live.backup

# Redeploy (will auto-detect no SSL and use HTTP mode)
./deploy.sh

# To re-enable HTTPS later
sudo mv /etc/letsencrypt/live.backup /etc/letsencrypt/live
./deploy.sh
```

## Security Best Practices

1. **Keep Certificates Updated**: The auto-renewal system handles this
2. **Use Strong Passwords**: For database and JWT secrets
3. **Regular Updates**: Keep Docker images and EC2 instance updated
4. **Monitor Logs**: Regularly check application and nginx logs
5. **Backup Certificates**: Keep backup of `/etc/letsencrypt/` directory

## File Locations

- **Certificates**: `/etc/letsencrypt/live/your-domain.com/`
- **Setup Script**: `./scripts/setup-ssl.sh`
- **Deploy Script**: `./deploy.sh`
- **Nginx Config**: `./nginx.conf`
- **Renewal Logs**: `/var/log/letsencrypt/`
- **Cron Jobs**: `sudo crontab -l`

## Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://certbot.eff.org/docs/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [SSL Labs Server Test](https://www.ssllabs.com/ssltest/)

## Testing Your SSL Configuration

After setup, test your SSL configuration:

1. **Online SSL Test**:
   Visit https://www.ssllabs.com/ssltest/ and enter your domain

2. **Manual HTTPS Test**:
   ```bash
   curl -I https://your-domain.com
   ```
   Should return `HTTP/2 200` or `HTTP/1.1 200`

3. **Check Certificate**:
   ```bash
   openssl s_client -connect your-domain.com:443 -servername your-domain.com
   ```

4. **Verify HSTS Header**:
   ```bash
   curl -I https://your-domain.com | grep -i strict
   ```
   Should show: `Strict-Transport-Security: max-age=31536000; includeSubDomains`

## Support

If you encounter issues not covered in this guide:

1. Check container logs: `docker logs estate-doctor`
2. Check nginx configuration: `docker exec estate-doctor nginx -t`
3. Review Let's Encrypt logs: `sudo cat /var/log/letsencrypt/letsencrypt.log`
4. Verify security group settings in AWS Console

---

**Note**: This setup uses Let's Encrypt certificates which are valid for 90 days and automatically renew every 60 days. No manual intervention is required once the initial setup is complete.
