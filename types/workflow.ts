export type NodeCategory = 'trigger' | 'ai' | 'action' | 'logic' | 'output';

export type NodeType =
  | 'file_upload_trigger'
  | 'input_form_trigger'
  | 'webhook_trigger'
  | 'email_list_file_upload'
  | 'openai_llm'
  | 'openai_classifier'
  | 'gmail_send'
  | 'code_transform'
  | 'condition_filter';

export type NodeExecutionStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped';

export interface WorkflowNodeData {
  id: string;
  label: string;
  description?: string;
  nodeType: NodeType;
  category: NodeCategory;
  status: NodeExecutionStatus;
  executionDuration?: number;
  lastRunError?: string;
  lastRunOutput?: any;
  lastRunInput?: any;
  config: Record<string, any>;
  [key: string]: any;
}

export interface FormFieldDefinition {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'number' | 'select';
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
  required?: boolean;
}

export interface FileUploadConfig {
  allowedTypes: string[];
  maxSizeMb: number;
  sampleFileName?: string;
  sampleFileContent?: string;
  parsedData?: any;
}

export interface RecipientRecord {
  email: string;
  name?: string;
  company?: string;
  role?: string;
  notes?: string;
  [key: string]: any;
}

export interface EmailListFileConfig {
  fileName: string;
  rawContent: string;
  fileType: 'csv' | 'json' | 'txt';
  emailColumn: string;
  nameColumn: string;
  companyColumn: string;
  recipients: RecipientRecord[];
  totalCount: number;
  validCount: number;
  invalidCount: number;
}

export interface InputFormConfig {
  formTitle: string;
  formDescription: string;
  fields: FormFieldDefinition[];
  submittedValues: Record<string, any>;
}

export interface OpenAiConfig {
  apiKeySource: 'global' | 'custom';
  customApiKey?: string;
  customBaseUrl?: string;
  model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo';
  executionMode: 'single' | 'batch';
  batchSourceField?: string; // e.g. {{email_list_trigger.recipients}}
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  responseFormat: 'text' | 'json_object';
  mockFallback: boolean;
}

export interface GmailConfig {
  authMethod: 'global' | 'app_password' | 'oauth_token';
  customUserEmail?: string;
  customAppPassword?: string;
  customOAuthToken?: string;
  sendMode: 'single' | 'bulk';
  bulkRecipientSource?: string; // e.g. {{email_list_trigger.recipients}} or {{openai_llm.items}}
  rateLimitDelayMs?: number;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  isHtml: boolean;
  sendAsDraft?: boolean;
}

export interface CodeTransformConfig {
  code: string;
}

export interface ConditionFilterConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_truthy';
  value: string;
}

export interface WorkflowExecutionLog {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  status: NodeExecutionStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  inputPayload: any;
  outputPayload: any;
  error?: string;
  tokensUsed?: number;
}

export interface WorkflowExecutionResult {
  runId: string;
  workflowId?: string;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  success: boolean;
  logs: WorkflowExecutionLog[];
  finalOutputs: Record<string, any>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  badge: string;
  nodes: any[];
  edges: any[];
}
