import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Plus,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  Save
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { api } from '@/lib/api'

interface AutoReplyRule {
  id: number
  trigger_word: string
  reply_message: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export function AutoReply() {
  const [autoReplies, setAutoReplies] = useState<AutoReplyRule[]>([])
  const [loading, setLoading] = useState(true)
  const [newTriggerWord, setNewTriggerWord] = useState('')
  const [newReplyMessage, setNewReplyMessage] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState<AutoReplyRule | null>(null)

  const fetchAutoReplies = async () => {
    setLoading(true)
    try {
      const response = await api.getAutoReplies()
      if (response.success) {
        setAutoReplies(response.auto_replies || [])
      } else {
        toast.error('Failed to fetch auto-reply rules')
      }
    } catch (error) {
      toast.error('Failed to fetch auto-reply rules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAutoReplies()
    const interval = setInterval(fetchAutoReplies, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const handleAddRule = async () => {
    if (!newTriggerWord.trim() || !newReplyMessage.trim()) {
      toast.error('Both trigger word and reply message are required')
      return
    }

    try {
      const response = await api.addAutoReply(newTriggerWord.trim(), newReplyMessage.trim())
      if (response.success) {
        toast.success('Auto-reply rule added successfully')
        setNewTriggerWord('')
        setNewReplyMessage('')
        setAddDialogOpen(false)
        fetchAutoReplies()
      } else {
        toast.error(response.error || 'Failed to add rule')
      }
    } catch (error) {
      toast.error('Failed to add auto-reply rule')
    }
  }

  const handleDeleteRule = async (rule: AutoReplyRule) => {
    try {
      const response = await api.deleteAutoReply(rule.id)
      if (response.success) {
        toast.success('Auto-reply rule deleted successfully')
        setDeleteDialogOpen(false)
        setRuleToDelete(null)
        fetchAutoReplies()
      } else {
        toast.error(response.error || 'Failed to delete rule')
      }
    } catch (error) {
      toast.error('Failed to delete auto-reply rule')
    }
  }

  const handleToggleRule = async (rule: AutoReplyRule) => {
    try {
      const response = await api.toggleAutoReply(rule.id)
      if (response.success) {
        toast.success(`Auto-reply rule ${rule.is_active ? 'disabled' : 'enabled'}`)
        fetchAutoReplies()
      } else {
        toast.error(response.error || 'Failed to toggle rule')
      }
    } catch (error) {
      toast.error('Failed to toggle auto-reply rule')
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Auto Reply</h1>
        <p className="text-muted-foreground mt-1">
          Manage automatic responses to incoming messages
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up stagger-1">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{autoReplies.length}</p>
                <p className="text-xs text-muted-foreground">Total Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Power className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{autoReplies.filter(r => r.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <PowerOff className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{autoReplies.filter(r => !r.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">10s</p>
                <p className="text-xs text-muted-foreground">Auto Refresh</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auto Reply Rules */}
      <Card className="animate-fade-in-up stagger-2">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Auto Reply Rules
              </CardTitle>
              <CardDescription>
                Configure automatic responses to incoming messages
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={fetchAutoReplies} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Auto Reply Rule</DialogTitle>
                    <DialogDescription>
                      Create a new automatic response rule. Messages containing the trigger word will get the reply.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="trigger">Trigger Word</Label>
                      <Input
                        id="trigger"
                        placeholder="e.g., hello, ping, bong"
                        value={newTriggerWord}
                        onChange={(e) => setNewTriggerWord(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reply">Reply Message</Label>
                      <Input
                        id="reply"
                        placeholder="e.g., Hi there! 👋"
                        value={newReplyMessage}
                        onChange={(e) => setNewReplyMessage(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddRule}>
                      <Save className="w-4 h-4 mr-2" />
                      Add Rule
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {autoReplies.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No auto-reply rules configured</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add your first rule to start automatic responses
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {autoReplies.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 rounded-xl border transition-all duration-200 hover:shadow-md"
                  >
                    {/* Rule Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={rule.is_active ? "default" : "secondary"}>
                          {rule.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Created: {new Date(rule.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Trigger:</span>
                          <code className="text-sm bg-muted px-2 py-1 rounded">"{rule.trigger_word}"</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Reply:</span>
                          <span className="text-sm text-muted-foreground">"{rule.reply_message}"</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleRule(rule)}
                        title={rule.is_active ? "Disable rule" : "Enable rule"}
                      >
                        {rule.is_active ? (
                          <Power className="w-4 h-4 text-green-600" />
                        ) : (
                          <PowerOff className="w-4 h-4 text-gray-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setRuleToDelete(rule)
                          setDeleteDialogOpen(true)
                        }}
                        className="text-destructive hover:text-destructive"
                        title="Delete rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Auto Reply Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the rule for "{ruleToDelete?.trigger_word}"?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => ruleToDelete && handleDeleteRule(ruleToDelete)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}