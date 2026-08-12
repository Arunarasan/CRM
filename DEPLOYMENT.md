# Production Deployment Guide: Hostinger VPS

This document contains step-by-step instructions for deploying and maintaining the **Arudra CRM** on **Hostinger KVM 2 VPS (Ubuntu 24.04 LTS)** using **Docker + Docker Compose** and **GitHub Actions CI/CD**.

---

## 1. System Architecture

```
                                [ Internet Users ]
                                        │
                                        ▼
                            [ Hostinger VPS (187.127.171.110) ]
                                (Ports 80 & 8080)
                                        │
                ┌───────────────────────┴───────────────────────┐
                ▼                                               ▼
      [ crm-frontend:80 ]                             [ crm-backend:8080 ]
     (React Vite + Nginx)                            (Spring Boot Java 17)
     • SPA Routing Fallback                          • Non-root `spring` user
     • Gzip Compression                              • Actuator: /actuator/health
     • Proxies /api/ to backend                      • JVM: -Xms512m -Xmx1536m
                                                                │
                                            ┌───────────────────┴───────────────────┐
                                            ▼                                       ▼
                                    [ crm-mysql:3306 ]                      [ Cloudflare R2 ]
                                   (MySQL 8.0 Container)                    (Bucket: jbdecor)
                                   • Persistent mysql_data                  • Cloud object storage
                                   • Internal only (port 3306 closed)       • Safe across redeploys
```

---

## 2. GitHub Repository Secrets Setup

In your GitHub repository:
1. Navigate to **Settings** ➔ **Secrets and variables** ➔ **Actions**.
2. Click **New repository secret** and configure the following 5 secrets:

| Secret Name | Expected Value | Description |
| :--- | :--- | :--- |
| `VPS_HOST` | `187.127.171.110` | Your Hostinger VPS IP address |
| `VPS_USERNAME` | `arudra` | Non-root deployment user on the VPS |
| `VPS_PORT` | `22` | SSH port |
| `VPS_APP_DIR` | `/opt/crm` | Application root directory on the VPS |
| `VPS_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` | Your private Ed25519 SSH key (stored ONLY in GitHub Secrets) |

> [!CAUTION]
> **Never** commit your `VPS_SSH_KEY` or any private keys into Git!

---

## 3. One-Time VPS Setup Instructions

Connect to your VPS via SSH:
```bash
ssh -i ~/.ssh/id_ed25519 arudra@187.127.171.110
```

### Step 3.1: Verify Permissions & Docker Access
Verify directory ownership and Docker access:
```bash
# Ensure /opt/crm exists and is owned by arudra
sudo mkdir -p /opt/crm
sudo chown -R arudra:arudra /opt/crm

# Verify Docker runs without sudo
docker ps
```

### Step 3.2: Clone the Repository (One-time)
```bash
cd /opt/crm
git clone https://github.com/<YOUR_GITHUB_USER>/<YOUR_REPO>.git .
```
*(If the folder is already cloned, simply `cd /opt/crm`)*.

### Step 3.3: Create Production Environment File (`/opt/crm/.env`)
Create the production environment file on the VPS:
```bash
nano /opt/crm/.env
```

Paste the following template and fill in your strong production secrets:
```properties
# =================================================================
# Arudra CRM - Production Environment Configuration
# Location on VPS: /opt/crm/.env
# =================================================================

# 1. MySQL Database Configuration
MYSQL_DATABASE=arudra_crm
MYSQL_USER=crm_user
MYSQL_PASSWORD=YOUR_STRONG_DATABASE_PASSWORD
MYSQL_ROOT_PASSWORD=YOUR_STRONG_ROOT_PASSWORD

# 2. Spring Boot Backend Configuration
SPRING_PROFILES_ACTIVE=prod
JWT_SECRET=YOUR_RANDOM_64_CHAR_HEX_OR_BASE64_JWT_SECRET
JWT_EXPIRATION=86400000
CORS_ALLOWED_ORIGINS=http://187.127.171.110,http://localhost:80,https://crm.yourdomain.com

# 3. Cloudflare R2 Object Storage
STORAGE_TYPE=s3
R2_ACCOUNT_ID=6ded68d1395464810b575e43d47d5346
R2_BUCKET_NAME=jbdecor
R2_ENDPOINT=https://6ded68d1395464810b575e43d47d5346.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
# Public domain for image viewing (e.g. https://pub-xxxxxx.r2.dev or https://media.yourdomain.com)
R2_PUBLIC_DOMAIN=

# 4. Frontend & Port Bindings
VITE_API_URL=/api
FRONTEND_PORT=80
BACKEND_PORT=8080
```
Save and close with `Ctrl+O` then `Ctrl+X`.

Secure file permissions on the VPS:
```bash
chmod 600 /opt/crm/.env
```

---

## 4. Triggering Automatic Deployment

To trigger the automated build and deployment pipeline:

```bash
# Stage all changes
git add .

# Commit changes
git commit -m "ci(deploy): configure production Docker and GitHub Actions workflow for Hostinger VPS"

# Push to GitHub
git push origin main
```

### GitHub Actions Flow
1. **Build & Test Job**:
   - Compiles Java 17 backend and verifies tests (`mvn clean test-compile`).
   - Installs Node 20 dependencies and builds React frontend (`npm ci && npm run build`).
2. **Deploy Job**:
   - Connects securely to `arudra@187.127.171.110` via SSH using `VPS_SSH_KEY`.
   - Pulls latest `main` commit without touching `/opt/crm/.env`.
   - Builds Docker images and runs `docker compose up -d --remove-orphans`.
   - Displays container status and recent application logs.

---

## 5. Verifying Deployment on VPS

To inspect the running production services directly on the VPS:

```bash
# Check container status (should show 'healthy' status)
docker compose ps

# Inspect backend logs
docker compose logs --tail=100 backend

# Inspect frontend logs
docker compose logs --tail=100 frontend

# Inspect MySQL logs
docker compose logs --tail=50 mysql

# Test Backend Actuator Health endpoint locally on VPS
curl -f http://127.0.0.1:8080/actuator/health

# Test Frontend HTTP response
curl -I http://127.0.0.1:80/
```

---

## 6. Zero Data Loss & Safety Guarantees

* **Database Persistence**: MySQL data is stored in the Docker volume `crm_mysql_data` mounted at `/var/lib/mysql`.
* **Zero Volume Deletion**: The deployment workflow never runs `docker compose down -v`.
* **R2 File Persistence**: All uploaded photos and drawings go directly to Cloudflare R2 (`jbdecor` bucket) and survive container rebuilds.
* **Network Isolation**: MySQL port 3306 is not published to the host and is accessible only through Docker's internal `crm-network`.

---

## 7. Rollback Procedure

If a deployed commit has issues and you need to roll back to a previous working commit:

```bash
# SSH into VPS
ssh arudra@187.127.171.110
cd /opt/crm

# Check commit history
git log --oneline -n 5

# Revert to previous known good commit
git checkout <COMMIT_HASH>

# Rebuild and restart containers
docker compose build
docker compose up -d --remove-orphans

# Verify
docker compose ps
```

---

## 8. Optional: Reverse Proxy & HTTPS Domain Setup

When you are ready to link a custom domain (e.g. `https://crm.yourdomain.com`):

### Option A: Cloudflare Proxy (Easiest)
1. Point your domain's DNS `A` record to `187.127.171.110` with the Cloudflare orange cloud enabled.
2. In Cloudflare SSL/TLS settings, set encryption mode to **Full (strict)** or **Flexible**.
3. All traffic on port 80/443 will be automatically encrypted by Cloudflare.

### Option B: Host VPS Nginx + Let's Encrypt (Certbot)
If running Nginx directly on the VPS host:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```
Configure Nginx upstream block to proxy `proxy_pass http://127.0.0.1:80;` and run `sudo certbot --nginx -d crm.yourdomain.com`.
