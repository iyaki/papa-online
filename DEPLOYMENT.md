# Deployment Guide - Papa Online

## 🐳 Docker Deployment on a VPS

This guide will help you deploy Papa Online on your VPS using Docker.

## Prerequisites

- VPS with Docker and Docker Compose installed
- Domain pointing to your VPS (optional, for HTTPS)
- SSH access to your VPS

## 📦 Quick Deployment

### 1. Clone the Repository on the VPS

```bash
ssh your-user@your-vps.com
cd /opt  # or your preferred directory
git clone https://github.com/your-user/papa-online.git
cd papa-online
```

### 2. Run

The Docker image is built and published to GHCR automatically on every push
to `main` (see `.github/workflows/docker-publish.yml`), tagged `latest`,
`sha-<commit>` and `vX.Y.Z` for version tags. The package is public, so the
VPS needs no registry login:

```bash

# Pull the image and start
docker-compose pull
docker-compose up -d

# View logs
docker-compose logs -f
```

### 3. Verify

Visit `http://your-vps-ip:3000` to verify it works.

## 🔄 Updating the Application

```bash
cd /opt/papa-online
git pull origin main
docker-compose pull
docker-compose up -d
```

## 🌐 Setting Up Nginx as a Reverse Proxy (Recommended)

### Install Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

### Configure Nginx

Create the file `/etc/nginx/sites-available/papa-online`:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support for Socket.IO
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/papa-online /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 Setting Up HTTPS with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain the certificate
sudo certbot --nginx -d your-domain.com

# Automatic renewal (certbot configures it automatically)
sudo certbot renew --dry-run
```

## 🛠️ Useful Commands

```bash
# View logs in real time
docker-compose logs -f papa-online

# Stop the application
docker-compose down

# Restart the application
docker-compose restart

# View running containers
docker ps

# Enter the container
docker exec -it papa-online-app sh

# View resource usage
docker stats papa-online-app
```

## 🔥 Firewall (UFW)

```bash
# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# If you don't use nginx, allow port 3000
sudo ufw allow 3000/tcp

# Enable the firewall
sudo ufw enable
```

## 📊 Monitoring

### Application Logs

```bash
# Container logs
docker-compose logs -f

# nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Healthcheck

The container includes a healthcheck that verifies every 30 seconds that the application responds correctly.

```bash
# Check health status
docker inspect papa-online-app | grep -A 5 Health
```

## 🚨 Troubleshooting

### The application doesn't start

```bash
# View detailed logs
docker-compose logs papa-online

# Check that port 3000 is available
sudo lsof -i :3000
```

### Socket.IO doesn't work

- Make sure nginx is configured with the WebSocket headers
- Verify the firewall allows the connections

### Container keeps restarting

```bash
# View container logs
docker logs papa-online-app --tail 100

# Check system resources
free -h
df -h
```

## 🔐 Security

### Recommendations

1. **Don't expose port 3000 directly**: use nginx as a reverse proxy
2. **Set up HTTPS**: use Let's Encrypt
3. **Update regularly**:
   ```bash
   apt update && apt upgrade -y
   docker-compose pull
   ```
4. **Restrict SSH access**: use keys instead of passwords
5. **Set up fail2ban**: to protect against brute-force attacks

## 🔄 Automatic CI/CD (Optional)

You can configure GitHub Actions for automatic deployment:

1. Add secrets in GitHub (SSH keys, VPS IP)
2. Create a workflow that pulls and rebuilds on every push to main

## 📝 Environment Variables

If you need to configure custom variables, create a `.env` file in the root directory:

```env
NODE_ENV=production
PORT=3000
```

And modify `docker-compose.yml` to use `env_file`:

```yaml
services:
  papa-online:
    env_file:
      - .env
```

## 🎯 Architecture Summary

```
Internet
   ↓
Nginx (80/443) → Reverse Proxy + SSL
   ↓
Docker Container (3000) → Node.js + Socket.IO
   ↓
Static client (HTML/CSS/JS)
```

## 📞 Support

If you run into problems, check the logs and the Docker and nginx documentation.
