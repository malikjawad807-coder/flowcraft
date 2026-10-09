# FlowCraft Studio (Visual AI Workflow Automation Platform)

A visual automation canvas inspired by **n8n**, built with **Next.js 14 App Router**, **TypeScript**, **Tailwind CSS**, and **React Flow** (`@xyflow/react`).

🔗 **Repository**: [https://github.com/malikjawad807-coder/flowcraft.git](https://github.com/malikjawad807-coder/flowcraft.git)

---

## 🚀 Key Features

### 1. Secure API Key & Credential Management
- **Personal OpenAI API Keys**:
  - Connect your personal OpenAI API Key (`sk-...`) either globally in **Workspace Settings** or directly within individual **OpenAI Processing Nodes**.
  - Includes password visibility toggle (`Show / Hide`), custom Base URL support (compatible with OpenAI, OpenRouter, Groq, Azure, or local Ollama), and sandbox fallback.
- **Personal Gmail Authentication**:
  - **Google App Password (Recommended)**: Connect your personal Gmail address and 16-character App Password (`xxxx xxxx xxxx xxxx`) for live, authenticated email delivery powered by `nodemailer`.
  - **OAuth Bearer Token**: Alternative Google Cloud OAuth token configuration.
  - **Sandbox Simulation**: Safe preview mode with real delivery headers, message IDs, and recipient tracking.

### 2. Email List File Upload Trigger (`email_list_file_upload`)
- Upload CSV, TXT, or JSON contact files containing emails, names, companies, and roles.
- **Client-Side Live Parsing & Validation**: Real-time syntax validation (`valid` vs `invalid` chips), column mapping (`Email`, `Name`, `Company`), and a live preview table of parsed contacts.
- Built-in **"Load 25 Sample Leads"** button for immediate testing.

### 3. OpenAI AI Processing Nodes (`openai_llm` & `openai_classifier`)
- **Single Execution Mode**: Run prompt templates for individual upstream events.
- **Batch / Bulk Execution Mode**: Iterates over upstream contact lists (`{{node_csv.recipients}}`) and generates bespoke personalized outreach messages for every recipient (`{{item.name}}`, `{{item.company}}`).
- Real-time token tracking and step testing.

### 4. Gmail API Action Nodes (`gmail_send`)
- **Single Email Mode**: 1-to-1 email dispatch with template interpolation.
- **Bulk Delivery Mode**: Dispatches personalized emails to the entire upstream contact list with rate-limit pacing (e.g., 200ms delay per email) to avoid throttling.
- Generates detailed delivery logs per contact: `totalAttempted`, `totalSent`, `totalFailed`, `messageId`, `sentAt`, and preview links.

### 5. Interactive Canvas & Execution Engine
- **React Flow v12**: Drag-and-drop, connection handles, minimap, controls, and background grid.
- **Animated Edges**: Glowing bezier paths with moving data particles during execution.
- **Topological DAG Runner**: Automatically determines graph order and propagates cumulative variables (`{{nodeId.field}}`).
- **Live State Transitions & Celebration Confetti**: Nodes transition (`idle` ➔ `running` ➔ `success` / `error`), with confetti upon workflow completion.
- **Execution Drawer**: Inspect step timings, input/output JSON payloads, and token consumption.

---

## 📋 Starter Blueprints Included

1. **Bulk Personalized Cold Outreach**:
   - `Email List CSV Upload (10 Contacts)` ➔ `OpenAI Bulk Personalizer` ➔ `Gmail Bulk Sender`
2. **Customer Support AI Classifier & Gmail Auto-Responder**:
   - `Customer Support Form` ➔ `OpenAI Ticket Analysis & Draft` ➔ `Gmail Auto-Response`
3. **Document & Resume AI Screening with Gmail Alert**:
   - `Resume Document Upload` ➔ `OpenAI Candidate Evaluation` ➔ `Gmail Candidate Report`

---

## 🛠️ Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or build for production
npm run build && npm run start
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.
