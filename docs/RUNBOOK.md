# FlowCart v2 Production Runbook (docs/RUNBOOK.md)

This runbook provides complete, production-grade instructions for deploying, operating, backing up, updating, and hardening FlowCart v2 on a self-hosted server.

---

## 1. System Requirements & Architecture

- **Operating System**: Ubuntu 22.04 LTS or 24.04 LTS (x86_64 or ARM64).
- **Compute**: Minimum 2 vCPU, 4 GB RAM (8 GB recommended for concurrent agent runs).
- **Disk**: 30+ GB SSD storage.
- **Networking**: Public IPv4 address with an `A` record pointing to your domain (e.g., `flowcart.example.com`), ports `80` and `443` open.
- **Docker**: Docker Engine 24+ and Docker Compose v2 (`docker compose version`).

### Network Isolation Architecture
```
[ Internet ] 
     |
     v (80 / 443)
[ Caddy Reverse Proxy ]
     |
     +--- (app bridge) ---> [ Web Frontend :3000 ]
     +--- (app bridge) ---> [ Fastify API  :4000 ] <--- (data internal) ---> [ PostgreSQL + pgvector ]
     +--- (app bridge) ---> [ BullMQ Worker     ] <--- (data internal) ---> [ Redis 7 + auth     ]
```
> [!IMPORTANT]
> PostgreSQL (`postgres:5432`) and Redis (`redis:6379`) are attached exclusively to an `internal: true` Docker network (`data`). They are **never** published to the host interfaces or accessible from the public internet.

---

## 2. First-Run Deployment Checklist

### Step 1: Install Docker on the Server
```bash
sudo apt update && sudo apt install -y curl ufw fail2ban unattended-upgrades
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2: Clone Repository
```bash
git clone https://github.com/your-org/flowcart.git /opt/flowcart
cd /opt/flowcart
```

### Step 3: Configure Environment Variables
Copy the template and generate cryptographically secure random secrets:
```bash
cp .env.example .env
chmod 600 .env
```
Generate random secrets:
```bash
# 32-byte Base64 key for AES-256-GCM Vault
openssl rand -base64 32
# 32-byte Base64 secret for HMAC CSRF
openssl rand -base64 32
# Strong passwords for Postgres & Redis
openssl rand -hex 24
```
Edit `.env` and configure:
```ini
NODE_ENV=production
APP_URL=https://flowcart.example.com
DOMAIN=flowcart.example.com
API_PORT=4000
WEB_PORT=3000
ALLOW_SIGNUPS=true

# Database (internal container references)
POSTGRES_USER=flowcart
POSTGRES_PASSWORD=<generated-postgres-password>
POSTGRES_DB=flowcart
DATABASE_URL=postgres://flowcart:<generated-postgres-password>@postgres:5432/flowcart

# Redis (internal container reference)
REDIS_PASSWORD=<generated-redis-password>
REDIS_URL=redis://:<generated-redis-password>@redis:6379

# Cryptographic Keys
APP_ENCRYPTION_KEY=<generated-32-byte-base64-key>
APP_ENCRYPTION_KEY_ID=k1
CSRF_SECRET=<generated-32-byte-base64-csrf-secret>

# Google OAuth Credentials
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
GOOGLE_REDIRECT_URI=https://flowcart.example.com/api/integrations/google/callback

# Transactional SMTP Server (Verification & Password Resets)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<your-smtp-api-key>
SMTP_FROM=FlowCart <notifications@flowcart.example.com>
```

### Step 4: Configure Domain in Caddy
Edit `deploy/Caddyfile` and ensure the domain matches your `APP_URL` hostname:
```caddy
flowcart.example.com {
  encode zstd gzip
  ...
}
```

### Step 5: Build and Start Containers
```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

### Step 6: Verify Service Health & Migration Success
```bash
# Verify container statuses (all should report healthy or running)
docker compose -f deploy/docker-compose.yml ps

# Check API logs to confirm automated database migrations ran
docker compose -f deploy/docker-compose.yml logs api
```
Expected output:
```
[FlowCart API] Running database migrations...
Applying migration: 0000_init.sql
Applying migration: 0001_workflows_and_executions.sql
Applying migration: 0002_usage_events.sql
Applying migration: 0003_agent_and_approvals.sql
Applying migration: 0004_memories.sql
All migrations executed successfully.
[FlowCart API] Migrations completed successfully. Starting API server...
```

### Step 7: Initial Onboarding & Lock Down Signups
1. Open `https://flowcart.example.com` in your browser.
2. Complete signup (`/signup`). The first registered user is automatically provisioned as the **System Administrator** (`role: 'admin'`).
3. Verify your email via the confirmation link sent to your inbox.
4. Set up Two-Factor Authentication (TOTP MFA) in **Settings > Security**.
5. Once your admin account is confirmed, lock down self-registration by editing `.env`:
   ```ini
   ALLOW_SIGNUPS=false
   ```
6. Restart the API service to apply the registration freeze:
   ```bash
   docker compose -f deploy/docker-compose.yml restart api
   ```

---

## 3. Database Backups & Disaster Recovery

### Automated Nightly Backups
Backups are performed using `deploy/backup.sh`. The script executes `pg_dump` with custom compression format (`-Fc`), validates dump integrity, and automatically purges dumps older than the newest 14 archives.

Configure a nightly cron job:
```bash
sudo crontab -e
```
Add the following entry (runs at 02:00 AM UTC daily):
```cron
0 2 * * * /opt/flowcart/deploy/backup.sh >> /var/log/flowcart-backup.log 2>&1
```

### Manual Backup On-Demand
```bash
cd /opt/flowcart
./deploy/backup.sh
```
Backups are saved to `/opt/flowcart/backups/flowcart-YYYY-MM-DD_HHMMSS.dump`.

### Disaster Recovery & Restore Procedure
To restore a backup into FlowCart on the primary server or a replacement disaster-recovery instance:

1. Copy the target dump file to the server (e.g. `backups/flowcart-2026-10-10.dump`).
2. Run the verified restore script:
   ```bash
   ./deploy/restore.sh backups/flowcart-2026-10-10.dump
   ```
3. The restore script automatically:
   - Drains active connections to the `flowcart` database.
   - Cleans existing database objects and restores schema, tables, and vector indexes.
   - Restarts the API and Worker processes to reinitialize database pools and BullMQ queue pollers.

> [!CAUTION]
> Store an offline copy of your `.env` file (especially `APP_ENCRYPTION_KEY` and `APP_ENCRYPTION_KEY_ID`). Database backups cannot decrypt stored Google OAuth refresh tokens or user credentials without the matching vault encryption key.

---

## 4. Cryptographic Key Rotation Runbook

When rotating the primary database encryption key (`APP_ENCRYPTION_KEY`):

1. **Generate New Key**:
   ```bash
   openssl rand -base64 32
   ```
2. **Execute Dry-Run Verification**:
   Execute the key rotation utility in dry-run mode:
   ```bash
   npx tsx deploy/rotate-keys.ts \
     --old-key="$CURRENT_KEY" \
     --new-key="$NEW_KEY" \
     --new-key-id="k2" \
     --dry-run
   ```
3. **Execute Live Re-encryption**:
   ```bash
   npx tsx deploy/rotate-keys.ts \
     --old-key="$CURRENT_KEY" \
     --new-key="$NEW_KEY" \
     --new-key-id="k2"
   ```
4. **Update Production Configuration**:
   Update `.env`:
   ```ini
   APP_ENCRYPTION_KEY=<new-key>
   APP_ENCRYPTION_KEY_ID=k2
   ```
5. **Restart Application Services**:
   ```bash
   docker compose -f deploy/docker-compose.yml restart api worker
   ```

---

## 5. Software Updates & Zero-Downtime Rollout

### Upgrading FlowCart to a New Release
```bash
cd /opt/flowcart

# 1. Take a pre-update snapshot
./deploy/backup.sh

# 2. Pull updated repository code
git pull origin main

# 3. Build updated images and restart
docker compose -f deploy/docker-compose.yml build
docker compose -f deploy/docker-compose.yml up -d

# 4. Verify system health
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs api
```

### Rollback Procedure
If an issue occurs after an update:
```bash
# 1. Roll back code to the previous release tag or commit
git checkout v2.0.0

# 2. Rebuild previous containers
docker compose -f deploy/docker-compose.yml up -d --build

# 3. If database schema was modified, restore pre-update backup
./deploy/restore.sh backups/flowcart-PRE-UPDATE.dump
```

---

## 6. Server Hardening Checklist

Adhere to these essential OS-level security configurations:

1. **Firewall (UFW)**:
   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```
2. **SSH Hardening**:
   Edit `/etc/ssh/sshd_config`:
   ```
   PasswordAuthentication no
   PermitRootLogin prohibit-password
   X11Forwarding no
   ```
   Reload SSH daemon: `sudo systemctl reload ssh`.
3. **Fail2ban**:
   Ensure `fail2ban` is enabled to automatically block brute-force SSH attacks:
   ```bash
   sudo systemctl enable --now fail2ban
   ```
4. **Automatic Security Updates**:
   Enable Ubuntu unattended updates:
   ```bash
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```
5. **Swap Space Configuration (for 4 GB VPS)**:
   ```bash
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
6. **Log Verification & Privacy Check**:
   Search container logs to verify zero leakage of passwords, encryption keys, or email bodies:
   ```bash
   docker compose -f deploy/docker-compose.yml logs | grep -iE 'bearer|sk-|password|refresh_token' || echo "Log check clean."
   ```

---

## 7. Cloudflare Tunnel Option (No Public IP)

If hosting on a residential internet connection or behind Carrier-Grade NAT (CGNAT):

1. Install `cloudflared` on the host or add a `tunnel` service to `deploy/docker-compose.yml`:
   ```yaml
   tunnel:
     image: cloudflare/cloudflared:latest
     restart: unless-stopped
     command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
     networks:
       - app
   ```
2. In Cloudflare Zero Trust Dashboard, route `flowcart.yourdomain.com` to HTTP service `web:3000` and path `/api/*` to `api:4000`.
3. You may omit Caddy port bindings (`80:80`, `443:443`) when running exclusively through Cloudflare Tunnels.
