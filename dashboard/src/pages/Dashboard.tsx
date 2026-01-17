import { 
  Activity, 
  MessageSquare, 
  Clock, 
  Wifi,
  WifiOff,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useStatus, useLogs } from '@/hooks/useApi'
import { cn } from '@/lib/utils'

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

export function Dashboard() {
  const { data: status, loading: statusLoading, error: statusError } = useStatus()
  const { data: logs } = useLogs(50)

  const isConnected = status?.connection?.connected
  const recentLogs = logs?.logs?.slice(0, 5) || []
  
  // Count messages
  const messagesIn = logs?.logs?.filter(l => l.type === 'message_in').length || 0
  const messagesOut = logs?.logs?.filter(l => l.type === 'message_out').length || 0

  if (statusError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in-up">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Cannot Connect to API</h2>
        <p className="text-muted-foreground max-w-md">
          Make sure the WhatsApp bot is running on port 3001.
          <br />
          Run <code className="bg-muted px-2 py-1 rounded text-sm">node bot.js</code> to start the bot.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your WhatsApp connection and activity
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Connection Status */}
        <Card className={cn(
          "animate-fade-in-up stagger-1 transition-all duration-300 hover:shadow-lg",
          isConnected ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {isConnected ? (
              <Wifi className="h-4 w-4 text-primary" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-primary animate-pulse" : "bg-destructive"
              )} />
              <span className="text-2xl font-bold">
                {statusLoading ? '...' : isConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
            {status?.connection?.number && (
              <p className="text-xs text-muted-foreground mt-1">
                +{status.connection.number}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Messages In */}
        <Card className="animate-fade-in-up stagger-2 transition-all duration-300 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Messages In</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messagesIn}</div>
            <p className="text-xs text-muted-foreground">Received messages</p>
          </CardContent>
        </Card>

        {/* Messages Out */}
        <Card className="animate-fade-in-up stagger-3 transition-all duration-300 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Messages Out</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-chart-1" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messagesOut}</div>
            <p className="text-xs text-muted-foreground">Sent messages</p>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card className="animate-fade-in-up stagger-4 transition-all duration-300 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status ? formatUptime(status.stats.uptime) : '...'}
            </div>
            <p className="text-xs text-muted-foreground">Since start</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats and Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Memory Usage */}
        <Card className="animate-fade-in-up stagger-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              System Stats
            </CardTitle>
            <CardDescription>Memory and resource usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Heap Used</span>
                <span className="font-medium">
                  {status ? formatBytes(status.stats.memory.heapUsed) : '...'}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ 
                    width: status 
                      ? `${(status.stats.memory.heapUsed / status.stats.memory.heapTotal) * 100}%` 
                      : '0%' 
                  }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Heap Total</span>
                <span className="font-medium">
                  {status ? formatBytes(status.stats.memory.heapTotal) : '...'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">RSS</span>
                <span className="font-medium">
                  {status ? formatBytes(status.stats.memory.rss) : '...'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Logs</span>
                <span className="font-medium">{status?.stats.logs_count || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="animate-fade-in-up stagger-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest events and messages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent activity
                </p>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 group">
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                      log.type === 'error' && "bg-destructive",
                      log.type === 'message_in' && "bg-chart-2",
                      log.type === 'message_out' && "bg-chart-1",
                      log.type === 'connection' && "bg-primary",
                      log.type === 'info' && "bg-muted-foreground",
                      log.type === 'api' && "bg-chart-4"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate group-hover:whitespace-normal transition-all">
                        {log.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {log.type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
