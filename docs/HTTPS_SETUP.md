# 🔒 HTTPS/TLS Setup Guide

This guide covers setting up HTTPS for the FLASH Bridge in production.

## Quick Start

### Option 1: Docker with Nginx + Let's Encrypt (Recommended)

```bash
# 1. Update nginx.conf with your domain
sed -i 's/your-domain.com/YOUR_ACTUAL_DOMAIN/g' nginx/nginx.conf

# 2. Create certificate directories
mkdir -p nginx/certbot/conf nginx/certbot/www

# 3. Get initial certificate (first time only)
docker run -it --rm \
  -v $(pwd)/nginx/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/nginx/certbot/www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d your-domain.com \
  -d www.your-domain.com

# 4. Start the stack
docker-compose -f nginx/docker-compose.nginx.yml up -d
```

### Option 2: Cloud Provider (AWS/GCP/Azure)

Most cloud providers offer managed SSL/TLS:

| Provider | Service | Documentation |
|----------|---------|---------------|
| AWS | Application Load Balancer + ACM | [AWS ALB SSL](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html) |
| GCP | Cloud Load Balancing | [GCP HTTPS LB](https://cloud.google.com/load-balancing/docs/https) |
| Azure | Application Gateway | [Azure HTTPS](https://docs.microsoft.com/azure/application-gateway/ssl-overview) |
| Cloudflare | Proxy | [Cloudflare SSL](https://developers.cloudflare.com/ssl/) |

### Option 3: Reverse Proxy (Caddy - Easiest)

Caddy automatically handles HTTPS certificates:

```bash
# Install Caddy
sudo apt install -y caddy

# Create Caddyfile
cat > /etc/caddy/Caddyfile << 'EOF'
your-domain.com {
    # API Backend
    handle /api/* {
        reverse_proxy localhost:3001
    }
    
    # Health check
    handle /health {
        reverse_proxy localhost:3001
    }
    
    # Frontend
    handle {
        reverse_proxy localhost:3000
    }
    
    # Security headers
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    }
}
EOF

# Start Caddy
sudo systemctl enable caddy
sudo systemctl start caddy
```

## Configuration

### Environment Variables

Update your `.env` files for HTTPS:

```bash
# backend/.env
FRONTEND_ORIGIN=https://your-domain.com

# frontend/.env
REACT_APP_API_URL=https://your-domain.com
```

### Nginx Configuration Details

The provided `nginx.conf` includes:

| Feature | Configuration |
|---------|--------------|
| **TLS 1.2/1.3** | Modern cipher suites only |
| **HSTS** | 1 year max-age with preload |
| **OCSP Stapling** | Faster certificate verification |
| **Rate Limiting** | 10 req/s API, 2 req/s bridge |
| **Security Headers** | CSP, X-Frame-Options, etc. |
| **Gzip** | Compression for text content |

### SSL Certificate Renewal

Let's Encrypt certificates expire every 90 days. The Certbot container automatically renews them:

```bash
# Manual renewal check
docker exec flash-certbot certbot renew --dry-run

# View certificate expiry
docker exec flash-certbot certbot certificates
```

## Security Checklist

- [ ] Domain DNS points to server
- [ ] Ports 80 and 443 open in firewall
- [ ] SSL certificate obtained
- [ ] HSTS header enabled
- [ ] Backend CORS updated for HTTPS domain
- [ ] Frontend API URL updated to HTTPS
- [ ] Certificate auto-renewal configured

## Troubleshooting

### Certificate Issues

```bash
# Check certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Check Nginx config
docker exec flash-nginx nginx -t

# View Nginx logs
docker logs flash-nginx
```

### Mixed Content Errors

Ensure all resources load over HTTPS:
- Update `REACT_APP_API_URL` to use `https://`
- Check for hardcoded `http://` URLs in frontend

### SSL Labs Test

Test your configuration at: https://www.ssllabs.com/ssltest/

Target grade: **A+**

## Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Internet                                │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS (443)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Nginx Reverse Proxy                       │
│  • TLS Termination                                          │
│  • Rate Limiting                                            │
│  • Security Headers                                         │
│  • Load Balancing                                           │
└──────────────┬─────────────────────────┬────────────────────┘
               │ HTTP (3001)             │ HTTP (3000)
               ▼                         ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│      Backend API         │  │      Frontend (React)        │
│  • Express.js            │  │  • Static files              │
│  • Bridge logic          │  │  • SPA                       │
└──────────────────────────┘  └──────────────────────────────┘
```

