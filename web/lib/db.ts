import Database from "better-sqlite3";
import path from "path";
import {randomUUID} from "crypto";

const DB_PATH = path.join(process.cwd(), "data", "spendarc.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      last_active_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS policies (
      agent_id TEXT PRIMARY KEY REFERENCES agents(id),
      max_per_tx INTEGER NOT NULL DEFAULT 0,
      daily_cap INTEGER NOT NULL DEFAULT 0,
      spent_today INTEGER NOT NULL DEFAULT 0,
      expiry INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      last_reset_time INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS allowlist_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      entry_type TEXT NOT NULL CHECK(entry_type IN ('recipient','token')),
      address TEXT NOT NULL,
      label TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      amount INTEGER NOT NULL,
      token TEXT NOT NULL,
      recipient TEXT NOT NULL,
      purpose TEXT DEFAULT '',
      policy_decision TEXT NOT NULL CHECK(policy_decision IN ('APPROVED','BLOCKED')),
      decision_code TEXT,
      execution_status TEXT NOT NULL DEFAULT 'REQUESTED',
      tx_hash TEXT,
      action_id TEXT,
      created_at INTEGER NOT NULL,
      confirmed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
  `);
}

export interface Agent {
  id: string;
  name: string;
  address: string;
  status: string;
  created_at: number;
  last_active_at: number | null;
}

export interface Policy {
  agent_id: string;
  max_per_tx: number;
  daily_cap: number;
  spent_today: number;
  expiry: number;
  active: number;
  last_reset_time: number;
}

export interface AllowlistEntry {
  id: number;
  agent_id: string;
  entry_type: "recipient" | "token";
  address: string;
  label: string;
  active: number;
}

export interface Transaction {
  id: string;
  agent_id: string;
  amount: number;
  token: string;
  recipient: string;
  purpose: string;
  policy_decision: "APPROVED" | "BLOCKED";
  decision_code: string | null;
  execution_status: string;
  tx_hash: string | null;
  action_id: string | null;
  created_at: number;
  confirmed_at: number | null;
}

export interface AuditLog {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  details: string;
  created_at: number;
}

// ---- Agents ----

export function listAgents(): Agent[] {
  return getDb().prepare("SELECT * FROM agents ORDER BY created_at DESC").all() as Agent[];
}

export function getAgent(id: string): Agent | undefined {
  return getDb().prepare("SELECT * FROM agents WHERE id = ?").get(id) as Agent | undefined;
}

export function createAgent(name: string, address: string): Agent {
  const id = `agent_${randomUUID().slice(0, 8)}`;
  const now = Math.floor(Date.now() / 1000);
  const agent: Agent = {id, name, address, status: "active", created_at: now, last_active_at: now};
  getDb().prepare("INSERT INTO agents (id, name, address, status, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?)").run(agent.id, agent.name, agent.address, agent.status, agent.created_at, agent.last_active_at);
  getDb().prepare("INSERT INTO policies (agent_id, max_per_tx, daily_cap, spent_today, expiry, active, last_reset_time) VALUES (?, 0, 0, 0, 0, 1, ?)").run(agent.id, now);
  addAuditLog("agent", agent.id, "agent_created", {name, address});
  return agent;
}

// ---- Policies ----

export function getPolicy(agentId: string): Policy | undefined {
  return getDb().prepare("SELECT * FROM policies WHERE agent_id = ?").get(agentId) as Policy | undefined;
}

export function updatePolicy(agentId: string, fields: Partial<Pick<Policy, "max_per_tx" | "daily_cap" | "expiry" | "active">>): Policy | undefined {
  const existing = getPolicy(agentId);
  if (!existing) return undefined;
  const merged = {...existing, ...fields};
  getDb().prepare("UPDATE policies SET max_per_tx = ?, daily_cap = ?, expiry = ?, active = ? WHERE agent_id = ?").run(merged.max_per_tx, merged.daily_cap, merged.expiry, merged.active, agentId);
  addAuditLog("policy", agentId, "policy_updated", fields);
  return getPolicy(agentId);
}

// ---- Allowlist ----

export function listAllowlistEntries(agentId: string, type?: "recipient" | "token"): AllowlistEntry[] {
  if (type) {
    return getDb().prepare("SELECT * FROM allowlist_entries WHERE agent_id = ? AND entry_type = ? AND active = 1").all(agentId, type) as AllowlistEntry[];
  }
  return getDb().prepare("SELECT * FROM allowlist_entries WHERE agent_id = ? AND active = 1").all(agentId) as AllowlistEntry[];
}

export function addAllowlistEntry(agentId: string, type: "recipient" | "token", address: string, label: string = ""): AllowlistEntry {
  const result = getDb().prepare("INSERT INTO allowlist_entries (agent_id, entry_type, address, label) VALUES (?, ?, ?, ?)").run(agentId, type, address, label);
  addAuditLog("allowlist", `${agentId}:${address}`, "allowlist_added", {type, address, label});
  return getDb().prepare("SELECT * FROM allowlist_entries WHERE id = ?").get(result.lastInsertRowid) as AllowlistEntry;
}

export function removeAllowlistEntry(id: number) {
  getDb().prepare("UPDATE allowlist_entries SET active = 0 WHERE id = ?").run(id);
  addAuditLog("allowlist", String(id), "allowlist_removed", {});
}

// ---- Transactions ----

export function createTransaction(tx: Omit<Transaction, "id" | "created_at" | "confirmed_at">): Transaction {
  const id = `tx_${randomUUID().slice(0, 12)}`;
  const now = Math.floor(Date.now() / 1000);
  const full: Transaction = {...tx, id, created_at: now, confirmed_at: null};
  getDb().prepare("INSERT INTO transactions (id, agent_id, amount, token, recipient, purpose, policy_decision, decision_code, execution_status, tx_hash, action_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(full.id, full.agent_id, full.amount, full.token, full.recipient, full.purpose, full.policy_decision, full.decision_code, full.execution_status, full.tx_hash, full.action_id, full.created_at);
  addAuditLog("transaction", full.id, "transaction_created", {agent_id: tx.agent_id, amount: tx.amount, recipient: tx.recipient, policy_decision: tx.policy_decision});
  return full;
}

export function updateTransaction(id: string, fields: Partial<Pick<Transaction, "execution_status" | "tx_hash" | "confirmed_at" | "decision_code">>): Transaction | undefined {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  vals.push(id);
  getDb().prepare(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  addAuditLog("transaction", id, "transaction_updated", fields);
  return getDb().prepare("SELECT * FROM transactions WHERE id = ?").get(id) as Transaction | undefined;
}

export function listTransactions(agentId?: string): Transaction[] {
  if (agentId) {
    return getDb().prepare("SELECT * FROM transactions WHERE agent_id = ? ORDER BY created_at DESC").all(agentId) as Transaction[];
  }
  return getDb().prepare("SELECT * FROM transactions ORDER BY created_at DESC").all() as Transaction[];
}

export function getTransaction(id: string): Transaction | undefined {
  return getDb().prepare("SELECT * FROM transactions WHERE id = ?").get(id) as Transaction | undefined;
}

// ---- Audit ----

export function listAuditLogs(limit: number = 50): AuditLog[] {
  return getDb().prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?").all(limit) as AuditLog[];
}

function addAuditLog(entityType: string, entityId: string, action: string, details: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare("INSERT INTO audit_logs (entity_type, entity_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)").run(entityType, entityId, action, JSON.stringify(details), now);
}

// ---- Daily spent reset ----

export function resetDailySpent(agentId: string) {
  const now = Math.floor(Date.now() / 1000);
  const policy = getPolicy(agentId);
  if (policy) {
    const daySecs = 86400;
    if (now >= policy.last_reset_time + daySecs) {
      getDb().prepare("UPDATE policies SET spent_today = 0, last_reset_time = ? WHERE agent_id = ?").run(now, agentId);
    }
  }
}

export function incrementDailySpent(agentId: string, amount: number) {
  getDb().prepare("UPDATE policies SET spent_today = spent_today + ? WHERE agent_id = ?").run(amount, agentId);
}

export type DecisionCode =
  | "APPROVED"
  | "EXCEEDS_PER_TX_LIMIT"
  | "EXCEEDS_DAILY_LIMIT"
  | "RECIPIENT_NOT_ALLOWLISTED"
  | "TOKEN_NOT_ALLOWLISTED"
  | "POLICY_EXPIRED"
  | "AGENT_REVOKED"
  | "INSUFFICIENT_FUNDS"
  | "AGENT_NOT_FOUND";

// ---- Payment pipeline ----

export interface PaymentRequest {
  agentId: string;
  recipient: string;
  amount: number;
  token: string;
  purpose?: string;
}

export interface PolicyResult {
  approved: boolean;
  code: DecisionCode;
  reason?: string;
}

export function evaluatePolicy(agentId: string, amount: number, recipient: string, token: string): PolicyResult {
  const agent = getAgent(agentId);
  if (!agent) return {approved: false, code: "AGENT_NOT_FOUND", reason: "Agent not found"};

  const policy = getPolicy(agentId);
  if (!policy) return {approved: false, code: "AGENT_NOT_FOUND", reason: "No policy configured"};

  if (!policy.active) return {approved: false, code: "AGENT_REVOKED", reason: "Agent is revoked"};

  if (policy.expiry !== 0 && Math.floor(Date.now() / 1000) > policy.expiry) {
    return {approved: false, code: "POLICY_EXPIRED", reason: "Policy has expired"};
  }

  resetDailySpent(agentId);
  const currentPolicy = getPolicy(agentId)!;

  if (amount > currentPolicy.max_per_tx) {
    return {approved: false, code: "EXCEEDS_PER_TX_LIMIT", reason: `Amount $${(amount / 1e6).toFixed(2)} exceeds per-tx limit $${(currentPolicy.max_per_tx / 1e6).toFixed(2)}`};
  }

  if (currentPolicy.spent_today + amount > currentPolicy.daily_cap) {
    return {approved: false, code: "EXCEEDS_DAILY_LIMIT", reason: `Would exceed daily limit $${(currentPolicy.daily_cap / 1e6).toFixed(2)}`};
  }

  const recipients = listAllowlistEntries(agentId, "recipient");
  const recipientOk = recipients.some((r) => r.address.toLowerCase() === recipient.toLowerCase());
  if (!recipientOk) return {approved: false, code: "RECIPIENT_NOT_ALLOWLISTED", reason: "Recipient not in allowlist"};

  const tokens = listAllowlistEntries(agentId, "token");
  const tokenOk = tokens.some((t) => t.address.toLowerCase() === token.toLowerCase());
  if (!tokenOk) return {approved: false, code: "TOKEN_NOT_ALLOWLISTED", reason: "Token not in allowlist"};

  return {approved: true, code: "APPROVED"};
}
