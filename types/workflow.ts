export type NodeCategory = 'trigger' | 'ai' | 'action' | 'logic' | 'output';

export type NodeType =
  | 'file_upload_trigger'
  | 'input_form_trigger'
  | 'webhook_trigger'
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
  options?: string[]; // for select
  required?: boolean;
}

export interface FileUploadConfig {
  allowedTypes: string[];
  maxSizeMb: number;
  sampleFileName?: string;
  sampleFileContent?: string;
  parsedData?: any;
}

export interface InputFormConfig {
  formTitle: string;
  formDescription: string;
  fields: FormFieldDefinition[];
  submittedValues: Record<string, any>;
}

export interface OpenAiConfig {
  model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo';
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  responseFormat: 'text' | 'json_object';
  mockFallback: boolean;
}

export interface GmailConfig {
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
