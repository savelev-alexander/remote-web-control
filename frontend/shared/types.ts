export interface SessionResponse {
  session_id: string;
}

export interface ExecuteRequest {
  session_id: string;
  steps: string[];
}

export interface ExecuteResponse {
  status: string;
}

export interface PollResponse {
  commands: string[];
}

export interface ApiError {
  error: string;
}

export type RegistryKind = 'button' | 'input' | 'select' | 'toggle' | 'slider';

export interface RegistryElement {
  id: string;
  kind: RegistryKind;
  label: string;
  group?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

export interface RegistryResponse {
  version: number;
  elements: RegistryElement[];
}

export interface PutRegistryRequest {
  version: number;
  elements: RegistryElement[];
}

export interface PutRegistryResponse {
  status: string;
  version: number;
}
