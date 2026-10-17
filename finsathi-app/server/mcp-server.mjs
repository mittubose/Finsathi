#!/usr/bin/env node
/**
 * FinSathi Local MCP (Model Context Protocol) Server & Sync Service
 * Host on your private laptop. 
 * Allows Claude Desktop, Cursor, Ollama, and local agents to interact with FinSathi securely.
 *
 * Usage:
 *   node server/mcp-server.mjs --stdio     (for Claude Desktop / Cursor stdio MCP)
 *   node server/mcp-server.mjs --port 3001 (for HTTP REST, SSE & web serving)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';
import { runErrorAudit } from './cron-error-auditor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DIST_DIR = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============ SECURITY & AUTH CREDENTIALS ============

const AUTH_FILE = path.join(DATA_DIR, 'server_auth.json');
let SERVER_AUTH_TOKEN = process.env.FINSATHI_AUTH_TOKEN || '';

if (!SERVER_AUTH_TOKEN) {
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      SERVER_AUTH_TOKEN = authData.token;
    } catch {
      // Fall through to generate new
    }
  }
  if (!SERVER_AUTH_TOKEN) {
    SERVER_AUTH_TOKEN = 'fs_sec_' + crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(AUTH_FILE, JSON.stringify({
      token: SERVER_AUTH_TOKEN,
      createdAt: new Date().toISOString()
    }, null, 2), 'utf8');
  }
}

// IP Rate Limiter & Anti-Ping Flood Shield
const ipTracker = new Map(); // ip -> { count, windowStart, blockedUntil }

function checkIpRateLimit(ip) {
  const now = Date.now();
  let record = ipTracker.get(ip);
  if (!record) {
    record = { count: 1, windowStart: now, blockedUntil: 0 };
    ipTracker.set(ip, record);
    return { allowed: true };
  }

  // Check if IP is currently blocked
  if (record.blockedUntil > now) {
    const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, blocked: true, remainingSeconds };
  }

  // Reset sliding 60s window
  if (now - record.windowStart > 60000) {
    record.count = 1;
    record.windowStart = now;
    return { allowed: true };
  }

  record.count += 1;

  // If aggressive spamming (> 120 req/min), block for 15 minutes
  if (record.count > 120) {
    record.blockedUntil = now + 15 * 60 * 1000;
    try {
      const logFile = path.join(DATA_DIR, 'errors.jsonl');
      fs.appendFileSync(logFile, JSON.stringify({
        id: `err_sec_${Date.now()}`,
        timestamp: new Date().toISOString(),
        category: 'SECURITY',
        source: 'RATE_LIMITER',
        message: `IP ${ip} temporarily blocked for ping flood (>120 req/min)`,
        metadata: { ip, count: record.count }
      }) + '\n', 'utf8');
    } catch {}
    return { allowed: false, blocked: true, remainingSeconds: 900 };
  }

  // If exceeding 60 req/min, throttle with 429
  if (record.count > 60) {
    return { allowed: false, blocked: false, remainingSeconds: Math.ceil((60000 - (now - record.windowStart)) / 1000) };
  }

  return { allowed: true };
}

function safeTokenCompare(provided, expected) {
  if (!provided || !expected || typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  const bufA = Buffer.from(provided, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyAuthToken(req) {
  const tokenHeader = req.headers['x-finsathi-token'];
  const authHeader = req.headers['authorization'];
  let providedToken = tokenHeader;
  if (!providedToken && authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      providedToken = authHeader.slice(7).trim();
    } else {
      providedToken = authHeader.trim();
    }
  }
  return safeTokenCompare(providedToken, SERVER_AUTH_TOKEN);
}

function getLanIps() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

function readJsonBody(req, res, callback) {
  let body = '';
  let size = 0;
  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB payload limit (prevents Memory Exhaustion DoS)
  
  req.on('data', chunk => {
    size += chunk.length;
    if (size > MAX_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'PAYLOAD_TOO_LARGE: Request exceeds 5MB limit.' }));
      req.destroy();
    } else {
      body += chunk;
    }
  });

  req.on('end', () => {
    if (size > MAX_BYTES) return;
    try {
      const parsed = body.trim() ? JSON.parse(body) : {};
      callback(null, parsed);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Malformed JSON payload: ' + err.message }));
    }
  });
}

function serveStatic(req, res, url) {
  if (!fs.existsSync(DIST_DIR)) return false;

  // Path Traversal Mitigation: Strip leading traversal segments and enforce canonical confinement to DIST_DIR
  const safePath = path.normalize(url.pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.resolve(DIST_DIR, '.' + safePath);
  const resolvedDist = path.resolve(DIST_DIR);
  
  if (!filePath.startsWith(resolvedDist)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'FORBIDDEN: Path traversal detected.' }));
    return true;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }
  if (!fs.existsSync(filePath) || !filePath.startsWith(resolvedDist)) return false;

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// Local JSON storage file per profile
function getProfileFilePath(profileId) {
  const safeId = (profileId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `profile_${safeId}.json`);
}

function readProfileData(profileId) {
  const file = getProfileFilePath(profileId);
  const bakFile = `${file}.bak`;

  if (fs.existsSync(file)) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error(`[FinSathi Storage] Warning: Corrupt profile file ${file}, attempting backup recovery:`, err.message);
      // Attempt recovery from rolling backup!
      if (fs.existsSync(bakFile)) {
        try {
          const bakContent = fs.readFileSync(bakFile, 'utf8');
          const recovered = JSON.parse(bakContent);
          console.log(`[FinSathi Storage] Successfully recovered profile ${profileId} from backup.`);
          // Restore primary file from valid backup
          fs.copyFileSync(bakFile, file);
          return recovered;
        } catch (bakErr) {
          console.error(`[FinSathi Storage] Backup recovery also failed:`, bakErr.message);
        }
      }
    }
  }
  return { ledger: [], trades: [], reminders: [], timestamp: new Date().toISOString() };
}

function writeProfileData(profileId, data) {
  const file = getProfileFilePath(profileId);
  const tempFile = `${file}.tmp.${Date.now()}`;
  const bakFile = `${file}.bak`;

  const serialized = JSON.stringify(data, null, 2);

  // 1. Write to temporary file first
  fs.writeFileSync(tempFile, serialized, 'utf8');

  // 2. If target file already exists and is non-empty, back it up
  if (fs.existsSync(file)) {
    try {
      const stat = fs.statSync(file);
      if (stat.size > 0) {
        fs.copyFileSync(file, bakFile);
      }
    } catch {}
  }

  // 3. Atomically rename temp file to target file (POSIX atomic rename)
  fs.renameSync(tempFile, file);
}

// Conflict-free CRDT merge engine for multi-device sync
function mergeCollections(existingArr = [], incomingArr = []) {
  const map = new Map();
  // Existing items
  for (const item of existingArr) {
    if (item && item.id) map.set(item.id, item);
  }
  // Incoming items
  for (const item of incomingArr) {
    if (!item || !item.id) continue;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const incomingTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      if (incomingTime >= existingTime) {
        map.set(item.id, item);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const dateA = new Date(a.date || a.sellDate || a.createdAt || 0).getTime();
    const dateB = new Date(b.date || b.sellDate || b.createdAt || 0).getTime();
    return dateB - dateA;
  });
}


// MCP Tools Definition
const MCP_TOOLS = [
  {
    name: 'query_ledger',
    description: 'Fetch income, expenses, and trades from FinSathi database.',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string', description: 'Target profile ID' },
        limit: { type: 'number', description: 'Max items to return' },
        type: { type: 'string', enum: ['all', 'income', 'expense', 'trade'] }
      }
    }
  },
  {
    name: 'add_expense',
    description: 'Log an expense into FinSathi.',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string' },
        amountINR: { type: 'number' },
        category: { type: 'string' },
        merchant: { type: 'string' },
        notes: { type: 'string' }
      },
      required: ['amountINR', 'category', 'merchant']
    }
  },
  {
    name: 'get_financial_summary',
    description: 'Get profile totals, cash flow, and tax readiness.',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string' }
      }
    }
  },
  {
    name: 'simulate_tax_scenario',
    description: 'Simulate financial scenarios (bonus, capital gains, extra deductions) under FY 2025-26 dual tax regimes without mutating ledger.',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string' },
        bonus_amount: { type: 'number', description: 'Bonus or variable pay in INR' },
        extra_stcg: { type: 'number', description: 'Realized short term capital gains in INR' },
        extra_ltcg: { type: 'number', description: 'Realized long term capital gains in INR' },
        deduction_80c: { type: 'number', description: 'Section 80C deductions in INR (up to 1.5L)' },
        deduction_80d: { type: 'number', description: 'Section 80D medical insurance in INR' }
      }
    }
  },
  {
    name: 'log_obligation_payment',
    description: 'Mark a recurring bill or credit card obligation as paid and record ledger expense.',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string' },
        obligation_id_or_name: { type: 'string', description: 'Reminder ID or title (e.g. HDFC CC, Rent)' },
        amount_paid: { type: 'number', description: 'Actual amount paid in INR' },
        paid_date: { type: 'string', description: 'YYYY-MM-DD payment date' },
        payment_ref: { type: 'string', description: 'Transaction reference or notes' }
      },
      required: ['obligation_id_or_name']
    }
  },
  {
    name: 'get_upcoming_dues',
    description: 'Fetch upcoming credit card bills, SIPs, and fixed obligations within window days.',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string' },
        window_days: { type: 'number', description: 'Days forward to scan (default 14)' }
      }
    }
  },
  {
    name: 'record_trade_or_lot',
    description: 'Record a stock or mutual fund trade lot and compute FIFO capital gains.',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string' },
        symbol: { type: 'string', description: 'Stock or MF symbol, e.g. INFY, TATAMOTORS' },
        action: { type: 'string', enum: ['BUY', 'SELL'] },
        qty: { type: 'number' },
        price: { type: 'number', description: 'Execution price in INR' },
        trade_date: { type: 'string', description: 'YYYY-MM-DD' }
      },
      required: ['symbol', 'action', 'qty', 'price', 'trade_date']
    }
  },
  {
    name: 'get_advance_tax_status',
    description: 'Calculate non-TDS capital gains liability and Section 234C quarterly advance tax instalment status.',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string' },
        fy: { type: 'string', description: 'Financial year, e.g. 2025-26' }
      }
    }
  }
];

// Deterministic Statutory Tax & Trade Helpers (Zero LLM Hallucination)
function computeNewRegimeTaxINR(taxableSalaryINR) {
  const stdDed = 75000;
  const netTaxable = Math.max(0, taxableSalaryINR - stdDed);
  if (netTaxable <= 400000) return { netTaxable, baseTax: 0, cess: 0, totalTax: 0 };

  let tax = 0;
  if (netTaxable <= 800000) {
    tax = (netTaxable - 400000) * 0.05;
  } else if (netTaxable <= 1200000) {
    tax = 20000 + (netTaxable - 800000) * 0.10;
  } else if (netTaxable <= 1600000) {
    tax = 20000 + 40000 + (netTaxable - 1200000) * 0.15;
  } else if (netTaxable <= 2000000) {
    tax = 20000 + 40000 + 60000 + (netTaxable - 1600000) * 0.20;
  } else if (netTaxable <= 2400000) {
    tax = 20000 + 40000 + 60000 + 80000 + (netTaxable - 2000000) * 0.25;
  } else {
    tax = 20000 + 40000 + 60000 + 80000 + 100000 + (netTaxable - 2400000) * 0.30;
  }

  // Section 87A full rebate up to ₹12L net taxable
  if (netTaxable <= 1200000) {
    return { netTaxable, baseTax: 0, cess: 0, totalTax: 0, rebate87A: tax };
  }

  // Section 87A marginal relief: tax payable cannot exceed excess income over 12 Lakhs
  const excessOver12L = netTaxable - 1200000;
  let marginalRelief = 0;
  if (tax > excessOver12L) {
    marginalRelief = tax - excessOver12L;
    tax = excessOver12L;
  }

  const cess = Math.round(tax * 0.04);
  return { netTaxable, baseTax: tax, cess, totalTax: tax + cess, marginalRelief };
}

function computeOldRegimeTaxINR(grossSalaryINR, deductions80C = 150000, deductions80D = 25000, hra = 0) {
  const stdDed = 50000;
  const totalDeductions = stdDed + Math.min(150000, deductions80C) + deductions80D + hra;
  const netTaxable = Math.max(0, grossSalaryINR - totalDeductions);

  if (netTaxable <= 250000) return { netTaxable, totalTax: 0 };
  let tax = 0;
  if (netTaxable <= 500000) {
    tax = (netTaxable - 250000) * 0.05;
  } else if (netTaxable <= 1000000) {
    tax = 12500 + (netTaxable - 500000) * 0.20;
  } else {
    tax = 12500 + 100000 + (netTaxable - 1000000) * 0.30;
  }

  if (netTaxable <= 500000) return { netTaxable, totalTax: 0, rebate87A: tax };
  const cess = Math.round(tax * 0.04);
  return { netTaxable, totalTax: tax + cess };
}

function computeFifoSummary(trades = []) {
  // Sort trades chronologically
  const sorted = [...trades].sort((a, b) => new Date(a.date || a.trade_date || 0) - new Date(b.date || b.trade_date || 0));
  const buyLots = new Map(); // symbol -> [{ qty, price, date }]
  let realizedStcg = 0;
  let realizedLtcg = 0;

  for (const t of sorted) {
    const symbol = (t.symbol || '').toUpperCase();
    const action = (t.action || (t.type === 'trade' && t.sellDate ? 'SELL' : 'BUY')).toUpperCase();
    const qty = Number(t.qty || 0);
    const price = Number(t.price || (t.buyPricePaise ? t.buyPricePaise / 100 : 0));
    const tradeDate = t.date || t.trade_date || t.buyDate || new Date().toISOString().split('T')[0];

    if (!buyLots.has(symbol)) buyLots.set(symbol, []);

    if (action === 'BUY') {
      buyLots.get(symbol).push({ qty, price, date: tradeDate });
    } else if (action === 'SELL') {
      let remToSell = qty;
      const lots = buyLots.get(symbol);
      const sellPrice = Number(t.price || (t.sellPricePaise ? t.sellPricePaise / 100 : price));
      const sellDate = t.date || t.trade_date || t.sellDate || tradeDate;

      while (remToSell > 0 && lots.length > 0) {
        const topLot = lots[0];
        const matchQty = Math.min(remToSell, topLot.qty);
        const buyCost = matchQty * topLot.price;
        const sellVal = matchQty * sellPrice;
        const gain = sellVal - buyCost;

        const holdingDays = Math.floor((new Date(sellDate) - new Date(topLot.date)) / (1000 * 60 * 60 * 24));
        if (holdingDays > 365) {
          realizedLtcg += gain;
        } else {
          realizedStcg += gain;
        }

        topLot.qty -= matchQty;
        remToSell -= matchQty;
        if (topLot.qty <= 0) lots.shift();
      }
    }
  }

  // Budget 2024 LTCG exemption ₹1.25L
  const ltcgExemptionUsed = Math.min(125000, Math.max(0, realizedLtcg));
  const taxableLtcg = Math.max(0, realizedLtcg - 125000);
  const ltcgTax = Math.round(taxableLtcg * 0.125 * 1.04);
  const stcgTax = Math.round(Math.max(0, realizedStcg) * 0.20 * 1.04);

  return {
    realizedStcg,
    realizedLtcg,
    ltcgExemptionUsed,
    ltcgExemptionRemaining: Math.max(0, 125000 - ltcgExemptionUsed),
    stcgTax,
    ltcgTax,
    totalCapitalGainsTax: stcgTax + ltcgTax
  };
}

function handleToolCall(name, params) {
  const profileId = params.profileId || 'prof_admin_master';
  const data = readProfileData(profileId);

  if (name === 'query_ledger') {
    const limit = params.limit || 20;
    const items = data.ledger || [];
    return {
      content: [{ type: 'text', text: JSON.stringify(items.slice(0, limit), null, 2) }]
    };
  }

  if (name === 'add_expense') {
    const item = {
      id: `exp_${Date.now()}`,
      type: 'expense',
      amountPaise: Math.round(params.amountINR * 100),
      category: params.category,
      merchant: params.merchant,
      notes: params.notes || 'Logged via MCP',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    data.ledger = data.ledger || [];
    data.ledger.unshift(item);
    writeProfileData(profileId, data);
    return {
      content: [{ type: 'text', text: `Added expense ₹${params.amountINR} (${params.merchant}) to profile ${profileId}` }]
    };
  }

  if (name === 'get_financial_summary') {
    const ledger = data.ledger || [];
    const income = ledger.filter(l => l.type === 'income').reduce((acc, l) => acc + (l.amountPaise || 0), 0) / 100;
    const expense = ledger.filter(l => l.type === 'expense').reduce((acc, l) => acc + (l.amountPaise || 0), 0) / 100;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          profileId,
          totalIncomeINR: income,
          totalExpenseINR: expense,
          netSavingsINR: income - expense,
          transactionCount: ledger.length
        }, null, 2)
      }]
    };
  }

  if (name === 'simulate_tax_scenario') {
    const ledger = data.ledger || [];
    const baseSalaryINR = ledger.filter(l => l.type === 'income').reduce((acc, l) => acc + (l.amountPaise || 0), 0) / 100;
    const bonus = Number(params.bonus_amount || 0);
    const extraStcg = Number(params.extra_stcg || 0);
    const extraLtcg = Number(params.extra_ltcg || 0);
    const grossIncome = baseSalaryINR + bonus;

    const newRegime = computeNewRegimeTaxINR(grossIncome);
    const oldRegime = computeOldRegimeTaxINR(grossIncome, params.deduction_80c || 150000, params.deduction_80d || 25000);

    const stcgTax = Math.round(Math.max(0, extraStcg) * 0.20 * 1.04);
    const ltcgTax = Math.round(Math.max(0, extraLtcg - 125000) * 0.125 * 1.04);
    const totalExtraCgTax = stcgTax + ltcgTax;

    const totalNewTax = newRegime.totalTax + totalExtraCgTax;
    const totalOldTax = oldRegime.totalTax + totalExtraCgTax;
    const recommended = totalNewTax <= totalOldTax ? 'new' : 'old';
    const savings = Math.abs(totalOldTax - totalNewTax);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          grossIncomeINR: grossIncome,
          newRegime: {
            taxableINR: newRegime.netTaxable,
            salaryTaxINR: newRegime.totalTax,
            marginalReliefINR: newRegime.marginalRelief || 0,
            effectiveRate: grossIncome > 0 ? ((totalNewTax / grossIncome) * 100).toFixed(2) + '%' : '0%'
          },
          oldRegime: {
            taxableINR: oldRegime.netTaxable,
            salaryTaxINR: oldRegime.totalTax,
            effectiveRate: grossIncome > 0 ? ((totalOldTax / grossIncome) * 100).toFixed(2) + '%' : '0%'
          },
          capitalGainsTaxINR: totalExtraCgTax,
          recommendedRegime: recommended.toUpperCase(),
          taxSavingsINR: savings,
          netTakeHomeINR: grossIncome - (recommended === 'new' ? totalNewTax : totalOldTax)
        }, null, 2)
      }]
    };
  }

  if (name === 'log_obligation_payment') {
    data.reminders = data.reminders || [];
    const query = String(params.obligation_id_or_name || '').toLowerCase();
    const reminder = data.reminders.find(r => r.id === params.obligation_id_or_name || (r.title && r.title.toLowerCase().includes(query)));

    const paidDate = params.paid_date || new Date().toISOString().split('T')[0];
    const amountINR = params.amount_paid !== undefined ? Number(params.amount_paid) : (reminder ? (reminder.amountPaise || 0) / 100 : 0);

    if (reminder) {
      reminder.status = 'paid';
      reminder.settledAt = new Date().toISOString();
    }

    // Append to ledger as settled bill
    const expenseItem = {
      id: `exp_ob_${Date.now()}`,
      type: 'expense',
      amountPaise: Math.round(amountINR * 100),
      category: reminder ? reminder.category : 'Bills',
      merchant: reminder ? reminder.title : params.obligation_id_or_name,
      notes: `Settled via MCP (${params.payment_ref || 'Direct'})`,
      date: paidDate,
      createdAt: new Date().toISOString()
    };
    data.ledger = data.ledger || [];
    data.ledger.unshift(expenseItem);
    writeProfileData(profileId, data);

    return {
      content: [{
        type: 'text',
        text: `Obligation "${reminder ? reminder.title : params.obligation_id_or_name}" recorded as PAID (₹${amountINR}) on ${paidDate}. Ledger updated.`
      }]
    };
  }

  if (name === 'get_upcoming_dues') {
    const windowDays = Number(params.window_days || 14);
    const now = new Date();
    const cutoff = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString().split('T')[0];
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const reminders = (data.reminders || []).filter(r => {
      if (r.status === 'paid') return false;
      const due = r.nextDue || r.dueDate || r.date;
      return due && (due <= cutoffStr);
    });

    const totalDuesINR = reminders.reduce((sum, r) => sum + (r.amountPaise || 0), 0) / 100;
    const ccDuesINR = reminders.filter(r => /card|credit|hdfc|icici|amex/i.test(r.title || '')).reduce((s, r) => s + (r.amountPaise || 0), 0) / 100;
    const sipDuesINR = reminders.filter(r => /sip|mf|mutual/i.test(r.title || '') || r.category === 'SIP').reduce((s, r) => s + (r.amountPaise || 0), 0) / 100;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          windowDays,
          asOf: nowStr,
          pendingCount: reminders.length,
          totalUpcomingDuesINR: totalDuesINR,
          creditCardDuesINR: ccDuesINR,
          sipCommitmentsINR: sipDuesINR,
          dues: reminders.map(r => ({
            id: r.id,
            title: r.title,
            dueDate: r.nextDue || r.dueDate || r.date,
            amountINR: (r.amountPaise || 0) / 100,
            status: (r.nextDue || r.dueDate || r.date) < nowStr ? 'OVERDUE' : 'DUE_SOON'
          }))
        }, null, 2)
      }]
    };
  }

  if (name === 'record_trade_or_lot') {
    const trade = {
      id: `tr_${Date.now()}`,
      symbol: (params.symbol || '').toUpperCase(),
      action: params.action.toUpperCase(),
      qty: Number(params.qty),
      buyPricePaise: params.action === 'BUY' ? Math.round(params.price * 100) : 0,
      sellPricePaise: params.action === 'SELL' ? Math.round(params.price * 100) : 0,
      date: params.trade_date,
      buyDate: params.action === 'BUY' ? params.trade_date : undefined,
      sellDate: params.action === 'SELL' ? params.trade_date : undefined,
      createdAt: new Date().toISOString()
    };

    data.trades = data.trades || [];
    data.trades.push(trade);

    const summary = computeFifoSummary(data.trades);
    writeProfileData(profileId, data);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          recordedTrade: trade,
          portfolioGainsSummary: {
            realizedStcgINR: summary.realizedStcg,
            realizedLtcgINR: summary.realizedLtcg,
            ltcgExemptionUsedINR: summary.ltcgExemptionUsed,
            ltcgExemptionRemainingINR: summary.ltcgExemptionRemaining,
            estimatedStcgTaxINR: summary.stcgTax,
            estimatedLtcgTaxINR: summary.ltcgTax
          }
        }, null, 2)
      }]
    };
  }

  if (name === 'get_advance_tax_status') {
    const summary = computeFifoSummary(data.trades || []);
    const nonTdsTax = summary.totalCapitalGainsTax;
    const isRequired = nonTdsTax >= 10000;

    const now = new Date();
    const month = now.getMonth(); // 0-11
    let currentQuarter = 'Q1';
    let instalmentPct = 0.15;
    let safeHarborPct = 0.12;
    let dueDate = 'June 15';

    if (month >= 2 && month <= 4) { // Mar-May -> Q1
      currentQuarter = 'Q1'; instalmentPct = 0.15; safeHarborPct = 0.12; dueDate = 'June 15';
    } else if (month >= 5 && month <= 7) { // Jun-Aug -> Q2
      currentQuarter = 'Q2'; instalmentPct = 0.45; safeHarborPct = 0.36; dueDate = 'September 15';
    } else if (month >= 8 && month <= 10) { // Sep-Nov -> Q3
      currentQuarter = 'Q3'; instalmentPct = 0.75; safeHarborPct = 0.75; dueDate = 'December 15';
    } else { // Dec-Feb -> Q4
      currentQuarter = 'Q4'; instalmentPct = 1.00; safeHarborPct = 1.00; dueDate = 'March 15';
    }

    const instalmentDueINR = Math.round(nonTdsTax * instalmentPct);
    const safeHarborDueINR = Math.round(nonTdsTax * safeHarborPct);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          fy: params.fy || '2025-26',
          nonTdsCapitalGainsTaxINR: nonTdsTax,
          advanceTaxRequired: isRequired,
          currentQuarter,
          nextInstalmentDate: dueDate,
          instalmentDueINR,
          safeHarborMinimumINR: safeHarborDueINR,
          penaltyWarning: isRequired ? 'Pay before ' + dueDate + ' to prevent 1% per month Section 234C penal interest.' : 'Total non-TDS tax liability under ₹10,000 statutory limit. Advance tax not mandatory.'
        }, null, 2)
      }]
    };
  }

  return { content: [{ type: 'text', text: `Unknown tool ${name}` }], isError: true };
}

// HTTP Server mode
const PORT = process.env.PORT || 3001;
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-FinSathi-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const clientIp = req.socket.remoteAddress || 'unknown';
  const rateLimitStatus = checkIpRateLimit(clientIp);

  if (!rateLimitStatus.allowed) {
    res.writeHead(429, { 
      'Content-Type': 'application/json',
      'Retry-After': String(rateLimitStatus.remainingSeconds)
    });
    res.end(JSON.stringify({ 
      error: 'RATE_LIMIT_EXCEEDED: Too many requests.',
      retryAfterSeconds: rateLimitStatus.remainingSeconds,
      blocked: rateLimitStatus.blocked
    }));
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health check (Public endpoint for liveness probes)
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      service: 'FinSathi-MCP', 
      port: PORT,
      lanIps: getLanIps(),
      requiresAuth: true
    }));
    return;
  }

  // System LAN Info (Public, needed for QR pairing code generation)
  if (url.pathname === '/api/system/lan-info' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      port: PORT,
      lanIps: getLanIps(),
      hostname: os.hostname(),
      hasDist: fs.existsSync(DIST_DIR)
    }));
    return;
  }

  // Token Verification endpoint
  if (url.pathname === '/api/auth/verify' && req.method === 'POST') {
    readJsonBody(req, res, (err, payload) => {
      const { token } = payload;
      if (safeTokenCompare(token, SERVER_AUTH_TOKEN)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: true, message: 'Authentication successful.' }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false, error: 'Invalid authentication token.' }));
      }
    });
    return;
  }

  // Guard all subsequent MCP and API endpoints with Token Authentication
  const isProtectedPath = url.pathname.startsWith('/mcp/') || url.pathname.startsWith('/api/');
  if (isProtectedPath) {
    if (!verifyAuthToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'UNAUTHORIZED: Valid X-FinSathi-Token or Bearer token header required to access MCP/Sync API.' 
      }));
      return;
    }
  }

  // MCP Tools List
  if (url.pathname === '/mcp/tools' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tools: MCP_TOOLS }));
    return;
  }

  // MCP Tool Execution
  if (url.pathname === '/mcp/call' && req.method === 'POST') {
    readJsonBody(req, res, (err, payload) => {
      try {
        const { name, arguments: params } = payload;
        const result = handleToolCall(name, params || {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Dual-mode Sync endpoint from web client with conflict-free merge
  if (url.pathname === '/api/sync' && req.method === 'POST') {
    readJsonBody(req, res, (err, payload) => {
      try {
        const { profileId, payload: profileContent } = payload;
        if (!profileId) throw new Error('Missing profileId');
        
        // Read existing records on server
        const existingData = readProfileData(profileId);

        // Merge collections safely by unique ID and timestamp
        const mergedLedger = mergeCollections(existingData.ledger, profileContent?.ledger);
        const mergedTrades = mergeCollections(existingData.trades, profileContent?.trades);
        const mergedReminders = mergeCollections(existingData.reminders, profileContent?.reminders);

        const mergedRecord = {
          ...existingData,
          ...profileContent,
          ledger: mergedLedger,
          trades: mergedTrades,
          reminders: mergedReminders,
          syncedAt: new Date().toISOString()
        };

        writeProfileData(profileId, mergedRecord);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: `Profile ${profileId} merged and synced successfully without data loss.`,
          mergedData: {
            ledger: mergedLedger,
            trades: mergedTrades,
            reminders: mergedReminders,
            syncedAt: mergedRecord.syncedAt
          }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Error Logging endpoint
  if (url.pathname === '/api/logs/error' && req.method === 'POST') {
    readJsonBody(req, res, (err, payload) => {
      try {
        const errorEntry = payload;
        const logFile = path.join(DATA_DIR, 'errors.jsonl');
        fs.appendFileSync(logFile, JSON.stringify(errorEntry) + '\n', 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id: errorEntry?.id }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Get errors list
  if (url.pathname === '/api/logs/errors' && req.method === 'GET') {
    const logFile = path.join(DATA_DIR, 'errors.jsonl');
    if (!fs.existsSync(logFile)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: [] }));
      return;
    }
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    const errors = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse().slice(0, 100);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: errors.length, errors }));
    return;
  }

  // Clear errors
  if (url.pathname === '/api/logs/clear' && req.method === 'POST') {
    const logFile = path.join(DATA_DIR, 'errors.jsonl');
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Error log cleared.' }));
    return;
  }

  // Get Improvement Plan
  if (url.pathname === '/api/audit/improvement-plan' && req.method === 'GET') {
    const planFile = path.join(DATA_DIR, 'improvement_plan.json');
    if (!fs.existsSync(planFile)) {
      const plan = runErrorAudit();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(plan));
      return;
    }
    try {
      const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(plan));
    } catch {
      const plan = runErrorAudit();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(plan));
    }
    return;
  }

  // Run audit scan on demand
  if (url.pathname === '/api/audit/run-scan' && req.method === 'POST') {
    const plan = runErrorAudit();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(plan));
    return;
  }

  // Autonomous OS / n8n Automation Endpoints
  if (url.pathname === '/api/mcp/upcoming-dues' && req.method === 'GET') {
    const profileId = url.searchParams.get('profileId') || 'prof_admin_master';
    const windowDays = Number(url.searchParams.get('window') || 14);
    const result = handleToolCall('get_upcoming_dues', { profileId, window_days: windowDays });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(result.content[0].text);
    return;
  }

  if (url.pathname === '/api/mcp/advance-tax-status' && req.method === 'GET') {
    const profileId = url.searchParams.get('profileId') || 'prof_admin_master';
    const fy = url.searchParams.get('fy') || '2025-26';
    const result = handleToolCall('get_advance_tax_status', { profileId, fy });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(result.content[0].text);
    return;
  }

  // Unified Production Deployment: Serve static files from dist/ if available
  if (serveStatic(req, res, url)) {
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[FinSathi MCP] Server running on http://127.0.0.1:${PORT}`);
  console.log(`[FinSathi Security] Server Auth Token: ${SERVER_AUTH_TOKEN}`);
  const lanIps = getLanIps();
  if (lanIps.length > 0) {
    console.log(`[FinSathi Network] LAN Access URLs:`);
    lanIps.forEach(ip => console.log(`   - http://${ip}:${PORT}`));
  }
  
  // Initial run of error audit on boot
  try {
    runErrorAudit();
  } catch (err) {
    console.error('[FinSathi Boot] Audit initialization warning:', err.message);
  }
});

// Periodic hourly background audit cron job
setInterval(() => {
  try {
    runErrorAudit();
  } catch (err) {
    console.error('[FinSathi Cron] Scheduled audit failure:', err.message);
  }
}, 60 * 60 * 1000);

// Periodic TTL sweeper for IP rate limiter to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipTracker.entries()) {
    if (record.blockedUntil < now && now - record.windowStart > 120000) {
      ipTracker.delete(ip);
    }
  }
}, 5 * 60 * 1000);

