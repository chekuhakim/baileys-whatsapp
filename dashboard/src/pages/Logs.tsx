import { useState, useEffect } from 'react'
import { 
  ScrollText, 
  Trash2, 
  RefreshCw,
  Filter,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Info,
  Link2,
  Globe,
  Database
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useLogs } from '@/hooks/useApi'
import { api } from '@/lib/api'
import type { LogEntry, LogStatsResponse } from '@/lib/api'
import { cn } from '@/lib/utils'

const logTypeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  info: { icon: <Info className="w-3.5 h-3.5" />, color: 'bg-muted-foreground', label: 'Info' },
  error: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'bg-destructive', label: 'Error' },
  message_in: { icon: <ArrowDownLeft className="w-3.5 h-3.5" />, color: 'bg-chart-2', label: 'Incoming' },
  message_out: { icon: <ArrowUpRight className="w-3.5 h-3.5" />, color: 'bg-chart-1', label: 'Outgoing' },
  connection: { icon: <Link2 className="w-3.5 h-3.5" />, color: 'bg-primary', label: 'Connection' },
  api: { icon: <Globe className="w-3.5 h-3.5" />, color: 'bg-chart-4', label: 'API' },
}

function LogItem({ log }: { log: LogEntry }) {
  const config = logTypeConfig[log.type] || logTypeConfig.info
  const [expanded, setExpanded] = useState(false)
  const hasDetails = Object.keys(log.details).length > 0

  return (
    <div 
      className={cn(
        "p-3 rounded-lg border bg-card transition-all duration-200",
        "hover:shadow-md cursor-pointer",
        expanded && "ring-1 ring-primary/20"
      )}
      onClick={() => hasDetails && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white",
          config.color
        )}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
              {config.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {new Date(log.timestamp).toLocaleString()}
            </span>
          </div>
          <p className="text-sm mt-1 break-words">{log.message}</p>
          
          {expanded && hasDetails && (
            <div className="mt-3 p-2 rounded bg-muted/50 text-xs font-mono overflow-x-auto">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function Logs() {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [stats, setStats] = useState<LogStatsResponse | null>(null)
  
  const filterType = typeFilter === 'all' ? undefined : typeFilter
  const { data, loading, refetch, clearLogs } = useLogs(200, filterType)
  
  const logs = data?.logs || []

  // Fetch stats from SQLite
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await api.getLogStats()
        setStats(result)
      } catch {
        // Ignore errors
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleClearLogs = async () => {
    await clearLogs()
    setClearDialogOpen(false)
    // Refresh stats after clearing
    const result = await api.getLogStats()
    setStats(result)
  }

  const handleExport = () => {
    const jsonString = JSON.stringify(logs, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `whatsapp-logs-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Use stats from SQLite for accurate counts
  const counts = {
    all: stats?.total || data?.total || 0,
    message_in: stats?.by_type?.message_in || 0,
    message_out: stats?.by_type?.message_out || 0,
    error: stats?.by_type?.error || 0,
    connection: stats?.by_type?.connection || 0,
    api: stats?.by_type?.api || 0,
    info: stats?.by_type?.info || 0,
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
        <p className="text-muted-foreground mt-1">
          View and manage activity logs
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 animate-fade-in-up stagger-1">
        {Object.entries(counts).map(([type, count]) => {
          const config = logTypeConfig[type] || { label: 'All', color: 'bg-muted' }
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={cn(
                "p-3 rounded-xl border text-center transition-all duration-200",
                "hover:shadow-md hover:border-primary/30",
                typeFilter === type && "border-primary bg-primary/5 ring-1 ring-primary/20"
              )}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {type === 'all' ? 'Total' : config.label}
              </p>
            </button>
          )
        })}
      </div>

      {/* Logs Card */}
      <Card className="animate-fade-in-up stagger-2">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-primary" />
                Activity Log
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                Real-time log entries (auto-refreshes every 3s)
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Database className="w-3 h-3" />
                  SQLite
                </Badge>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="message_in">Incoming</SelectItem>
                  <SelectItem value="message_out">Outgoing</SelectItem>
                  <SelectItem value="connection">Connection</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>

              <Button variant="outline" size="icon" onClick={handleExport} disabled={logs.length === 0}>
                <Download className="w-4 h-4" />
              </Button>

              <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Clear All Logs?</DialogTitle>
                    <DialogDescription>
                      This will permanently delete all log entries. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleClearLogs}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <ScrollText className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No logs to display</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {typeFilter !== 'all' ? 'Try changing the filter' : 'Logs will appear here'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <LogItem key={log.id} log={log} />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
