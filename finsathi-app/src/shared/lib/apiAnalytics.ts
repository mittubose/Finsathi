/**
 * Local Privacy-First API Analytics & Telemetry
 * All metrics stored 100% locally in IndexedDB / localStorage.
 * Zero external network pings, zero third-party trackers.
 */

export interface ApiCallMetric {
  id: string;
  endpoint: 'ollama' | 'mcp_sync' | 'ocr_tesseract' | 'ocr_pdf';
  target: string;
  durationMs: number;
  status: 'success' | 'fallback' | 'error';
  timestamp: string;
  payloadSize?: number;
}

export interface AnalyticsSummary {
  totalCalls: number;
  avgLatencyMs: number;
  successRatePct: number;
  fallbackCount: number;
  errorCount: number;
  callsByEndpoint: Record<string, number>;
  recentCalls: ApiCallMetric[];
}

const STORAGE_KEY = 'finsathi_api_analytics_v1';
const MAX_RECORD_HISTORY = 100;

export function recordApiCall(metric: Omit<ApiCallMetric, 'id' | 'timestamp'>): void {
  try {
    const existing = getStoredMetrics();
    const entry: ApiCallMetric = {
      ...metric,
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    const updated = [entry, ...existing].slice(0, MAX_RECORD_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[Analytics] Failed to save telemetry metric:', err);
  }
}

export function getStoredMetrics(): ApiCallMetric[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getAnalyticsSummary(): AnalyticsSummary {
  const metrics = getStoredMetrics();
  if (metrics.length === 0) {
    return {
      totalCalls: 0,
      avgLatencyMs: 0,
      successRatePct: 100,
      fallbackCount: 0,
      errorCount: 0,
      callsByEndpoint: {},
      recentCalls: [],
    };
  }

  const totalCalls = metrics.length;
  const totalDuration = metrics.reduce((sum, m) => sum + m.durationMs, 0);
  const avgLatencyMs = Math.round(totalDuration / totalCalls);

  const successCount = metrics.filter((m) => m.status === 'success').length;
  const fallbackCount = metrics.filter((m) => m.status === 'fallback').length;
  const errorCount = metrics.filter((m) => m.status === 'error').length;
  const successRatePct = Math.round(((successCount + fallbackCount) / totalCalls) * 100);

  const callsByEndpoint: Record<string, number> = {};
  for (const m of metrics) {
    callsByEndpoint[m.endpoint] = (callsByEndpoint[m.endpoint] || 0) + 1;
  }

  return {
    totalCalls,
    avgLatencyMs,
    successRatePct,
    fallbackCount,
    errorCount,
    callsByEndpoint,
    recentCalls: metrics.slice(0, 10),
  };
}

export function clearAnalytics(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[Analytics] Failed to clear metrics:', err);
  }
}
