# FlowCraft Studio (n8n-Inspired Visual Workflow Builder)

A modern, intuitive visual automation canvas inspired by **n8n**, built with **Next.js App Router**, **TypeScript**, **Tailwind CSS**, and **React Flow** (`@xyflow/react`).

---

## 🚀 Features

### 1. Interactive Visual Canvas (React Flow)
- **Node Drag-and-Drop & Click-to-Add**: Add triggers, AI, action, and logic nodes directly from the sidebar.
- **Custom Visual Nodes**: Custom designed nodes with category accents, status badges, real-time pulse animations, and input/output handles.
- **Interactive Connections & Animated Edges**: Glowing bezier curves with flowing particles indicating active executions.
- **Minimap, Background Dots, and Controls**: Zoom in/out, fit to screen, and canvas panning.

### 2. Triggers Supported
- **Input Form Trigger (`input_form_trigger`)**:
  - Configurable dynamic fields (text, email, textarea, select, number).
  - Built-in live form tester in the configuration drawer to submit test triggers directly.
- **File Upload Trigger (`file_upload_trigger`)**:
  - Ingest JSON, CSV, PDF, or text documents.
  - Built-in file preview & structured JSON parser.
- **Webhook Trigger (`webhook_trigger`)**:
  - HTTP POST simulator with payload editor.

### 3. Action & Processing Nodes
- **OpenAI AI Reasoning (`openai_llm` & `openai_classifier`)**:
  - Model selection: `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`.
  - System prompt & user prompt templating with variable interpolation (e.g., `{{node_form.submittedValues.customerName}}`).
  - Supports live OpenAI API key or built-in intelligent sandbox simulation with token usage tracking.
  - Isolated "Test This Step" runner directly inside the node drawer.
- **Gmail API Send Node (`gmail_send`)**:
  - Template resolution for `To`, `CC`, `Subject`, and `Body` (e.g., embedding `{{node_openai.output}}`).
  - RFC 2822 email generation, message ID, and delivery receipt tracking.
  - Isolated "Test This Step" email tester.
- **Code Transform (`code_transform`)**:
  - Custom JavaScript mapper to reshape JSON between steps.
- **Condition Router (`condition_filter`)**:
  - If/Else branching based on upstream variables (`equals`, `contains`, `greater_than`).

### 4. Workflow Graph Execution Engine
- **Topological Sorting**: Resolves node dependency graph (DAG) automatically.
- **Variable Context Propagation**: Cumulative context allows any downstream node to reference any upstream node's output.
- **Live Visual State Transitions**: Nodes cycle through `idle` ➔ `running` ➔ `success` / `error`.
- **Celebration Confetti**: Triggered upon successful end-to-end execution!
- **Bottom Execution Drawer & Log Viewer**:
  - Per-step duration, status, input and output JSON inspector, token counter, and copy-to-clipboard functionality.

### 5. Templates & Persistence
- **Starter Templates**:
  1. *Customer Support AI Classifier & Gmail Responder* (Form ➔ OpenAI ➔ Gmail)
  2. *Document & Resume AI Screening with Gmail Alert* (File Upload ➔ OpenAI ➔ Gmail)
- **Export / Import JSON**: Export and import complete workflow blueprints.
- **API Credentials Modal**: Store your OpenAI key securely in session memory.

---

## 🛠️ Running Locally

The development server is running at:
```bash
http://localhost:3000
```

To run manually:
```bash
npm run dev
# or
npm run build && npm run start
```
