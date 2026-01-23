import { useState, useRef } from 'react'
import {
  Send,
  Image as ImageIcon,
  Upload,
  X,
  Loader2,
  MessageSquare
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { useStatus } from '@/hooks/useApi'
import { cn } from '@/lib/utils'

export function Messages() {
  const { data: status } = useStatus()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [message, setMessage] = useState('')
  const [caption, setCaption] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isConnected = status?.connection?.connected

  const handleSendText = async () => {
    if (!phoneNumber || !message) {
      toast.error('Please enter phone number and message')
      return
    }

    if (!isConnected) {
      toast.error('WhatsApp is not connected')
      return
    }

    setLoading(true)
    try {
      const result = await api.sendMessage(phoneNumber, message)
      if (result.success) {
        toast.success('Message sent successfully!')
        setMessage('')
      } else {
        toast.error(result.error || 'Failed to send message')
      }
    } catch {
      toast.error('Failed to connect to API')
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image must be less than 10MB')
        return
      }
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleClearImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSendImage = async () => {
    if (!phoneNumber || !selectedImage) {
      toast.error('Please enter phone number and select an image')
      return
    }

    if (!isConnected) {
      toast.error('WhatsApp is not connected')
      return
    }

    setLoading(true)
    try {
      const result = await api.sendImage(phoneNumber, selectedImage, caption)
      if (result.success) {
        toast.success('Image sent successfully!')
        handleClearImage()
        setCaption('')
      } else {
        toast.error(result.error || 'Failed to send image')
      }
    } catch {
      toast.error('Failed to connect to API')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Send Messages</h1>
        <p className="text-muted-foreground mt-1">
          Send text messages and images via WhatsApp
        </p>
      </div>

      {!isConnected && (
        <Card className="border-destructive/30 bg-destructive/5 animate-fade-in-up">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-destructive">WhatsApp Not Connected</p>
              <p className="text-sm text-muted-foreground">
                Connect your WhatsApp first to send messages
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="text" className="animate-fade-in-up stagger-1">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="text" className="gap-2">
            <Send className="w-4 h-4" />
            Text Message
          </TabsTrigger>
          <TabsTrigger value="image" className="gap-2">
            <ImageIcon className="w-4 h-4" />
            Image
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Send Text Message</CardTitle>
              <CardDescription>
                Send a text message to any WhatsApp number
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="text-phone">Phone Number</Label>
                <Input
                  id="text-phone"
                  placeholder="60123456789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Include country code without + or spaces
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length} characters
                </p>
              </div>

              <Button 
                onClick={handleSendText}
                disabled={loading || !isConnected || !phoneNumber || !message}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Message
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Send Image</CardTitle>
              <CardDescription>
                Send an image with an optional caption
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="image-phone">Phone Number</Label>
                <Input
                  id="image-phone"
                  placeholder="60123456789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label>Image</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                
                {imagePreview ? (
                  <div className="relative group">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full max-h-64 object-contain rounded-xl border bg-muted"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={handleClearImage}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs">
                      {selectedImage?.name}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "w-full h-48 border-2 border-dashed rounded-xl",
                      "flex flex-col items-center justify-center gap-2",
                      "text-muted-foreground hover:text-foreground",
                      "hover:border-primary hover:bg-primary/5",
                      "transition-all duration-200 cursor-pointer"
                    )}
                  >
                    <Upload className="w-10 h-10" />
                    <p className="font-medium">Click to upload image</p>
                    <p className="text-xs">PNG, JPG, GIF up to 10MB</p>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="caption">Caption (optional)</Label>
                <Input
                  id="caption"
                  placeholder="Add a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleSendImage}
                disabled={loading || !isConnected || !phoneNumber || !selectedImage}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4 mr-2" />
                )}
                Send Image
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
