#!/usr/bin/env node
/**
 * FinSathi Automated Error Auditor & Improvement Plan Generator
 * Runs as a periodic cron job to audit runtime errors and generate diagnostic plans.
 *
 * Usage:
 *   node server/cron-error-auditor.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const ERROR_LOG_FILE = path.join(DATA_DIR, 'errors.jsonl');
const PLAN_JSON_FILE = path.join(DATA_DIR, 'improvement_plan.json');
const PLAN_MD_FILE = path.join(DATA_DIR, 'improvement_plan.md');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function runErrorAudit() {
  const timestamp = new Date().toISOString();
  let errors = [];

  if (fs.existsSync(ERROR_LOG_FILE)) {
    try {
      const content = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
      errors = content
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(Boolean);
    } catch (err) {
      console.error('[Cron Auditor] Failed to read errors.jsonl:', err.message);
    }
  }

  // 1. Group & Analyze Errors
  const now = Date.now();
  const last24h = errors.filter(e => now - new Date(e.timestamp || 0).getTime() <= 24 * 3600 * 1000);
  const last7d = errors.filter(e => now - new Date(e.timestamp || 0).getTime() <= 7 * 24 * 3600 * 1000);

  const bySeverity = { fatal: 0, error: 0, warn: 0 };
  const byComponent = {};
  const signatureMap = {};

  for (const err of errors) {
    const lvl = err.level || 'error';
    if (bySeverity[lvl] !== undefined) bySeverity[lvl]++;
    
    const comp = err.component || 'Unknown';
    byComponent[comp] = (byComponent[comp] || 0) + 1;

    // Normalize signature (first 60 chars of message)
    const sigKey = `${comp}::${(err.message || 'Unknown').slice(0, 60)}`;
    if (!signatureMap[sigKey]) {
      signatureMap[sigKey] = {
        component: comp,
        message: err.message || 'Unknown',
        sampleStack: err.stack,
        count: 0,
        firstSeen: err.timestamp,
        lastSeen: err.timestamp,
        level: lvl,
      };
    }
    signatureMap[sigKey].count++;
    signatureMap[sigKey].lastSeen = err.timestamp;
  }

  const topSignatures = Object.values(signatureMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 2. Compute Health Score
  // Base 100%, deduct 5% per fatal in 24h, 1% per error in 24h, 0.2% per warn
  const deduction = (last24h.filter(e => e.level === 'fatal').length * 5) +
                    (last24h.filter(e => e.level === 'error').length * 1) +
                    (last24h.filter(e => e.level === 'warn').length * 0.2);
  const healthScore = Math.max(70, Math.min(100, Math.round((100 - deduction) * 10) / 10));

  // 3. Generate Actionable Improvement Items
  const improvementItems = [];

  if (byComponent['ReactErrorBoundary'] || bySeverity.fatal > 0) {
    improvementItems.push({
      id: 'imp_react_crashes',
      priority: 'HIGH',
      category: 'UI Resiliency',
      issue: 'React Component Render Crashes Detected',
      recommendation: 'Add granular try/catch blocks and null checks around dynamic widget state bindings.',
      status: 'NEEDS_ATTENTION',
    });
  }

  if (byComponent['Database'] || byComponent['IndexedDB'] || errors.some(e => /quota|version|transaction/i.test(e.message))) {
    improvementItems.push({
      id: 'imp_db_storage',
      priority: 'MEDIUM',
      category: 'Storage',
      issue: 'IndexedDB Schema Migration or Storage Warnings',
      recommendation: 'Verify versioning.ts schema migrations and run automated data compaction for older profiles.',
      status: 'SCHEDULED',
    });
  }

  if (byComponent['SyncDaemon'] || errors.some(e => /fetch|network|econnrefused|timeout/i.test(e.message))) {
    improvementItems.push({
      id: 'imp_network_sync',
      priority: 'MEDIUM',
      category: 'Connectivity',
      issue: 'Intermittent LAN / Sync Daemon Reachability',
      recommendation: 'Ensure port 3001 daemon is enabled as a background service via start-host.sh or systemd.',
      status: 'ACTIONABLE',
    });
  }

  if (byComponent['McpTool'] || errors.some(e => /mcp|tool/i.test(e.message))) {
    improvementItems.push({
      id: 'imp_mcp_validation',
      priority: 'LOW',
      category: 'Local AI',
      issue: 'MCP Tool Parameter Parsing Deviations',
      recommendation: 'Expand natural language regex patterns in localAi.ts for ambiguous query intents.',
      status: 'PLANNED',
    });
  }

  // Fallback default improvements if system is super clean
  if (improvementItems.length === 0) {
    improvementItems.push({
      id: 'imp_healthy_baseline',
      priority: 'LOW',
      category: 'Optimization',
      issue: 'System Operating at Peak Health (Zero Fatalities)',
      recommendation: 'Maintain automated hourly cron audits and rotate error logs every 30 days.',
      status: 'OPTIMAL',
    });
  }

  const report = {
    auditedAt: timestamp,
    healthScore,
    totalErrors: errors.length,
    errors24h: last24h.length,
    errors7d: last7d.length,
    severityBreakdown: bySeverity,
    componentBreakdown: byComponent,
    topSignatures,
    improvementItems,
  };

  // 4. Save JSON Report
  fs.writeFileSync(PLAN_JSON_FILE, JSON.stringify(report, null, 2), 'utf8');

  // 5. Save Markdown Report
  const mdReport = `# FinSathi System Health & Improvement Plan
Generated: ${new Date(timestamp).toLocaleString()}

## Overall Health Score: ${healthScore}%
- **Total Logged Errors:** ${errors.length}
- **Last 24 Hours:** ${last24h.length}
- **Last 7 Days:** ${last7d.length}

### Severity Breakdown
- **Fatal:** ${bySeverity.fatal}
- **Errors:** ${bySeverity.error}
- **Warnings:** ${bySeverity.warn}

---

## Actionable Improvement Plan
${improvementItems.map(item => `
### [${item.priority}] ${item.issue}
- **Category:** ${item.category}
- **Status:** \`${item.status}\`
- **Recommendation:** ${item.recommendation}
`).join('\n')}

---

## Top Error Signatures
${topSignatures.length > 0 ? topSignatures.map(s => `- **${s.component}** (${s.count}x): \`${s.message.slice(0, 80)}\``).join('\n') : '_No error signatures recorded._'}
`;

  fs.writeFileSync(PLAN_MD_FILE, mdReport, 'utf8');

  console.log(`[Cron Auditor] Audit complete at ${timestamp}. Health score: ${healthScore}%. Plan saved.`);
  return report;
}

// Execute if run directly from terminal
if (process.argv[1] && process.argv[1].endsWith('cron-error-auditor.mjs')) {
  runErrorAudit();
}
