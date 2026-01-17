import { useState } from 'react'
import { 
  Settings as SettingsIcon, 
  Server,
  Copy,
  Check,
  ExternalLink,
  Code,
  Book,
  Key,
  RefreshCw,
  Eye,
  EyeOff,
  LogOut,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useHealth } from '@/hooks/useApi'
import { api, getApiKey, clearApiKey } from '@/lib/api'

// Dynamically detect API base URL
const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.host}`

const endpoints = [
  { method: 'GET', path: '/health', description: 'Check API health (no auth)', auth: false },
  { method: 'GET', path: '/api/status', description: 'Get detailed status and statistics', auth: true },
  { method: 'GET', path: '/api/logs', description: 'Retrieve activity logs', auth: true },
  { method: 'GET', path: '/api/logs/stats', description: 'Get log statistics by type', auth: true },
  { method: 'DELETE', path: '/api/logs', description: 'Clear all logs', auth: true },
  { method: 'POST', path: '/api/request-pairing', description: 'Generate pairing code', auth: true },
  { method: 'POST', path: '/api/disconnect', description: 'Disconnect session', auth: true },
  { method: 'POST', path: '/api/reconnect', description: 'Reconnect to WhatsApp', auth: true },
  { method: 'POST', path: '/api/reset-auth', description: 'Reset authentication', auth: true },
  { method: 'POST', path: '/api/send-message', description: 'Send a text message', auth: true },
  { method: 'POST', path: '/api/send-file', description: 'Send any file (images, videos, audio, documents)', auth: true },
  { method: 'POST', path: '/api/send-image', description: 'Send an image with caption (legacy)', auth: true },
  { method: 'GET', path: '/api/apikey', description: 'Get current API key', auth: true },
  { method: 'POST', path: '/api/apikey/regenerate', description: 'Regenerate API key', auth: true },
]

export function Settings() {
  const { data: health } = useHealth()
  const [copied, setCopied] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const currentApiKey = getApiKey() || ''

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(null), 2000)
  }

  const handleRegenerateApiKey = async () => {
    setLoading(true)
    try {
      const result = await api.regenerateApiKey()
      if (result.success) {
        toast.success('API key regenerated! Dashboard will use the new key.')
        setRegenerateDialogOpen(false)
      } else {
        toast.error(result.error || 'Failed to regenerate API key')
      }
    } catch {
      toast.error('Failed to regenerate API key')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearApiKey()
    window.location.reload()
  }

  const codeExamples = {
    curl: `# Send a text message (with API key)
curl -X POST ${API_BASE}/api/send-message \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${showApiKey ? currentApiKey : 'YOUR_API_KEY'}" \\
  -d '{"phoneNumber": "60123456789", "message": "Hello from API!"}'

# Check health (no auth needed)
curl ${API_BASE}/health`,

    javascript: `// Using fetch with API key
const API_KEY = '${showApiKey ? currentApiKey : 'YOUR_API_KEY'}';

const response = await fetch('${API_BASE}/api/send-message', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  },
  body: JSON.stringify({
    phoneNumber: '60123456789',
    message: 'Hello from API!'
  })
});
const result = await response.json();
console.log(result);`,

    python: `import requests

API_KEY = '${showApiKey ? currentApiKey : 'YOUR_API_KEY'}'

# Send message
response = requests.post(
    '${API_BASE}/api/send-message',
    headers={'X-API-Key': API_KEY},
    json={
        'phoneNumber': '60123456789',
        'message': 'Hello from API!'
    }
)
print(response.json())`,
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          API configuration, authentication, and documentation
        </p>
      </div>

      {/* API Key Management */}
      <Card className="animate-fade-in-up stagger-1 border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            API Key
          </CardTitle>
          <CardDescription>
            Your API key is required for all authenticated endpoints
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">Current API Key</p>
              <code className="font-mono text-sm break-all">
                {showApiKey ? currentApiKey : currentApiKey.substring(0, 6) + '•'.repeat(20) + currentApiKey.substring(currentApiKey.length - 4)}
              </code>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(currentApiKey, 'apikey')}
              >
                {copied === 'apikey' ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Regenerate API Key?</DialogTitle>
                  <DialogDescription>
                    This will invalidate the current API key. All applications using the old key will stop working until updated with the new key.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRegenerateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleRegenerateApiKey} disabled={loading}>
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Regenerate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Logout from Dashboard?</DialogTitle>
                  <DialogDescription>
                    This will clear the stored API key from this browser. You'll need to enter it again to access the dashboard.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setLogoutDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* API Status */}
      <Card className="animate-fade-in-up stagger-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            API Server
          </CardTitle>
          <CardDescription>
            Current API server configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Base URL</p>
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm">{API_BASE}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCopy(API_BASE, 'url')}
                >
                  {copied === 'url' ? (
                    <Check className="w-3 h-3 text-primary" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Key className="w-3 h-3" />
                Auth Required
              </Badge>
              <Badge variant={health?.status === 'OK' ? 'default' : 'destructive'}>
                {health?.status || 'Unknown'}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-3 rounded-lg border text-center">
              <p className="text-2xl font-bold">{health?.uptime ? Math.floor(health.uptime / 60) : 0}m</p>
              <p className="text-xs text-muted-foreground">Uptime</p>
            </div>
            <div className="p-3 rounded-lg border text-center">
              <p className="text-2xl font-bold">3001</p>
              <p className="text-xs text-muted-foreground">Port</p>
            </div>
            <div className="p-3 rounded-lg border text-center">
              <p className="text-2xl font-bold">{endpoints.length}</p>
              <p className="text-xs text-muted-foreground">Endpoints</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Endpoints */}
      <Card className="animate-fade-in-up stagger-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="w-5 h-5 text-primary" />
            API Endpoints
          </CardTitle>
          <CardDescription>
            Available endpoints and their descriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {endpoints.map((endpoint) => (
              <div
                key={endpoint.path}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge 
                    variant="outline" 
                    className={
                      endpoint.method === 'GET' ? 'bg-chart-2/10 text-chart-2 border-chart-2/30' :
                      endpoint.method === 'POST' ? 'bg-chart-1/10 text-chart-1 border-chart-1/30' :
                      'bg-destructive/10 text-destructive border-destructive/30'
                    }
                  >
                    {endpoint.method}
                  </Badge>
                  <code className="text-sm font-mono">{endpoint.path}</code>
                  {endpoint.auth && (
                    <Key className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
                <span className="text-sm text-muted-foreground hidden md:block">
                  {endpoint.description}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Code Examples */}
      <Card className="animate-fade-in-up stagger-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-primary" />
            Code Examples
          </CardTitle>
          <CardDescription>
            Quick start examples for different languages (includes API key authentication)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl">
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            
            {Object.entries(codeExamples).map(([lang, code]) => (
              <TabsContent key={lang} value={lang} className="mt-4">
                <div className="relative">
                  <pre className="p-4 rounded-xl bg-sidebar text-sidebar-foreground text-sm overflow-x-auto">
                    <code>{code}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => handleCopy(code, lang)}
                  >
                    {copied === lang ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Links */}
      <Card className="animate-fade-in-up stagger-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href="https://github.com/WhiskeySockets/Baileys" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Baileys GitHub
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`${API_BASE}/health`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Health Check
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
