# WhatsApp API Integration Guide

## 🚀 Overview

Your WhatsApp bot now includes a REST API that your webapp can use to send messages programmatically. The API runs on port 3001 and provides endpoints for sending text messages and images.

## 💾 Database

Logs are now persisted in **SQLite** (`logs.db`). This means:
- Logs survive bot restarts
- Can store thousands of logs without memory issues
- Fast querying with indexed columns

## 🔐 Authentication

All API endpoints (except `/health`) require an **API key**. The key is automatically generated on first run and stored in the SQLite database.

### Finding Your API Key

When you start the bot, the API key is displayed in the console:
```
🔐 API Key: wa_f9767ddda31ae273a21044ea51bf65417076ff89341d898e
   Use header: X-API-Key: wa_f9767ddda31ae273a21044ea51bf65417076ff89341d898e
```

### Providing the API Key

You can provide the API key in three ways:

1. **Header (recommended):**
   ```
   X-API-Key: wa_your_api_key_here
   ```

2. **Bearer Token:**
   ```
   Authorization: Bearer wa_your_api_key_here
   ```

3. **Query Parameter:**
   ```
   ?api_key=wa_your_api_key_here
   ```

### Example Request with API Key

```bash
curl -X POST http://localhost:3001/api/send-message \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wa_your_api_key_here" \
  -d '{"phoneNumber": "60123456789", "message": "Hello!"}'
```

### API Key Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/apikey` | GET | Get current API key |
| `/api/apikey/regenerate` | POST | Generate a new API key |

## 📋 Prerequisites

1. **Bot must be running**: `node bot.js`
2. **WhatsApp connected**: Bot shows "✅ WhatsApp connected!"
3. **API Server running**: Shows "🚀 API Server running on port 3001"

## 🔗 API Endpoints

### Base URL
```
http://localhost:3001
```

### 1. Health Check
**GET** `/health`

Check if the bot and WhatsApp are connected.

**Response:**
```json
{
  "status": "OK",
  "whatsapp_connected": true,
  "timestamp": "2024-01-17T13:00:00.000Z"
}
```

### 2. Send Text Message
**POST** `/send-message`

Send a text message to a phone number.

**Request Body:**
```json
{
  "phoneNumber": "60123456789",
  "message": "Hello from my webapp!"
}
```

**Parameters:**
- `phoneNumber`: Phone number (with or without country code)
- `message`: Text message to send

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "messageId": "ABC123...",
  "to": "60123456789@s.whatsapp.net"
}
```

### 3. Get Logs
**GET** `/logs`

Retrieve activity logs from SQLite database.

**Query Parameters:**
- `limit`: Number of logs to return (default: 100, max: 1000)
- `type`: Filter by log type (`info`, `error`, `message_in`, `message_out`, `connection`, `api`)
- `since`: Filter logs after this ISO timestamp

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "id": "1737108539123abc",
      "timestamp": "2024-01-17T13:00:00.000Z",
      "type": "message_in",
      "message": "Message from 60123456789: Hello",
      "details": { "from": "60123456789@s.whatsapp.net" }
    }
  ],
  "total": 150,
  "database": "SQLite"
}
```

### 4. Get Log Statistics
**GET** `/logs/stats`

Get log counts grouped by type.

**Response:**
```json
{
  "success": true,
  "total": 150,
  "by_type": {
    "message_in": 50,
    "message_out": 40,
    "api": 30,
    "connection": 20,
    "info": 8,
    "error": 2
  }
}
```

### 5. Clear Logs
**DELETE** `/logs`

Delete all logs from the database.

**Response:**
```json
{
  "success": true,
  "message": "Logs cleared"
}
```

### 6. Send Image Message
**POST** `/send-image`

Send an image with optional caption.

**Request:**
- **Method:** POST
- **Content-Type:** multipart/form-data
- **Form Data:**
  - `phoneNumber`: Phone number
  - `caption`: (Optional) Image caption
  - `image`: Image file (JPEG, PNG, etc.)

**Response:**
```json
{
  "success": true,
  "message": "Image sent successfully",
  "messageId": "DEF456...",
  "to": "60123456789@s.whatsapp.net"
}
```

## 🌐 Webapp Integration Examples

### JavaScript (Fetch API)

#### Send Text Message
```javascript
async function sendMessage(phoneNumber, message) {
    try {
        const response = await fetch('http://localhost:3001/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phoneNumber: phoneNumber,
                message: message
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('Message sent!', result.messageId);
        } else {
            console.error('Failed to send:', result.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Usage
sendMessage('60123456789', 'Hello from my webapp!');
```

#### Send Image Message
```javascript
async function sendImage(phoneNumber, imageFile, caption = '') {
    try {
        const formData = new FormData();
        formData.append('phoneNumber', phoneNumber);
        formData.append('image', imageFile);
        if (caption) {
            formData.append('caption', caption);
        }

        const response = await fetch('http://localhost:3001/send-image', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            console.log('Image sent!', result.messageId);
        } else {
            console.error('Failed to send:', result.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Usage with file input
const fileInput = document.getElementById('imageInput');
const imageFile = fileInput.files[0];
sendImage('60123456789', imageFile, 'Check out this image!');
```

### Python (requests)

```python
import requests

def send_message(phone_number, message):
    url = 'http://localhost:3001/send-message'
    data = {
        'phoneNumber': phone_number,
        'message': message
    }

    response = requests.post(url, json=data)
    result = response.json()

    if result['success']:
        print(f"Message sent! ID: {result['messageId']}")
        return True
    else:
        print(f"Failed: {result['error']}")
        return False

def send_image(phone_number, image_path, caption=''):
    url = 'http://localhost:3001/send-image'

    with open(image_path, 'rb') as image_file:
        files = {'image': image_file}
        data = {
            'phoneNumber': phone_number,
            'caption': caption
        }

        response = requests.post(url, files=files, data=data)
        result = response.json()

        if result['success']:
            print(f"Image sent! ID: {result['messageId']}")
            return True
        else:
            print(f"Failed: {result['error']}")
            return False

# Usage
send_message('60123456789', 'Hello from Python!')
send_image('60123456789', 'photo.jpg', 'Beautiful sunset!')
```

### PHP (cURL)

```php
function sendMessage($phoneNumber, $message) {
    $url = 'http://localhost:3001/send-message';
    $data = json_encode([
        'phoneNumber' => $phoneNumber,
        'message' => $message
    ]);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $response = curl_exec($ch);
    $result = json_decode($response, true);
    curl_close($ch);

    if ($result['success']) {
        echo "Message sent! ID: " . $result['messageId'] . "\n";
        return true;
    } else {
        echo "Failed: " . $result['error'] . "\n";
        return false;
    }
}

function sendImage($phoneNumber, $imagePath, $caption = '') {
    $url = 'http://localhost:3001/send-image';

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);

    $postData = [
        'phoneNumber' => $phoneNumber,
        'caption' => $caption,
        'image' => new CURLFile($imagePath)
    ];

    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $response = curl_exec($ch);
    $result = json_decode($response, true);
    curl_close($ch);

    if ($result['success']) {
        echo "Image sent! ID: " . $result['messageId'] . "\n";
        return true;
    } else {
        echo "Failed: " . $result['error'] . "\n";
        return false;
    }
}

// Usage
sendMessage('60123456789', 'Hello from PHP!');
sendImage('60123456789', 'photo.jpg', 'Amazing view!');
```

## 📱 Phone Number Formats

The API accepts various phone number formats:

### ✅ Valid Formats:
- `60123456789` (without +)
- `+60123456789` (with +)
- `0123456789` (local format)
- `60123456789@s.whatsapp.net` (full JID)

### ❌ Invalid Formats:
- `012-345-6789` (hyphens)
- `(012) 345-6789` (parentheses)
- `012 345 6789` (spaces)

The API automatically cleans and formats phone numbers.

## 🔧 Error Handling

### Common Error Responses:

```json
{
  "success": false,
  "error": "Phone number and message are required"
}
```

```json
{
  "success": false,
  "error": "WhatsApp not connected"
}
```

```json
{
  "success": false,
  "error": "Number is not registered on WhatsApp"
}
```

## 🚀 Production Deployment

### 1. Environment Variables
```bash
PORT=3001  # API port
```

### 2. Running the Bot
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 3. Process Management
```bash
# Using PM2
pm2 start bot.js --name whatsapp-bot
pm2 restart whatsapp-bot
pm2 logs whatsapp-bot
```

### 4. Nginx Reverse Proxy (Optional)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔒 Security Considerations

1. **Firewall**: Only allow your webapp server to access the API
2. **Authentication**: Consider adding API keys for production
3. **Rate Limiting**: Implement rate limiting on your webapp
4. **Input Validation**: Always validate phone numbers and messages
5. **HTTPS**: Use HTTPS in production

## 📊 Monitoring

Check bot status with:
```bash
curl http://localhost:3001/health
```

## 🆘 Troubleshooting

### "WhatsApp not connected"
- Ensure the bot is running and shows "✅ WhatsApp connected!"
- Check the bot logs for connection issues

### "Number is not registered on WhatsApp"
- Verify the phone number is correct
- Ensure the contact has WhatsApp installed

### "Connection refused"
- Ensure the bot is running on port 3001
- Check firewall settings

### File upload issues
- Ensure image is under 10MB
- Check supported formats (JPEG, PNG, etc.)

---

**Need help?** Check the bot logs and ensure all prerequisites are met! 🎉