// Netlify Function to handle PDF compression webhooks (UPDATED)
// Place this in your netlify/functions/pdf-webhook.js

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const webhookData = JSON.parse(event.body)

    console.log('Received PDF compression webhook:', webhookData)

    const { jobId, status, originalFilename, compressedFilename, compressionRatio, fileData, mimeType, error } = webhookData

    if (status === 'completed') {
      // PDF compression completed successfully
      console.log(`PDF compressed: ${originalFilename} -> ${compressionRatio}% reduction`)

      // The compressed PDF is included directly in the webhook payload
      if (fileData && mimeType === 'application/pdf') {
        console.log(`Received compressed PDF: ${compressedFilename} (${fileData.length} bytes base64)`)

        // Convert base64 to buffer
        const pdfBuffer = Buffer.from(fileData, 'base64')

        // Here you can:
        // 1. Save to Netlify blob storage
        // 2. Upload to AWS S3, Cloudinary, etc.
        // 3. Process the PDF further
        // 4. Send via email, WhatsApp, or any other service
        // 5. Return to user via API response

        // Example: Return the PDF data directly to the client
        // This allows your frontend to receive the compressed PDF immediately
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            jobId: jobId,
            originalFilename: originalFilename,
            compressedFilename: compressedFilename,
            compressionRatio: compressionRatio,
            fileData: fileData, // Base64 encoded PDF data
            mimeType: mimeType,
            fileSize: pdfBuffer.length,
            message: 'PDF compressed successfully'
          })
        }

        // Optional: Still send via WhatsApp if you want both
        /*
        if (process.env.WHATSAPP_API_KEY && process.env.USER_PHONE_NUMBER) {
          const fetch = require('node-fetch')
          const FormData = require('form-data')

          const form = new FormData()
          form.append('phoneNumber', process.env.USER_PHONE_NUMBER)
          form.append('file', pdfBuffer, {
            filename: compressedFilename,
            contentType: 'application/pdf'
          })
          form.append('caption', `Compressed PDF: ${originalFilename} (${compressionRatio}% smaller)`)

          const sendResponse = await fetch('https://wagateway.alphaorange.net/api/send-file', {
            method: 'POST',
            headers: {
              'X-API-Key': process.env.WHATSAPP_API_KEY
            },
            body: form
          })

          if (sendResponse.ok) {
            console.log('Compressed PDF sent via WhatsApp!')
          }
        }
        */

      } else {
        console.error('No file data received in webhook')
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: 'No file data received'
          })
        }
      }

    } else if (status === 'failed') {
      console.error(`PDF compression failed for job ${jobId}:`, error)

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          jobId: jobId,
          error: error,
          message: 'PDF compression failed'
        })
      }
    }

    // Default response for unhandled statuses
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Unknown webhook status'
      })
    }

  } catch (error) {
    console.error('Webhook processing error:', error)

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    }
  }
}