import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Layout } from '@/components/Layout'
import { ApiKeySetup } from '@/components/ApiKeySetup'
import { Dashboard } from '@/pages/Dashboard'
import { Connection } from '@/pages/Connection'
import { Messages } from '@/pages/Messages'
import { History } from '@/pages/History'
import { Logs } from '@/pages/Logs'
import { Settings } from '@/pages/Settings'
import { AutoReply } from '@/pages/AutoReply'
import { getApiKey, api } from '@/lib/api'

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const key = getApiKey()
      if (!key) {
        setAuthenticated(false)
        return
      }

      // Validate the stored key
      try {
        const valid = await api.validateApiKey(key)
        setAuthenticated(valid)
      } catch {
        setAuthenticated(false)
      }
    }

    checkAuth()
  }, [])

  // Loading state
  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Need API key
  if (!authenticated) {
    return (
      <>
        <ApiKeySetup onSuccess={() => setAuthenticated(true)} />
        <Toaster position="bottom-right" richColors />
      </>
    )
  }

  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="connection" element={<Connection />} />
            <Route path="messages" element={<Messages />} />
            <Route path="history" element={<History />} />
            <Route path="auto-reply" element={<AutoReply />} />
            <Route path="logs" element={<Logs />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors />
    </TooltipProvider>
  )
}

export default App
