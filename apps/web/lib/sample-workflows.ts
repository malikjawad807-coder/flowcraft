import { WorkflowTemplate } from '@/types/workflow';
import {
  EXECUTIVE_ASSISTANT_SYSTEM_PROMPT,
  EXECUTIVE_ASSISTANT_SAMPLE_MEMORY,
} from '@/lib/ai-assistant-prompts';

const SAMPLE_CSV = `email,name,company,role
alex.chen@techcorp.io,Alex Chen,TechCorp,VP Engineering
sarah.miller@growthlab.com,Sarah Miller,GrowthLab,Director of Operations
jordan.smith@cloudpulse.ai,Jordan Smith,CloudPulse,Head of AI
emily.davis@fintechhub.net,Emily Davis,FintechHub,Lead Product Manager
marcus.vance@databridge.co,Marcus Vance,DataBridge,CTO
olivia.wang@salespeak.io,Olivia Wang,SalesPeak,VP Sales Operations
david.ross@hyperflow.dev,David Ross,HyperFlow,Principal Architect
sophia.martinez@swiftscale.co,Sophia Martinez,SwiftScale,Chief Operations Officer
liam.johnson@apixcel.com,Liam Johnson,APIXcel,Head of Partnerships
ava.patel@nexuscloud.ai,Ava Patel,NexusCloud,Director of Engineering`;

export const SAMPLE_WORKFLOWS: WorkflowTemplate[] = [
  {
    id: 'ai-executive-assistant-memory',
    name: 'AI Executive Assistant (Memory-First Vector DB + Gmail API)',
    description: 'Autonomous AI Executive Assistant coordinating between Chroma/Pinecone Vector Database long-term memory and Gmail API for contextual, zero-hallucination communications.',
    category: 'Executive & AI Agent',
    icon: 'Sparkles',
    badge: 'Master Agent',
    nodes: [
      {
        id: 'node_intake_trigger',
        type: 'input_form_trigger',
        position: { x: 40, y: 180 },
        data: {
          id: 'node_intake_trigger',
          label: 'Executive Command & Lead Intake',
          category: 'trigger',
          nodeType: 'input_form_trigger',
          status: 'idle',
          config: {
            formTitle: 'Executive Assistant Command Deck',
            formDescription: 'Submit command or lead inquiry to trigger memory search and email action',
            fields: [
              { id: 'f1', name: 'lead_name', label: 'Contact / Lead Name', type: 'text', defaultValue: 'Alex Chen', required: true },
              { id: 'f2', name: 'company', label: 'Company / Organization', type: 'text', defaultValue: 'TechCorp', required: true },
              { id: 'f3', name: 'command_request', label: 'Executive Directive', type: 'textarea', defaultValue: 'Prepare a contextual follow-up email regarding workflow automation and ROI metrics.', required: true },
            ],
            submittedValues: {
              lead_name: 'Alex Chen',
              company: 'TechCorp',
              command_request: 'Prepare a contextual follow-up email regarding workflow automation and ROI metrics.',
            },
          },
        },
      },
      {
        id: 'node_vector_memory',
        type: 'vector_store',
        position: { x: 420, y: 150 },
        data: {
          id: 'node_vector_memory',
          label: 'Pinecone Long-Term Memory (Vector DB)',
          category: 'ai',
          nodeType: 'vector_store',
          status: 'idle',
          config: {
            provider: 'pinecone',
            indexName: 'executive-longterm-memory',
            topK: 3,
            searchQuery: '{{node_intake_trigger.submittedValues.lead_name}} {{node_intake_trigger.submittedValues.company}}',
            similarityMetric: 'cosine',
            namespace: 'vip-leads',
            sampleDocuments: EXECUTIVE_ASSISTANT_SAMPLE_MEMORY,
          },
        },
      },
      {
        id: 'node_ai_executive',
        type: 'openai_llm',
        position: { x: 800, y: 150 },
        data: {
          id: 'node_ai_executive',
          label: 'Advanced AI Executive Assistant',
          category: 'ai',
          nodeType: 'openai_llm',
          status: 'idle',
          config: {
            apiKeySource: 'global',
            model: 'gpt-4o',
            executionMode: 'single',
            systemPrompt: EXECUTIVE_ASSISTANT_SYSTEM_PROMPT,
            userPrompt: `[USER COMMAND / INQUIRY]
Target Entity: {{node_intake_trigger.submittedValues.lead_name}} ({{node_intake_trigger.submittedValues.company}})
User Command: {{node_intake_trigger.submittedValues.command_request}}

[RETRIEVED LONG-TERM MEMORY (VECTOR DATABASE)]
Index Name: {{node_vector_memory.indexName}}
Memory Grounding Status: {{node_vector_memory.memoryFound}}
Retrieved Historical Notes:
{{node_vector_memory.historicalNotes}}

[DIRECTIVE]: Strictly follow the 4-step workflow protocol. Ground response in retrieved vector memory or declare a new lead under the zero-hallucination policy. Format email response for Gmail API review.`,
            temperature: 0.4,
            maxTokens: 600,
            mockFallback: true,
          },
        },
      },
      {
        id: 'node_gmail_dispatcher',
        type: 'gmail_send',
        position: { x: 1200, y: 180 },
        data: {
          id: 'node_gmail_dispatcher',
          label: 'Gmail API Tool Access',
          category: 'action',
          nodeType: 'gmail_send',
          status: 'idle',
          config: {
            authMethod: 'sandbox',
            sendMode: 'single',
            to: 'alex.chen@techcorp.io',
            subject: 'Following up on our workflow automation discussion',
            body: '{{node_ai_executive.output}}',
            isHtml: false,
            sendAsDraft: true,
          },
        },
      },
    ],
    edges: [
      {
        id: 'e-trigger-vector',
        source: 'node_intake_trigger',
        target: 'node_vector_memory',
        animated: true,
        style: { stroke: '#06b6d4', strokeWidth: 2 },
      },
      {
        id: 'e-vector-ai',
        source: 'node_vector_memory',
        target: 'node_ai_executive',
        animated: true,
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
      },
      {
        id: 'e-ai-gmail',
        source: 'node_ai_executive',
        target: 'node_gmail_dispatcher',
        animated: true,
        style: { stroke: '#ef4444', strokeWidth: 2 },
      },
    ],
  },
  {
    id: 'bulk-outreach-email-list',
    name: 'Bulk Personalized Cold Outreach (CSV + OpenAI + Gmail)',
    description: 'Upload a list of contact emails from a file, generate bespoke AI outreach pitches with OpenAI in batch, and dispatch bulk emails via Gmail.',
    category: 'Sales & Growth',
    icon: 'Users',
    badge: 'New & Bulk',
    nodes: [
      {
        id: 'node_csv_upload',
        type: 'email_list_file_upload',
        position: { x: 50, y: 180 },
        data: {
          id: 'node_csv_upload',
          label: 'Leads CSV Upload (10 Contacts)',
          category: 'trigger',
          nodeType: 'email_list_file_upload',
          status: 'idle',
          config: {
            fileName: 'q4_enterprise_leads.csv',
            rawContent: SAMPLE_CSV,
            emailColumn: 'email',
            nameColumn: 'name',
            companyColumn: 'company',
            totalCount: 10,
            validCount: 10,
            invalidCount: 0,
            recipients: [
              { email: 'alex.chen@techcorp.io', name: 'Alex Chen', company: 'TechCorp', role: 'VP Engineering', isValid: true },
              { email: 'sarah.miller@growthlab.com', name: 'Sarah Miller', company: 'GrowthLab', role: 'Director of Operations', isValid: true },
              { email: 'jordan.smith@cloudpulse.ai', name: 'Jordan Smith', company: 'CloudPulse', role: 'Head of AI', isValid: true },
              { email: 'emily.davis@fintechhub.net', name: 'Emily Davis', company: 'FintechHub', role: 'Lead Product Manager', isValid: true },
              { email: 'marcus.vance@databridge.co', name: 'Marcus Vance', company: 'DataBridge', role: 'CTO', isValid: true },
              { email: 'olivia.wang@salespeak.io', name: 'Olivia Wang', company: 'SalesPeak', role: 'VP Sales Operations', isValid: true },
              { email: 'david.ross@hyperflow.dev', name: 'David Ross', company: 'HyperFlow', role: 'Principal Architect', isValid: true },
              { email: 'sophia.martinez@swiftscale.co', name: 'Sophia Martinez', company: 'SwiftScale', role: 'Chief Operations Officer', isValid: true },
              { email: 'liam.johnson@apixcel.com', name: 'Liam Johnson', company: 'APIXcel', role: 'Head of Partnerships', isValid: true },
              { email: 'ava.patel@nexuscloud.ai', name: 'Ava Patel', company: 'NexusCloud', role: 'Director of Engineering', isValid: true },
            ],
          },
        },
      },
      {
        id: 'node_openai_batch',
        type: 'openai_llm',
        position: { x: 450, y: 150 },
        data: {
          id: 'node_openai_batch',
          label: 'OpenAI Bulk Personalizer',
          category: 'ai',
          nodeType: 'openai_llm',
          status: 'idle',
          config: {
            apiKeySource: 'global',
            model: 'gpt-4o-mini',
            executionMode: 'batch',
            batchSourceField: 'node_csv_upload.recipients',
            systemPrompt: 'You are an executive outreach specialist. Craft a hyper-relevant, polite 3-sentence introduction tailored to the contact.',
            userPrompt: 'Write a personalized outreach email to {{item.name}} who leads as {{item.role}} at {{item.company}}.\nMention how FlowCraft can automate their AI pipelines and invite them to explore a quick demo.',
            temperature: 0.7,
            maxTokens: 300,
            responseFormat: 'text',
            mockFallback: true,
          },
        },
      },
      {
        id: 'node_gmail_bulk',
        type: 'gmail_send',
        position: { x: 880, y: 180 },
        data: {
          id: 'node_gmail_bulk',
          label: 'Gmail Bulk Sender',
          category: 'action',
          nodeType: 'gmail_send',
          status: 'idle',
          config: {
            authMethod: 'sandbox',
            sendMode: 'bulk',
            bulkRecipientSource: 'node_openai_batch.items',
            rateLimitDelayMs: 200,
            subject: 'Quick question for {{item.name}} regarding {{item.company}} automation',
            body: 'Hi {{item.name}},\n\n{{personalizedText}}\n\nBest regards,\nJordan Lee\nFlowCraft Studio',
            isHtml: false,
            sendAsDraft: false,
          },
        },
      },
    ],
    edges: [
      {
        id: 'e-csv-ai',
        source: 'node_csv_upload',
        target: 'node_openai_batch',
        animated: true,
        style: { stroke: '#7c3aed', strokeWidth: 2 },
      },
      {
        id: 'e-ai-gmail',
        source: 'node_openai_batch',
        target: 'node_gmail_bulk',
        animated: true,
        style: { stroke: '#dc2626', strokeWidth: 2 },
      },
    ],
  },
  {
    id: 'customer-support-ai-responder',
    name: 'Customer Support AI Classifier & Gmail Responder',
    description: 'Capture support tickets via form, classify sentiment & urgency with OpenAI, and send tailored replies via Gmail.',
    category: 'Customer Support',
    icon: 'Sparkles',
    badge: 'Popular',
    nodes: [
      {
        id: 'node_form_trigger',
        type: 'input_form_trigger',
        position: { x: 50, y: 180 },
        data: {
          id: 'node_form_trigger',
          label: 'Customer Support Form',
          category: 'trigger',
          nodeType: 'input_form_trigger',
          status: 'idle',
          config: {
            formTitle: 'Submit a Support Ticket',
            formDescription: 'Provide your issue details below for immediate AI triage.',
            fields: [
              { id: 'f1', name: 'customerName', label: 'Full Name', type: 'text', defaultValue: 'Alex Morgan', required: true },
              { id: 'f2', name: 'customerEmail', label: 'Email Address', type: 'email', defaultValue: 'alex.morgan@example.com', required: true },
              { id: 'f3', name: 'issueCategory', label: 'Category', type: 'select', options: ['Billing', 'Bug Report', 'Feature Request', 'Other'], defaultValue: 'Feature Request', required: true },
              { id: 'f4', name: 'message', label: 'Message / Issue Details', type: 'textarea', defaultValue: 'I would love to see an integration with Gmail to trigger automatic emails when a workflow finishes!', required: true },
            ],
            submittedValues: {
              customerName: 'Alex Morgan',
              customerEmail: 'alex.morgan@example.com',
              issueCategory: 'Feature Request',
              message: 'I would love to see an integration with Gmail to trigger automatic emails when a workflow finishes!',
            },
          },
        },
      },
      {
        id: 'node_openai_classifier',
        type: 'openai_llm',
        position: { x: 450, y: 150 },
        data: {
          id: 'node_openai_classifier',
          label: 'OpenAI Ticket Analysis & Draft',
          category: 'ai',
          nodeType: 'openai_llm',
          status: 'idle',
          config: {
            apiKeySource: 'global',
            model: 'gpt-4o-mini',
            executionMode: 'single',
            systemPrompt: 'You are an elite customer success triage AI. Analyze the customer inquiry, categorize urgency, and write a warm, professional, actionable reply.',
            userPrompt: 'Analyze this support ticket:\nCustomer: {{node_form_trigger.submittedValues.customerName}}\nEmail: {{node_form_trigger.submittedValues.customerEmail}}\nCategory: {{node_form_trigger.submittedValues.issueCategory}}\nMessage: {{node_form_trigger.submittedValues.message}}\n\nPlease produce a friendly, reassuring reply addressing their feature request.',
            temperature: 0.7,
            maxTokens: 500,
            responseFormat: 'text',
            mockFallback: true,
          },
        },
      },
      {
        id: 'node_gmail_send',
        type: 'gmail_send',
        position: { x: 880, y: 180 },
        data: {
          id: 'node_gmail_send',
          label: 'Gmail Auto-Response',
          category: 'action',
          nodeType: 'gmail_send',
          status: 'idle',
          config: {
            authMethod: 'sandbox',
            sendMode: 'single',
            to: '{{node_form_trigger.submittedValues.customerEmail}}',
            cc: 'support-team@company.com',
            subject: 'We received your feedback: {{node_form_trigger.submittedValues.issueCategory}} (Ticket #{{runId}})',
            body: 'Hi {{node_form_trigger.submittedValues.customerName}},\n\nThank you for reaching out to us!\n\nHere is our initial update regarding your request:\n\n{{node_openai_classifier.output}}\n\nWarm regards,\nProduct Operations Team',
            isHtml: false,
            sendAsDraft: false,
          },
        },
      },
    ],
    edges: [
      {
        id: 'e1-2',
        source: 'node_form_trigger',
        target: 'node_openai_classifier',
        animated: true,
        style: { stroke: '#7c3aed', strokeWidth: 2 },
      },
      {
        id: 'e2-3',
        source: 'node_openai_classifier',
        target: 'node_gmail_send',
        animated: true,
        style: { stroke: '#dc2626', strokeWidth: 2 },
      },
    ],
  },
  {
    id: 'document-resume-analyzer',
    name: 'Document & Resume AI Screening with Gmail Alert',
    description: 'Process uploaded resume documents, extract structured competencies and score candidates with OpenAI, then email the hiring manager.',
    category: 'HR & Recruiting',
    icon: 'FileText',
    badge: 'New',
    nodes: [
      {
        id: 'node_file_trigger',
        type: 'file_upload_trigger',
        position: { x: 60, y: 180 },
        data: {
          id: 'node_file_trigger',
          label: 'Resume Document Upload',
          category: 'trigger',
          nodeType: 'file_upload_trigger',
          status: 'idle',
          config: {
            allowedTypes: ['.pdf', '.txt', '.json', '.docx'],
            maxSizeMb: 10,
            sampleFileName: 'sarah_chen_staff_engineer.json',
            sampleFileContent: JSON.stringify({
              candidateName: 'Sarah Chen',
              appliedRole: 'Senior Workflow Solutions Architect',
              yearsExperience: 8,
              coreSkills: ['Next.js', 'TypeScript', 'Node.js', 'Distributed Systems', 'LLM Agents'],
              education: 'B.S. in Computer Science, Berkeley',
              summary: 'Experienced architect specializing in low-code orchestration platforms, webhook streaming, and enterprise automation pipelines.'
            }, null, 2),
            parsedData: {
              candidateName: 'Sarah Chen',
              appliedRole: 'Senior Workflow Solutions Architect',
              yearsExperience: 8,
              coreSkills: ['Next.js', 'TypeScript', 'Node.js', 'Distributed Systems', 'LLM Agents'],
              education: 'B.S. in Computer Science, Berkeley',
            }
          },
        },
      },
      {
        id: 'node_openai_resume',
        type: 'openai_llm',
        position: { x: 460, y: 150 },
        data: {
          id: 'node_openai_resume',
          label: 'OpenAI Candidate Evaluation',
          category: 'ai',
          nodeType: 'openai_llm',
          status: 'idle',
          config: {
            apiKeySource: 'global',
            model: 'gpt-4o',
            executionMode: 'single',
            systemPrompt: 'You are an expert technical recruiter and talent evaluator. Analyze the resume profile, calculate fit score out of 100, and highlight key strengths.',
            userPrompt: 'Evaluate this candidate profile for Senior Workflow Solutions Architect:\n{{node_file_trigger.sampleFileContent}}\n\nProvide: Match Score, Technical Strengths, and Recommendation for Interview.',
            temperature: 0.5,
            maxTokens: 600,
            responseFormat: 'text',
            mockFallback: true,
          },
        },
      },
      {
        id: 'node_gmail_hiring_manager',
        type: 'gmail_send',
        position: { x: 880, y: 180 },
        data: {
          id: 'node_gmail_hiring_manager',
          label: 'Gmail Candidate Report',
          category: 'action',
          nodeType: 'gmail_send',
          status: 'idle',
          config: {
            authMethod: 'sandbox',
            sendMode: 'single',
            to: 'recruiting-team@acme.ai',
            cc: 'vp-engineering@acme.ai',
            subject: 'Candidate Evaluation Ready: {{node_file_trigger.parsedData.candidateName}} - {{node_file_trigger.parsedData.appliedRole}}',
            body: 'Dear Hiring Committee,\n\nOpenAI has analyzed the latest application submission.\n\nSummary Report:\n{{node_openai_resume.output}}\n\nAttached File: {{node_file_trigger.sampleFileName}}\n\nPlease review to schedule next steps.',
            isHtml: false,
            sendAsDraft: false,
          },
        },
      },
    ],
    edges: [
      {
        id: 'e-file-ai',
        source: 'node_file_trigger',
        target: 'node_openai_resume',
        animated: true,
        style: { stroke: '#7c3aed', strokeWidth: 2 },
      },
      {
        id: 'e-ai-gmail',
        source: 'node_openai_resume',
        target: 'node_gmail_hiring_manager',
        animated: true,
        style: { stroke: '#dc2626', strokeWidth: 2 },
      },
    ],
  },
];
