// React + Vite Example: PDF Compression with Direct Webhook Response (UPDATED)
// This shows how to integrate PDF compression where webhook returns file data directly

import { useState } from 'react'

function PDFCompressor() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleFileSelect = (event) => {
    setFile(event.target.files[0])
    setResult(null)
    setError(null)
  }

  const handleCompress = async () => {
    if (!file) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      // Create form data for PDF upload
      const formData = new FormData()
      formData.append('pdf', file)
      formData.append('webhookUrl', `${window.location.origin}/.netlify/functions/pdf-webhook`)

      const response = await fetch('https://wagateway.alphaorange.net/api/compress-pdf', {
        method: 'POST',
        headers: {
          'X-API-Key': 'wa_5e8ff9e4fedeeeef44ce2677d15a1b3941bf04a1cc0d7fd3' // Replace with your API key
        },
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        // Since we're using webhooks, the Netlify function will handle the response
        // For demo purposes, we'll show the job was accepted
        setResult({
          jobId: data.jobId,
          message: 'PDF compression started. Results will be sent to webhook.',
          status: 'processing'
        })

        // In a real app, you would typically:
        // 1. Show loading state
        // 2. Wait for webhook to call your app
        // 3. Or poll for status updates

        // For this demo, we'll simulate completion
        setTimeout(() => {
          setResult(prev => ({
            ...prev,
            message: 'Compression completed! File data received via webhook.',
            status: 'completed',
            // This would come from your webhook handler
            fileData: 'JVBERi0xLjcKJcfsj6IKNSAwIG9iago8PC9MZW5ndGggMTMgMCBSPj4Kc3RyZWFtCmJ0CjEwMCAxMDAgMjAwIDIwMCByZQo...', // Mock base64
            compressedFilename: `compressed_${file.name}`,
            compressionRatio: 45.5,
            fileSize: 123456
          }))
        }, 3000)

      } else {
        setError(data.error || 'Compression failed')
      }

    } catch (error) {
      setError(`Network error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = () => {
    if (!result || !result.fileData) return

    try {
      // Convert base64 to blob and download
      const byteCharacters = atob(result.fileData)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'application/pdf' })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.compressedFilename || 'compressed.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      alert('File downloaded successfully!')
    } catch (error) {
      alert(`Download failed: ${error.message}`)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-center">PDF Compressor</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select PDF File
        </label>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      <button
        onClick={handleCompress}
        disabled={!file || loading}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors mb-4"
      >
        {loading ? 'Processing...' : 'Compress PDF'}
      </button>

      {result && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">✅ Success!</h3>
          <p className="text-sm text-green-700 mb-2">{result.message}</p>

          {result.status === 'completed' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Job ID:</span>
                <span className="font-mono">{result.jobId}</span>
              </div>
              {result.compressionRatio && (
                <div className="flex justify-between text-sm">
                  <span>Compression:</span>
                  <span>{result.compressionRatio}% smaller</span>
                </div>
              )}
              {result.fileSize && (
                <div className="flex justify-between text-sm">
                  <span>File Size:</span>
                  <span>{(result.fileSize / 1024).toFixed(1)} KB</span>
                </div>
              )}
              <button
                onClick={downloadFile}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                📥 Download Compressed PDF
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-semibold text-red-800 mb-2">❌ Error</h3>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="text-xs text-gray-500 text-center mt-6">
        <p><strong>How it works:</strong></p>
        <ol className="text-left mt-2 space-y-1 list-decimal list-inside">
          <li>Upload PDF file</li>
          <li>File compressed using Ghostscript</li>
          <li>Compressed file sent directly to webhook</li>
          <li>Download compressed PDF immediately</li>
        </ol>
      </div>
    </div>
  )
}

export default PDFCompressor