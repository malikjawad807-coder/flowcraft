# 🔴 FlowCart

**A self-hosted, visual n8n-style workflow builder designed exclusively for email automation.**

FlowCart is built for high-conversion cold outreach, lead nurture, and automated transactional campaigns with strict deliverability guardrails, persistent AI agent memory, AES-256-GCM SMTP credential vaulting, and zero unnecessary bloat.

---

## ⚡ Tech Stack & Architecture

- **Frontend**: React 18, Vite, React Flow (`@xyflow/react` v12), Tailwind CSS, Lucide Icons.
- **Backend**: Node.js (ESM), Express.
- **Database**: SQLite (`better-sqlite3`) in WAL mode with foreign key constraints enabled.
- **Email Delivery**: Nodemailer (authenticated SMTP with STARTTLS / SSL).
- **Scheduler**: `node-cron` with automatic reschedule on server boot.
- **Security & Auth**: Admin login via bcrypt & httpOnly JWT cookies, AES-256-GCM encrypted credential vault.
- **Reverse Proxy & TLS**: Caddy (automatic Let's Encrypt HTTPS certificates).
- **Containerization**: Multi-stage Docker build running as non-root user `node`.

---

## 🎨 Design System

FlowCart strictly adheres to a flat, high-density black and red design palette:
- **Background**: `#0A0A0A`
- **Cards & Panels**: `#141414`
- **Borders**: `#2A2A2A`
- **Accent Red**: `#E10600` (Hover: `#FF1A1A`)
- **Typography**: Clean monospaced accents with system sans. Zero gradients.

---

## 📦 Core Workflow Nodes

### Triggers
1. **Manual Trigger (`manual_trigger`)**: Run on button click or API call.
2. **Schedule Trigger (`schedule_trigger`)**: Cron schedules (e.g. daily 9 AM: `0 9 * * *`, every 15 min: `*/15 * * * *`).
3. **Webhook Trigger (`webhook_trigger`)**: Inbound HTTP POST payload trigger at `/api/webhook/:slug`.

### Data & Logic
4. **Get Leads (`get_leads`)**: Pulls contacts from built-in SQLite database by status (Pending, Sent, Replied, etc.) with custom limits.
5. **Limit (`limit`)**: Restricts stream to first N items.
6. **Loop Over Items (`loop_over_items`)**: Batch-size 1 item iteration.
7. **IF Condition (`if_condition`)**: Multi-branch logic (True / False handles) comparing expressions (`equals`, `contains`, `is_not_empty`, `>`, etc.).
8. **Edit Fields (`edit_fields`)**: Custom variable assignments and transformations.
9. **Wait (`wait`)**: Rate-limit delay between outbound items (default safe wait: 45s).
10. **AI Write Email (`ai_write_email`)**: Dynamic prompt interpolation with LLM API (OpenAI / OpenRouter / Groq / Anthropic) returning structured `{ subject, body }`.

### Actions & Safety
11. **Send Email (`send_email`)**: Outbound dispatch via vaulted SMTP credentials.
    - Automatic unsubscribe footer injection (`/api/unsubscribe?email=...`).
    - Enforces daily sending limit from Settings (e.g., 30 emails/day).
    - Automatically skips `Unsubscribed` and `Invalid` contacts.
    - Retry on Fail (3 attempts, 5s apart) and Continue on Fail options.
12. **Update Lead (`update_lead`)**: Updates lead status (`Sent`, `Replied`, `Opted Out`) and pipeline step in database.
13. **Stop and Error (`stop_and_error`)**: Gracefully halts execution with custom failure notices.

---

## 🤖 AI Executive Assistant with Persistent Memory

FlowCart includes a conversational AI Executive Assistant equipped with:
- **System Master Prompt**: Context-grounded operational rules and zero-hallucination policies.
- **Long-Term Memory Vault**: SQLite `agent_memories` table storing business niche, tone, preferences, and custom rules.
- **Autonomous Tool Execution**:
  - `create_workflow`: Builds complete pipelines from plain English commands.
  - `list_leads`: Queries recipient tables by status.
  - `run_workflow`: Executes test runs and inspects logs.
  - `save_memory` & `search_memory`: Persists user preferences automatically.

---

## 🚀 Production Deployment on Fresh Ubuntu VPS

Follow this step-by-step guide to deploy FlowCart on any Ubuntu 22.04 / 24.04 VPS (Hetzner, DigitalOcean, Linode, AWS EC2, etc.).

### Step 1: Update System & Install Docker

```bash
# Update repositories
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose Plugin
sudo apt install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Step 2: Configure Domain DNS

Before launching Caddy, create an **A Record** pointing your domain to your VPS public IPv4 address:

| Type | Host / Name | Value / IP | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `flowcart` (or `@`) | `YOUR_VPS_PUBLIC_IP` | `Auto / 300s` |

*Wait 2–5 minutes for DNS propagation.*

### Step 3: Clone Repository & Configure Environment

```bash
# Clone repository
git clone https://github.com/malikjawad807-coder/flowcraft.git /opt/flowcart
cd /opt/flowcart

# Copy environment configuration
cp .env.example .env

# Edit environment variables
nano .env
```

Set your production variables in `.env`:
```ini
DOMAIN=flowcart.yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=SetAStrongPassword123!
JWT_SECRET=generate-a-random-32-character-secret-key-here!
ENCRYPTION_KEY=generate-a-random-32-character-encryption-key!
WEBHOOK_BASE_URL=https://flowcart.yourdomain.com
LLM_PROVIDER=openai
LLM_API_KEY=sk-your-openai-api-key
```

### Step 4: Launch via Docker Compose

```bash
# Build and start services in background
docker compose up -d --build

# Verify running containers
docker compose ps

# Inspect logs
docker compose logs -f
```

Caddy will automatically request and install an SSL certificate from Let's Encrypt for your domain.

Access your application at:
**`https://flowcart.yourdomain.com`**

---

## 📬 DNS Configuration for 100% Email Deliverability

To ensure your outbound emails never land in spam, configure **SPF**, **DKIM**, and **DMARC** on your sending domain's DNS provider (Cloudflare, Namecheap, GoDaddy, etc.):

### 1. SPF (Sender Policy Framework)
Authorizes your mail server to send on behalf of your domain.

- **Type**: `TXT`
- **Host / Name**: `@` (or domain root)
- **Value**:
  - *For Google Workspace / Gmail*:
    ```text
    v=spf1 include:_spf.google.com ~all
    ```
  - *For SendGrid*:
    ```text
    v=spf1 include:sendgrid.net ~all
    ```
  - *For Custom VPS / Direct SMTP*:
    ```text
    v=spf1 ip4:YOUR_VPS_IP ~all
    ```

### 2. DKIM (DomainKeys Identified Mail)
Cryptographically signs every outbound message.

- Generate your DKIM key in your email provider dashboard (Google Workspace Admin / SendGrid Settings).
- Add the corresponding DNS record:
  - **Type**: `TXT` (or `CNAME`)
  - **Host / Name**: `google._domainkey` (or provider selector)
  - **Value**: `v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_STRING`

### 3. DMARC (Domain-based Message Authentication)
Protects against domain spoofing and instructs receiving inboxes how to handle unauthenticated mail.

- **Type**: `TXT`
- **Host / Name**: `_dmarc`
- **Value**:
  ```text
  v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com; pct=100; sp=quarantine
  ```

---

## 💾 Backups & Disaster Recovery

- **Automated Daily Backups**: The built-in scheduler automatically writes daily snapshots of the database to `/data/backups/flowcart-backup-YYYY-MM-DD.db` at 03:00 AM, automatically pruning files older than 7 days.
- **One-Click Manual Backup**: Navigate to **Settings ➔ SQLite Database Snapshot ➔ Download flowcart.db** to download an instantaneous binary copy of the active database.

---

## 🛠️ Local Development

```bash
# 1. Install dependencies
npm run install:all

# 2. Start backend server (port 3001)
npm run dev:server

# 3. Start Vite frontend dev server (port 5173 with proxy to 3001)
npm run dev:client
```
