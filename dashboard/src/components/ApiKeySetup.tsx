import { useState } from 'react'
import { Key, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, setApiKey } from '@/lib/api'
import { toast } from 'sonner'

interface ApiKeySetupProps {
  onSuccess: () => void
}

export function ApiKeySetup({ onSuccess }: ApiKeySetupProps) {
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKeyInput.trim()) {
      setError('Please enter an API key')
      return
    }

    setLoading(true)
    setError('')

    try {
      const valid = await api.validateApiKey(apiKeyInput.trim())
      if (valid) {
        setApiKey(apiKeyInput.trim())
        toast.success('API key validated successfully!')
        onSuccess()
      } else {
        setError('Invalid API key. Check the key and try again.')
      }
    } catch {
      setError('Failed to validate API key. Is the bot running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in-up">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Key className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">API Key Required</CardTitle>
          <CardDescription>
            Enter your API key to access the dashboard. You can find it in the bot console when you start <code className="bg-muted px-1.5 py-0.5 rounded text-xs">node bot.js</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apikey">API Key</Label>
              <Input
                id="apikey"
                type="password"
                placeholder="wa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="font-mono"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Connect
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground text-center">
              The API key is shown in the terminal when you start the bot:
            </p>
            <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
              <code>🔐 API Key: wa_abc123...</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
