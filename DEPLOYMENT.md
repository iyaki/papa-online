# Deployment Guide - Papa Online

## 🐳 Deployment con Docker en VPS

Esta guía te ayudará a desplegar Papa Online en tu VPS usando Docker.

## Requisitos Previos

- VPS con Docker y Docker Compose instalados
- Dominio apuntando a tu VPS (opcional, para HTTPS)
- Acceso SSH a tu VPS

## 📦 Deployment Rápido

### 1. Clonar el Repositorio en el VPS

```bash
ssh tu-usuario@tu-vps.com
cd /opt  # o el directorio que prefieras
git clone https://github.com/tu-usuario/papa-online.git
cd papa-online
```

### 2. Build y Run

```bash
# Build de la imagen
docker-compose build

# Iniciar la aplicación
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### 3. Verificar

Visita `http://tu-vps-ip:3000` para verificar que funciona.

## 🔄 Actualizar la Aplicación

```bash
cd /opt/papa-online
git pull origin main
docker-compose down
docker-compose build
docker-compose up -d
```

## 🌐 Configurar Nginx como Reverse Proxy (Recomendado)

### Instalar Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

### Configurar Nginx

Crear archivo `/etc/nginx/sites-available/papa-online`:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;  # Reemplaza con tu dominio

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support para Socket.IO
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Activar sitio:

```bash
sudo ln -s /etc/nginx/sites-available/papa-online /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 Configurar HTTPS con Let's Encrypt

```bash
# Instalar certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com

# Renovación automática (certbot lo configura automáticamente)
sudo certbot renew --dry-run
```

## 🛠️ Comandos Útiles

```bash
# Ver logs en tiempo real
docker-compose logs -f papa-online

# Detener la aplicación
docker-compose down

# Reiniciar la aplicación
docker-compose restart

# Ver contenedores corriendo
docker ps

# Entrar al contenedor
docker exec -it papa-online-app sh

# Ver uso de recursos
docker stats papa-online-app
```

## 🔥 Firewall (UFW)

```bash
# Permitir SSH
sudo ufw allow ssh

# Permitir HTTP y HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Si no usas nginx, permitir puerto 3000
sudo ufw allow 3000/tcp

# Activar firewall
sudo ufw enable
```

## 📊 Monitoreo

### Logs de la Aplicación

```bash
# Logs del contenedor
docker-compose logs -f

# Logs de nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Healthcheck

El contenedor incluye un healthcheck que verifica cada 30 segundos que la aplicación responde correctamente.

```bash
# Ver estado de salud
docker inspect papa-online-app | grep -A 5 Health
```

## 🚨 Troubleshooting

### La aplicación no inicia

```bash
# Ver logs detallados
docker-compose logs papa-online

# Verificar que el puerto 3000 está disponible
sudo lsof -i :3000
```

### Socket.IO no funciona

- Asegúrate de que nginx está configurado con los headers de WebSocket
- Verifica que el firewall permite las conexiones

### Container se reinicia constantemente

```bash
# Ver logs del contenedor
docker logs papa-online-app --tail 100

# Verificar recursos del sistema
free -h
df -h
```

## 🔐 Seguridad

### Recomendaciones

1. **No exponer puerto 3000 directamente**: Usar nginx como reverse proxy
2. **Configurar HTTPS**: Usar Let's Encrypt
3. **Actualizar regularmente**: 
   ```bash
   apt update && apt upgrade -y
   docker-compose pull
   ```
4. **Limitar acceso SSH**: Usar llaves en lugar de contraseñas
5. **Configurar fail2ban**: Para proteger contra ataques de fuerza bruta

## 🔄 CI/CD Automático (Opcional)

Puedes configurar GitHub Actions para deployment automático:

1. Agregar secrets en GitHub (SSH keys, VPS IP)
2. Crear workflow que haga pull y rebuild en cada push a main

## 📝 Variables de Entorno

Si necesitas configurar variables personalizadas, crea un archivo `.env` en el directorio raíz:

```env
NODE_ENV=production
PORT=3000
```

Y modifica `docker-compose.yml` para usar `env_file`:

```yaml
services:
  papa-online:
    env_file:
      - .env
```

## 🎯 Resumen de Arquitectura

```
Internet
   ↓
Nginx (80/443) → Reverse Proxy + SSL
   ↓
Docker Container (3000) → Node.js + Socket.IO
   ↓
Cliente estático (HTML/CSS/JS)
```

## 📞 Soporte

Si encuentras problemas, revisa los logs y la documentación de Docker y nginx.
