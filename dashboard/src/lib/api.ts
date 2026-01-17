// Use relative URL in production (when served from same origin)
// Use localhost:3001 in development
const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : ''

// API Key storage
let apiKey: string | null = localStorage.getItem('wa_api_key')

export function setApiKey(key: string) {
  apiKey = key
  localStorage.setItem('wa_api_key', key)
}

export function getApiKey(): string | null {
  return apiKey
}

export function clearApiKey() {
  apiKey = null
  localStorage.removeItem('wa_api_key')
}

// Helper to add auth headers
function authHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }
  return headers
}

function authHeadersMultipart(): HeadersInit {
  const headers: HeadersInit = {}
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }
  return headers
}

export interface HealthResponse {
  status: string
  whatsapp_connected: boolean
  connection_status: string
  connected_number: string | null
  timestamp: string
  uptime: number
  auth_required?: boolean
}

export interface StatusResponse {
  success: boolean
  connection: {
    status: string
    connected: boolean
    number: string | null
    registered: boolean
  }
  stats: {
    logs_count: number
    logs_by_type?: Record<string, number>
    uptime: number
    memory: {
      rss: number
      heapTotal: number
      heapUsed: number
      external: number
    }
    database?: string
  }
}

export interface LogEntry {
  id: string
  timestamp: string
  type: 'info' | 'error' | 'message_in' | 'message_out' | 'connection' | 'api'
  message: string
  details: Record<string, unknown>
}

export interface LogsResponse {
  success: boolean
  logs: LogEntry[]
  total: number
  database?: string
}

export interface LogStatsResponse {
  success: boolean
  total: number
  by_type: Record<string, number>
}

export interface PairingResponse {
  success: boolean
  pairingCode?: string
  phoneNumber?: string
  error?: string
}

export interface SendMessageResponse {
  success: boolean
  message?: string
  messageId?: string
  to?: string
  error?: string
}

export interface ApiKeyResponse {
  success: boolean
  api_key: string
  masked?: string
  message?: string
  error?: string
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (response.status === 401 || response.status === 403) {
    throw new Error(data.error || 'Authentication failed. Check your API key.')
  }
  return data
}

export const api = {
  // Health check (no auth required)
  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${API_BASE}/health`)
    if (!response.ok) throw new Error('Failed to fetch health')
    return response.json()
  },

  async getStatus(): Promise<StatusResponse> {
    const response = await fetch(`${API_BASE}/api/status`, {
      headers: authHeaders()
    })
    return handleResponse(response)
  },

  async getLogs(limit = 100, type?: string): Promise<LogsResponse> {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (type) params.append('type', type)
    const response = await fetch(`${API_BASE}/api/logs?${params}`, {
      headers: authHeaders()
    })
    return handleResponse(response)
  },

  async clearLogs(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/api/logs`, { 
      method: 'DELETE',
      headers: authHeaders()
    })
    return handleResponse(response)
  },

  async getLogStats(): Promise<LogStatsResponse> {
    const response = await fetch(`${API_BASE}/api/logs/stats`, {
      headers: authHeaders()
    })
    return handleResponse(response)
  },

  async requestPairing(phoneNumber: string): Promise<PairingResponse> {
    const response = await fetch(`${API_BASE}/api/request-pairing`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phoneNumber })
    })
    return handleResponse(response)
  },

  async disconnect(): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await fetch(`${API_BASE}/api/disconnect`, { 
      method: 'POST',
      headers: authHeaders()
    })
    return handleResponse(response)
  },

  async reconnect(): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await fetch(`${API_BASE}/api/reconnect`, { 
      method: 'POST',
      headers: authHeaders()
    })
    return handleResponse(response)
  },

  async resetAuth(): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await fetch(`${API_BASE}/api/reset-auth`, { 
      method: 'POST',
      headers: authHeaders()
    })
    return handleResponse(response)
  },

  async sendMessage(phoneNumber: string, message: string): Promise<SendMessageResponse> {
    const response = await fetch(`${API_BASE}/api/send-message`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phoneNumber, message })
    })
    return handleResponse(response)
  },

  async sendImage(phoneNumber: string, image: File, caption?: string): Promise<SendMessageResponse> {
    const formData = new FormData()
    formData.append('phoneNumber', phoneNumber)
    formData.append('image', image)
    if (caption) formData.append('caption', caption)
    
    const response = await fetch(`${API_BASE}/api/send-image`, {
      method: 'POST',
      headers: authHeadersMultipart(),
      body: formData
    })
    return handleResponse(response)
  },

  // API Key management
  async getApiKeyInfo(): Promise<ApiKeyResponse> {
    const response = await fetch(`${API_BASE}/api/apikey`, {
      headers: authHeaders()
    })
    return handleResponse(response)
  },

  async regenerateApiKey(): Promise<ApiKeyResponse> {
    const response = await fetch(`${API_BASE}/api/apikey/regenerate`, {
      method: 'POST',
      headers: authHeaders()
    })
    const data = await handleResponse<ApiKeyResponse>(response)
    if (data.success && data.api_key) {
      setApiKey(data.api_key)
    }
    return data
  },

  // Validate API key
  async validateApiKey(key: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/api/status`, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': key
        }
      })
      return response.ok
    } catch {
      return false
    }
  }
}
