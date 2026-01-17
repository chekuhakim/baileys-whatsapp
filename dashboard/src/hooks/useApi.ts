import { useState, useEffect, useCallback } from 'react'
import { api, type HealthResponse, type StatusResponse, type LogsResponse } from '@/lib/api'

export function useHealth(pollInterval = 5000) {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const result = await api.getHealth()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, pollInterval)
    return () => clearInterval(interval)
  }, [fetchHealth, pollInterval])

  return { data, loading, error, refetch: fetchHealth }
}

export function useStatus(pollInterval = 5000) {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const result = await api.getStatus()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, pollInterval)
    return () => clearInterval(interval)
  }, [fetchStatus, pollInterval])

  return { data, loading, error, refetch: fetchStatus }
}

export function useLogs(limit = 100, type?: string, pollInterval = 3000) {
  const [data, setData] = useState<LogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      const result = await api.getLogs(limit, type)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }, [limit, type])

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, pollInterval)
    return () => clearInterval(interval)
  }, [fetchLogs, pollInterval])

  const clearLogs = async () => {
    await api.clearLogs()
    fetchLogs()
  }

  return { data, loading, error, refetch: fetchLogs, clearLogs }
}
