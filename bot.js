const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

// Initialize SQLite database for logs and config
const dbPath = process.env.NODE_ENV === 'production' ? '/app/data/logs.db' : 'logs.db'
const db = new Database(dbPath)

// Create tables if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT UNIQUE NOT NULL,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);

    CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auto_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trigger_word TEXT UNIQUE NOT NULL,
        reply_message TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pdf_compression_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT UNIQUE NOT NULL,
        webhook_url TEXT NOT NULL,
        original_filename TEXT,
        compressed_filename TEXT,
        status TEXT DEFAULT 'processing', -- processing, completed, failed
        original_size INTEGER,
        compressed_size INTEGER,
        compression_ratio REAL,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
    );
`)

// API Key Management
function getOrCreateApiKey() {
    const stmt = db.prepare('SELECT value FROM config WHERE key = ?')
    const row = stmt.get('api_key')
    
    if (row) {
        return row.value
    }
    
    // Generate new API key
    const apiKey = 'wa_' + crypto.randomBytes(24).toString('hex')
    const insert = db.prepare('INSERT INTO config (key, value) VALUES (?, ?)')
    insert.run('api_key', apiKey)
    
    console.log('🔑 Generated new API key:', apiKey)
    return apiKey
}

function updateApiKey(newKey) {
    const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
    stmt.run('api_key', newKey)
    API_KEY = newKey
    return newKey
}

function regenerateApiKey() {
    const newKey = 'wa_' + crypto.randomBytes(24).toString('hex')
    return updateApiKey(newKey)
}

// Initialize API key
let API_KEY = getOrCreateApiKey()

// Initialize default auto-reply rules
function initializeAutoReplies() {
    const defaultReplies = [
        { trigger_word: 'bong', reply_message: 'bing' },
        { trigger_word: 'hello', reply_message: 'Hi there! 👋' },
        { trigger_word: 'ping', reply_message: 'pong 🏓' }
    ]

    const checkExisting = db.prepare('SELECT COUNT(*) as count FROM auto_replies')
    if (checkExisting.get().count === 0) {
        const insertReply = db.prepare('INSERT OR IGNORE INTO auto_replies (trigger_word, reply_message) VALUES (?, ?)')
        for (const reply of defaultReplies) {
            insertReply.run(reply.trigger_word, reply.reply_message)
        }
        console.log('📝 Initialized default auto-reply rules')
    }
}

// Call initialization
initializeAutoReplies()

// Prepared statements for better performance
const insertLog = db.prepare(`
    INSERT INTO logs (uid, timestamp, type, message, details) 
    VALUES (?, ?, ?, ?, ?)
`)

const getLogs = db.prepare(`
    SELECT uid as id, timestamp, type, message, details 
    FROM logs 
    ORDER BY timestamp DESC 
    LIMIT ?
`)

const getLogsByType = db.prepare(`
    SELECT uid as id, timestamp, type, message, details 
    FROM logs 
    WHERE type = ?
    ORDER BY timestamp DESC 
    LIMIT ?
`)

const getLogsSince = db.prepare(`
    SELECT uid as id, timestamp, type, message, details 
    FROM logs 
    WHERE timestamp > ?
    ORDER BY timestamp DESC 
    LIMIT ?
`)

const getLogsByTypeAndSince = db.prepare(`
    SELECT uid as id, timestamp, type, message, details 
    FROM logs 
    WHERE type = ? AND timestamp > ?
    ORDER BY timestamp DESC 
    LIMIT ?
`)

const countLogs = db.prepare(`SELECT COUNT(*) as total FROM logs`)
const countLogsByType = db.prepare(`SELECT COUNT(*) as total FROM logs WHERE type = ?`)

const clearAllLogs = db.prepare(`DELETE FROM logs`)

const getLogStats = db.prepare(`
    SELECT type, COUNT(*) as count 
    FROM logs 
    GROUP BY type
`)

// Global socket variable to access from API endpoints
let globalSock = null
let connectionStatus = 'disconnected'
let connectedNumber = null

// Log helper function - now saves to SQLite
function addLog(type, message, details = {}) {
    const uid = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    const timestamp = new Date().toISOString()
    const detailsJson = JSON.stringify(details)
    
    try {
        insertLog.run(uid, timestamp, type, message, detailsJson)
    } catch (err) {
        console.error('Failed to save log to database:', err.message)
    }
    
    // Also log to console
    const emoji = {
        'info': 'ℹ️',
        'error': '❌',
        'message_in': '📨',
        'message_out': '📤',
        'connection': '🔗',
        'api': '🌐'
    }[type] || '📝'
    console.log(`${emoji} [${type.toUpperCase()}] ${message}`)
    
    return { id: uid, timestamp, type, message, details }
}

// Express API Server Setup
const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Multer setup for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
})

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads')
}

// API Key Authentication Middleware
function authenticateApiKey(req, res, next) {
    // Get API key from header or query parameter
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.api_key
    
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'API key required. Provide via X-API-Key header, Authorization: Bearer <key>, or ?api_key=<key>'
        })
    }
    
    if (apiKey !== API_KEY) {
        addLog('error', 'Invalid API key attempt', { 
            ip: req.ip,
            path: req.path 
        })
        return res.status(403).json({
            success: false,
            error: 'Invalid API key'
        })
    }
    
    next()
}

// Public endpoints (no auth required)
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        whatsapp_connected: connectionStatus === 'open',
        connection_status: connectionStatus,
        timestamp: new Date().toISOString(),
        auth_required: true
    })
})

// Protected endpoints (auth required)
app.use('/api', authenticateApiKey)

// Get detailed connection status
app.get('/api/status', (req, res) => {
    addLog('api', 'Status requested')
    
    const totalLogs = countLogs.get().total
    const stats = getLogStats.all()
    const logsByType = {}
    stats.forEach(s => { logsByType[s.type] = s.count })
    
    res.json({
        success: true,
        connection: {
            status: connectionStatus,
            connected: connectionStatus === 'open',
            number: connectedNumber,
            registered: globalSock?.authState?.creds?.registered || false
        },
        stats: {
            logs_count: totalLogs,
            logs_by_type: logsByType,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            database: 'SQLite'
        }
    })
})

// Get logs with pagination and filtering
app.get('/api/logs', (req, res) => {
    const { limit = 100, type, since, offset = 0 } = req.query
    const limitNum = Math.min(parseInt(limit) || 100, 1000)
    
    let logs = []
    let total = 0
    
    try {
        if (type && since) {
            logs = getLogsByTypeAndSince.all(type, since, limitNum)
            total = countLogsByType.get(type).total
        } else if (type) {
            logs = getLogsByType.all(type, limitNum)
            total = countLogsByType.get(type).total
        } else if (since) {
            logs = getLogsSince.all(since, limitNum)
            total = countLogs.get().total
        } else {
            logs = getLogs.all(limitNum)
            total = countLogs.get().total
        }
        
        // Parse details JSON for each log
        logs = logs.map(log => ({
            ...log,
            details: JSON.parse(log.details || '{}')
        }))
        
        res.json({
            success: true,
            logs,
            total,
            limit: limitNum,
            database: 'SQLite'
        })
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        })
    }
})

// Get log statistics
app.get('/api/logs/stats', (req, res) => {
    try {
        const total = countLogs.get().total
        const byType = getLogStats.all()
        const stats = {}
        byType.forEach(s => { stats[s.type] = s.count })
        
        res.json({
            success: true,
            total,
            by_type: stats
        })
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        })
    }
})

// Clear logs
app.delete('/api/logs', (req, res) => {
    try {
        clearAllLogs.run()
        addLog('info', 'All logs cleared')
        res.json({ success: true, message: 'Logs cleared' })
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        })
    }
})

// Request pairing code for new number
app.post('/api/request-pairing', async (req, res) => {
    try {
        const { phoneNumber } = req.body

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            })
        }

        // Format phone number (remove + and non-digits)
        let formattedNumber = phoneNumber.replace(/\D/g, '') // Remove non-digits

        addLog('api', `Requesting pairing code for: ${formattedNumber}`)

        // If no socket exists, initialize WhatsApp first
        if (!globalSock) {
            addLog('connection', 'Initializing WhatsApp for pairing...')
            await initWhatsAppForPairing()
            
            // Wait for socket to be ready
            let attempts = 0
            while (!globalSock && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 500))
                attempts++
            }
            
            if (!globalSock) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to initialize WhatsApp connection'
                })
            }
        }

        // Wait a bit for the socket to be fully ready
        await new Promise(resolve => setTimeout(resolve, 2000))

        const pairingCode = await globalSock.requestPairingCode(formattedNumber)

        addLog('connection', `Pairing code generated: ${pairingCode}`, { phoneNumber: formattedNumber })

        res.json({
            success: true,
            pairingCode: pairingCode,
            phoneNumber: formattedNumber
        })

    } catch (error) {
        addLog('error', `Error requesting pairing code: ${error.message}`)
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to request pairing code'
        })
    }
})

// Disconnect current session
app.post('/api/disconnect', async (req, res) => {
    try {
        if (globalSock) {
            addLog('connection', 'Disconnecting WhatsApp session')
            await globalSock.logout()
            globalSock = null
            connectionStatus = 'disconnected'
            connectedNumber = null
            res.json({ success: true, message: 'Disconnected successfully' })
        } else {
            res.json({ success: false, error: 'No active connection' })
        }
    } catch (error) {
        addLog('error', `Error disconnecting: ${error.message}`)
        res.status(500).json({ success: false, error: error.message })
    }
})

// Reconnect
app.post('/api/reconnect', async (req, res) => {
    try {
        addLog('connection', 'Reconnection requested')
        if (globalSock) {
            globalSock.end()
            globalSock = null
        }
        connectionStatus = 'connecting'
        connectToWhatsApp()
        res.json({ success: true, message: 'Reconnection initiated' })
    } catch (error) {
        addLog('error', `Error reconnecting: ${error.message}`)
        res.status(500).json({ success: false, error: error.message })
    }
})

// Reset auth (clear session files)
app.post('/api/reset-auth', async (req, res) => {
    try {
        addLog('connection', 'Auth reset requested')
        
        // Disconnect first
        if (globalSock) {
            try {
                await globalSock.logout()
            } catch (e) {
                // Ignore logout errors
            }
            globalSock = null
        }
        
        connectionStatus = 'disconnected'
        connectedNumber = null
        
        // Delete auth folder
        const authFolder = 'auth_info_baileys'
        if (fs.existsSync(authFolder)) {
            fs.rmSync(authFolder, { recursive: true, force: true })
            addLog('info', 'Auth folder deleted')
        }
        
        res.json({ success: true, message: 'Auth reset. Restart the bot to connect a new number.' })
    } catch (error) {
        addLog('error', `Error resetting auth: ${error.message}`)
        res.status(500).json({ success: false, error: error.message })
    }
})

// Send text message
app.post('/api/send-message', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body

        if (!phoneNumber || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone number and message are required'
            })
        }

        if (!globalSock) {
            return res.status(500).json({
                success: false,
                error: 'WhatsApp not connected'
            })
        }

        // Format phone number (remove + and ensure it has @s.whatsapp.net)
        let formattedNumber = phoneNumber.replace(/\D/g, '') // Remove non-digits
        if (!formattedNumber.includes('@s.whatsapp.net')) {
            formattedNumber = `${formattedNumber}@s.whatsapp.net`
        }

        // Send message
        const result = await globalSock.sendMessage(formattedNumber, { text: message })

        addLog('message_out', `Message sent to ${phoneNumber}`, { 
            to: formattedNumber, 
            messageId: result?.key?.id,
            preview: message.substring(0, 50)
        })

        res.json({
            success: true,
            message: 'Message sent successfully',
            messageId: result?.key?.id,
            to: formattedNumber
        })

    } catch (error) {
        addLog('error', `Error sending message: ${error.message}`)
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// Send file (supports images, documents, videos, audio, etc.)
app.post('/api/send-file', upload.single('file'), async (req, res) => {
    try {
        const { phoneNumber, caption } = req.body
        const uploadedFile = req.file

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            })
        }

        if (!uploadedFile) {
            return res.status(400).json({
                success: false,
                error: 'File is required'
            })
        }

        if (!globalSock) {
            return res.status(500).json({
                success: false,
                error: 'WhatsApp not connected'
            })
        }

        // Format phone number
        let formattedNumber = phoneNumber.replace(/\D/g, '')
        if (!formattedNumber.includes('@s.whatsapp.net')) {
            formattedNumber = `${formattedNumber}@s.whatsapp.net`
        }

        // Read file
        const fileBuffer = fs.readFileSync(uploadedFile.path)
        const fileName = uploadedFile.originalname
        const mimeType = uploadedFile.mimetype

        // Determine message type based on MIME type
        let messageData = {}
        let fileType = 'document'

        if (mimeType.startsWith('image/')) {
            // Images
            messageData = {
                image: fileBuffer,
                caption: caption || '',
                mimetype: mimeType
            }
            fileType = 'image'
        } else if (mimeType.startsWith('video/')) {
            // Videos
            messageData = {
                video: fileBuffer,
                caption: caption || '',
                mimetype: mimeType
            }
            fileType = 'video'
        } else if (mimeType.startsWith('audio/')) {
            // Audio files
            messageData = {
                audio: fileBuffer,
                mimetype: mimeType
            }
            fileType = 'audio'
        } else {
            // Documents (PDF, DOC, TXT, etc.)
            messageData = {
                document: fileBuffer,
                mimetype: mimeType,
                fileName: fileName,
                caption: caption || ''
            }
            fileType = 'document'
        }

        // Send file
        const result = await globalSock.sendMessage(formattedNumber, messageData)

        // Clean up uploaded file
        fs.unlinkSync(uploadedFile.path)

        addLog('message_out', `${fileType} sent to ${phoneNumber}`, {
            to: formattedNumber,
            messageId: result?.key?.id,
            fileName: fileName,
            fileType: fileType,
            mimeType: mimeType,
            caption: caption || '(no caption)'
        })

        res.json({
            success: true,
            message: `${fileType} sent successfully`,
            messageId: result?.key?.id,
            to: formattedNumber,
            fileType: fileType,
            fileName: fileName
        })

    } catch (error) {
        addLog('error', `Error sending file: ${error.message}`)

        // Clean up file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path)
        }

        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// Keep the old send-image endpoint for backward compatibility
app.post('/api/send-image', upload.single('image'), async (req, res) => {
    try {
        const { phoneNumber, caption } = req.body
        const imageFile = req.file

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            })
        }

        if (!imageFile) {
            return res.status(400).json({
                success: false,
                error: 'Image file is required'
            })
        }

        if (!globalSock) {
            return res.status(500).json({
                success: false,
                error: 'WhatsApp not connected'
            })
        }

        // Format phone number
        let formattedNumber = phoneNumber.replace(/\D/g, '')
        if (!formattedNumber.includes('@s.whatsapp.net')) {
            formattedNumber = `${formattedNumber}@s.whatsapp.net`
        }

        // Read image file
        const imageBuffer = fs.readFileSync(imageFile.path)

        // Send image
        const result = await globalSock.sendMessage(formattedNumber, {
            image: imageBuffer,
            caption: caption || ''
        })

        // Clean up uploaded file
        fs.unlinkSync(imageFile.path)

        addLog('message_out', `Image sent to ${phoneNumber}`, {
            to: formattedNumber,
            messageId: result?.key?.id,
            caption: caption || '(no caption)'
        })

        res.json({
            success: true,
            message: 'Image sent successfully',
            messageId: result?.key?.id,
            to: formattedNumber
        })

    } catch (error) {
        addLog('error', `Error sending image: ${error.message}`)

        // Clean up file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path)
        }

        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// API Key Management endpoints
app.get('/api/apikey', (req, res) => {
    // Return masked API key
    const masked = API_KEY.substring(0, 6) + '...' + API_KEY.substring(API_KEY.length - 4)
    res.json({
        success: true,
        api_key: API_KEY,
        masked: masked
    })
})

app.post('/api/apikey/regenerate', (req, res) => {
    const newKey = regenerateApiKey()
    addLog('info', 'API key regenerated')
    res.json({
        success: true,
        api_key: newKey,
        message: 'API key regenerated. Update your applications with the new key.'
    })
})

// Auto-Reply Management endpoints
app.get('/api/auto-replies', (req, res) => {
    try {
        const getReplies = db.prepare('SELECT id, trigger_word, reply_message, is_active, created_at, updated_at FROM auto_replies ORDER BY created_at DESC')
        const replies = getReplies.all()
        res.json({
            success: true,
            auto_replies: replies
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

app.post('/api/auto-replies', (req, res) => {
    try {
        const { trigger_word, reply_message } = req.body

        if (!trigger_word || !reply_message) {
            return res.status(400).json({
                success: false,
                error: 'Both trigger_word and reply_message are required'
            })
        }

        const insertReply = db.prepare('INSERT INTO auto_replies (trigger_word, reply_message) VALUES (?, ?)')
        const result = insertReply.run(trigger_word, reply_message)

        addLog('info', `Auto-reply rule added: "${trigger_word}" -> "${reply_message}"`)

        res.json({
            success: true,
            message: 'Auto-reply rule added successfully',
            id: result.lastInsertRowid
        })
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            res.status(400).json({
                success: false,
                error: 'Trigger word already exists'
            })
        } else {
            res.status(500).json({
                success: false,
                error: error.message
            })
        }
    }
})

app.delete('/api/auto-replies/:id', (req, res) => {
    try {
        const { id } = req.params
        const deleteReply = db.prepare('DELETE FROM auto_replies WHERE id = ?')
        const result = deleteReply.run(id)

        if (result.changes > 0) {
            addLog('info', `Auto-reply rule deleted: ID ${id}`)
            res.json({
                success: true,
                message: 'Auto-reply rule deleted successfully'
            })
        } else {
            res.status(404).json({
                success: false,
                error: 'Auto-reply rule not found'
            })
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

app.put('/api/auto-replies/:id/toggle', (req, res) => {
    try {
        const { id } = req.params
        const toggleReply = db.prepare('UPDATE auto_replies SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        const result = toggleReply.run(id)

        if (result.changes > 0) {
            addLog('info', `Auto-reply rule toggled: ID ${id}`)
            res.json({
                success: true,
                message: 'Auto-reply rule status updated'
            })
        } else {
            res.status(404).json({
                success: false,
                error: 'Auto-reply rule not found'
            })
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// Legacy endpoints (redirect to /api/ with auth) - for backward compatibility
// These will require API key now
app.get('/status', authenticateApiKey, (req, res) => res.redirect(307, '/api/status'))
app.get('/logs', authenticateApiKey, (req, res) => res.redirect(307, '/api/logs'))
app.get('/logs/stats', authenticateApiKey, (req, res) => res.redirect(307, '/api/logs/stats'))
app.delete('/logs', authenticateApiKey, (req, res) => res.redirect(307, '/api/logs'))
app.post('/request-pairing', authenticateApiKey, (req, res) => res.redirect(307, '/api/request-pairing'))
app.post('/disconnect', authenticateApiKey, (req, res) => res.redirect(307, '/api/disconnect'))
app.post('/reconnect', authenticateApiKey, (req, res) => res.redirect(307, '/api/reconnect'))
app.post('/reset-auth', authenticateApiKey, (req, res) => res.redirect(307, '/api/reset-auth'))
app.post('/send-message', authenticateApiKey, (req, res) => res.redirect(307, '/api/send-message'))
app.post('/send-image', authenticateApiKey, (req, res) => res.redirect(307, '/api/send-image'))

// Serve static dashboard files (production)
const dashboardPath = path.join(__dirname, 'dashboard', 'dist')
if (fs.existsSync(dashboardPath)) {
    app.use(express.static(dashboardPath))
    
    // SPA catch-all route - serve index.html for any non-API routes
    app.get('/{*splat}', (req, res) => {
        // Don't catch API routes
        if (req.path.startsWith('/api') || req.path === '/health') {
            return res.status(404).json({ error: 'Not found' })
        }
        res.sendFile(path.join(dashboardPath, 'index.html'))
    })
    
    console.log('🌐 Dashboard served from /dashboard/dist')
}

// Start API Server
app.listen(PORT, () => {
    addLog('info', `API Server running on port ${PORT}`)
    console.log(`🚀 API Server running on port ${PORT}`)
    console.log(`📡 Health check: http://localhost:${PORT}/health`)
    console.log(`📊 Dashboard API ready`)
    console.log(`💾 Logs stored in SQLite database: logs.db`)
    console.log(`🔐 API Key: ${API_KEY}`)
    console.log(`   Use header: X-API-Key: ${API_KEY}`)
})

// Initialize WhatsApp for pairing (without auto-requesting code)
async function initWhatsAppForPairing() {
    // Load auth state from files
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')

    // Create WhatsApp socket
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: require('pino')({ level: 'silent' })
    })

    // Store socket globally
    globalSock = sock
    connectionStatus = 'connecting'

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'close') {
            connectionStatus = 'disconnected'
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true

            if (shouldReconnect) {
                addLog('connection', 'Connection closed, reconnecting...')
                globalSock = null
                setTimeout(() => connectToWhatsApp(), 5000)
            } else {
                addLog('connection', 'Connection logged out')
                globalSock = null
            }
        } else if (connection === 'connecting') {
            connectionStatus = 'connecting'
            addLog('connection', 'Connecting to WhatsApp...')
        } else if (connection === 'open') {
            connectionStatus = 'open'
            connectedNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0] || null
            addLog('connection', `WhatsApp connected! Number: ${connectedNumber}`)
            console.log('✅ WhatsApp connected!')
            console.log(`📡 API ready at http://localhost:${PORT}`)
        }
    })

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds)

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue

            const sender = msg.key.remoteJid
            const messageType = Object.keys(msg.message)[0]

            let messageContent = ''
            if (messageType === 'conversation') {
                messageContent = msg.message.conversation
            } else if (messageType === 'extendedTextMessage') {
                messageContent = msg.message.extendedTextMessage.text
            } else if (messageType === 'imageMessage') {
                messageContent = msg.message.imageMessage.caption || '[Image]'
            }

            addLog('message_in', `Message from ${sender}: ${messageContent}`, {
                from: sender,
                type: messageType,
                content: messageContent
            })

            // AUTO-REPLY LOGIC
            if (messageContent.toLowerCase() === 'bong') {
                await sock.sendMessage(sender, { text: 'bing' })
                addLog('message_out', 'Auto-replied: bing', { to: sender })
            } else if (messageContent.toLowerCase() === 'hello') {
                await sock.sendMessage(sender, { text: 'Hi there! 👋' })
                addLog('message_out', 'Auto-replied: Hi there!', { to: sender })
            } else if (messageContent.toLowerCase() === 'ping') {
                await sock.sendMessage(sender, { text: 'pong 🏓' })
                addLog('message_out', 'Auto-replied: pong', { to: sender })
            }
        }
    })

    return sock
}

async function connectToWhatsApp() {
    // Load auth state from files
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')

    // Create WhatsApp socket
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Disable QR for pairing code
        logger: require('pino')({ level: 'silent' })
    })

    // Store socket globally for API access
    globalSock = sock

    // Handle connection updates first
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'close') {
            connectionStatus = 'disconnected'
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true

            if (shouldReconnect) {
                addLog('connection', 'Connection closed, reconnecting...')
                globalSock = null // Clear global socket
                setTimeout(() => connectToWhatsApp(), 5000)
            } else {
                addLog('connection', 'Connection logged out')
                globalSock = null // Clear global socket
            }
        } else if (connection === 'connecting') {
            connectionStatus = 'connecting'
            addLog('connection', 'Connecting to WhatsApp...')
        } else if (connection === 'open') {
            connectionStatus = 'open'
            // Get connected phone number
            connectedNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0] || null
            addLog('connection', `WhatsApp connected! Number: ${connectedNumber}`)
            console.log('✅ WhatsApp connected!')
            console.log(`📡 API ready at http://localhost:${PORT}`)
        }
    })

    // If already registered, just connect. Otherwise wait for user to request pairing via dashboard
    if (!sock.authState.creds.registered) {
        addLog('connection', 'WhatsApp not registered. Please enter your phone number in the dashboard to get a pairing code.')
        console.log('📱 WhatsApp not registered. Use the dashboard to enter your phone number and get a pairing code.')
    }

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds)

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue

            const sender = msg.key.remoteJid
            const messageType = Object.keys(msg.message)[0]

            // Get message content
            let messageContent = ''
            if (messageType === 'conversation') {
                messageContent = msg.message.conversation
            } else if (messageType === 'extendedTextMessage') {
                messageContent = msg.message.extendedTextMessage.text
            } else if (messageType === 'imageMessage') {
                messageContent = msg.message.imageMessage.caption || '[Image]'
            }

            addLog('message_in', `Message from ${sender}: ${messageContent}`, {
                from: sender,
                type: messageType,
                content: messageContent
            })

            // AUTO-REPLY LOGIC - Now uses database rules
            const getActiveReplies = db.prepare('SELECT trigger_word, reply_message FROM auto_replies WHERE is_active = 1')
            const activeReplies = getActiveReplies.all()

            // Check if message matches any trigger word
            for (const reply of activeReplies) {
                if (messageContent.toLowerCase().includes(reply.trigger_word.toLowerCase())) {
                    await sock.sendMessage(sender, {
                        text: reply.reply_message
                    })
                    addLog('message_out', `Auto-replied: ${reply.reply_message}`, {
                        to: sender,
                        trigger: reply.trigger_word
                    })
                    break // Only reply to first matching rule
                }
            }
        }
    })

    return sock
}

// Start the bot - check if there's existing auth first
async function startBot() {
    const authPath = process.env.NODE_ENV === 'production' ? '/app/auth_info_baileys' : 'auth_info_baileys'
    const credsFile = require('path').join(authPath, 'creds.json')
    
    // Check if there's an existing session
    if (require('fs').existsSync(credsFile)) {
        try {
            const creds = JSON.parse(require('fs').readFileSync(credsFile, 'utf-8'))
            if (creds.registered) {
                console.log('📱 Found existing session, connecting...')
                addLog('connection', 'Found existing session, connecting...')
                await connectToWhatsApp()
                return
            }
        } catch (e) {
            // Invalid creds file, continue without connecting
        }
    }
    
    // No valid session - wait for user to request pairing from dashboard
    console.log('📱 No existing session. Please use the dashboard to enter your phone number and get a pairing code.')
    addLog('connection', 'No existing session. Waiting for user to request pairing code from dashboard.')
}

startBot().catch(console.error)

// PDF Compression function
async function compressPdfAsync(jobId, inputPath, originalFilename) {
    const outputFilename = `compressed_${Date.now()}_${originalFilename}`
    const outputPath = path.join('uploads', outputFilename)

    try {
        // Ghostscript command for PDF compression
        // -sDEVICE=pdfwrite: output as PDF
        // -dCompatibilityLevel=1.4: PDF version
        // -dPDFSETTINGS=/ebook: compression preset (can be /screen, /ebook, /prepress, /printer)
        // -dNOPAUSE -dQUIET -dBATCH: batch processing
        const gsCommand = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${outputPath} ${inputPath}`

        addLog('info', `Starting PDF compression for job ${jobId}`)

        const { stdout, stderr } = await execAsync(gsCommand)

        // Check if output file was created
        if (!fs.existsSync(outputPath)) {
            throw new Error('Compressed PDF was not created')
        }

        // Get file sizes
        const originalStats = fs.statSync(inputPath)
        const compressedStats = fs.statSync(outputPath)

        const compressionRatio = ((originalStats.size - compressedStats.size) / originalStats.size * 100).toFixed(2)

        // Update job record
        const updateJob = db.prepare(`
            UPDATE pdf_compression_jobs
            SET status = 'completed',
                compressed_filename = ?,
                compressed_size = ?,
                compression_ratio = ?,
                completed_at = CURRENT_TIMESTAMP
            WHERE job_id = ?
        `)
        updateJob.run(outputFilename, compressedStats.size, compressionRatio, jobId)

        // Clean up original file
        fs.unlinkSync(inputPath)

        // Send webhook
        const getJob = db.prepare('SELECT * FROM pdf_compression_jobs WHERE job_id = ?')
        const job = getJob.get(jobId)

        // Read compressed file and send in webhook
        const compressedFilePath = path.join('uploads', outputFilename)
        const compressedFileData = fs.readFileSync(compressedFilePath)
        const base64Data = compressedFileData.toString('base64')

        // Send webhook with file data directly
        const webhookPayload = {
            jobId: job.job_id,
            status: 'completed',
            originalFilename: job.original_filename,
            compressedFilename: outputFilename,
            originalSize: job.original_size,
            compressedSize: job.compressed_size,
            compressionRatio: parseFloat(job.compression_ratio),
            fileData: base64Data,
            mimeType: 'application/pdf',
            completedAt: job.completed_at
        }

        // Send webhook
        try {
            const webhookResponse = await fetch(job.webhook_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'WhatsApp-PDF-Compressor/1.0'
                },
                body: JSON.stringify(webhookPayload)
            })

            if (webhookResponse.ok) {
                addLog('info', `Webhook sent successfully for job ${jobId}`)
            } else {
                addLog('error', `Webhook failed for job ${jobId}: ${webhookResponse.status}`)
            }
        } catch (webhookError) {
            addLog('error', `Webhook error for job ${jobId}: ${webhookError.message}`)
        }

        addLog('info', `PDF compression completed for job ${jobId}: ${compressionRatio}% reduction`)

    } catch (error) {
        addLog('error', `PDF compression failed for job ${jobId}: ${error.message}`)

        // Update job record with error
        const updateJobError = db.prepare(`
            UPDATE pdf_compression_jobs
            SET status = 'failed',
                error_message = ?,
                completed_at = CURRENT_TIMESTAMP
            WHERE job_id = ?
        `)
        updateJobError.run(error.message, jobId)

        // Clean up files
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath)
        }
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath)
        }

        // Send error webhook
        try {
            const getJob = db.prepare('SELECT webhook_url FROM pdf_compression_jobs WHERE job_id = ?')
            const job = getJob.get(jobId)

            if (job) {
                const errorPayload = {
                    jobId: jobId,
                    status: 'failed',
                    error: error.message
                }

                await fetch(job.webhook_url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'WhatsApp-PDF-Compressor/1.0'
                    },
                    body: JSON.stringify(errorPayload)
                })
            }
        } catch (webhookError) {
            addLog('error', `Error webhook failed for job ${jobId}: ${webhookError.message}`)
        }
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    addLog('info', 'Shutting down gracefully...')
    console.log('Shutting down gracefully...')
    db.close()
    process.exit(0)
})

process.on('SIGTERM', () => {
    addLog('info', 'Received SIGTERM, shutting down...')
    db.close()
    process.exit(0)
})
