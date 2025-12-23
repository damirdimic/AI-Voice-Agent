
export enum VoiceName {
  Puck = 'Puck',
  Charon = 'Charon',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}

export enum ModelProvider {
  GEMINI = 'Gemini',
  OPENAI = 'OpenAI',
  DEEPSEEK = 'DeepSeek',
  ANTHROPIC = 'Anthropic'
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
  }>;
  required?: string[];
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameters;
  useWebhook: boolean;
  requireConfirmation: boolean;
}

export interface Incident {
  id: string;
  clientName: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved';
  createdAt: number;
}

export interface Agent {
  id: string;
  name: string;
  clientName: string;
  icon: string;
  description: string;
  detailedDescription: string;
  systemInstruction: string;
  voice: VoiceName;
  voiceSample?: string;
  tools: AgentTool[];
  webhookUrl?: string;
  provider: ModelProvider; // New: Model provider selection
  modelId: string; // New: Specific model version
  createdAt: number;
}

export interface TranscriptionEntry {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
