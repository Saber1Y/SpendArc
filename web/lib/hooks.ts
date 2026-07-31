"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import type {Address, Hex} from "viem";

import {readVaultState, type VaultState, type AgentAction} from "./reads";

export type AsyncState<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
};

export interface ApiTransaction {
  id: string;
  agent_id: string;
  amount: number;
  token: string;
  recipient: string;
  purpose: string;
  policy_decision: string;
  decision_code: string;
  execution_status: string;
  tx_hash: string | null;
  action_id: string | null;
  created_at: number;
  confirmed_at: number | null;
}

export interface ApiAgent {
  id: string;
  name: string;
  address: string;
  status: string;
  created_at: number;
  last_active_at: number;
}

export interface ApiPolicy {
  agent_id: string;
  max_per_tx: number;
  daily_cap: number;
  spent_today: number;
  expiry: number;
  active: number;
  last_reset_time: number;
}

export interface ApiAllowlistEntry {
  id: number;
  agent_id: string;
  entry_type: "recipient" | "token";
  address: string;
  label: string;
  active: number;
}

export interface ApiAuditLog {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  details: string;
  created_at: number;
}

/** Batched vault-state read. Refetches on window focus + manual + post-action only (no interval). */
export function useVaultState(agent: Address) {
  const [state, setState] = useState<AsyncState<VaultState>>({data: undefined, loading: true, error: undefined});
  const inflight = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    if (inflight.current) return inflight.current;
    setState((s) => ({...s, loading: true}));
    inflight.current = (async () => {
      try {
        const data = await readVaultState(agent);
        setState({data, loading: false, error: undefined});
      } catch (e) {
        setState((s) => ({data: s.data, loading: false, error: e as Error}));
      }
    })();
    try {
      await inflight.current;
    } finally {
      inflight.current = null;
    }
  }, [agent]);

  useEffect(() => { void refetch(); }, [refetch]);
  useEffect(() => {
    const onFocus = () => void refetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  return {...state, refetch};
}

function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  return fetch(url, init).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? body.message ?? `HTTP ${r.status}`);
    return body as T;
  });
}

/** Fetch transactions from the API. */
export function useApiTransactions(agentId?: string) {
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = agentId ? `?agentId=${agentId}` : "";
      const data = await apiFetch<{transactions: ApiTransaction[]}>(`/api/transactions${params}`);
      setTransactions(data.transactions ?? []);
      setError(undefined);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { void refetch(); }, [refetch]);

  return {transactions, loading, error, refetch};
}

/** Fetch agents from the API. */
export function useApiAgents() {
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{agents: ApiAgent[]}>("/api/agents");
      setAgents(data.agents ?? []);
      setError(undefined);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  return {agents, loading, error, refetch};
}

/** Fetch audit logs from the API. */
export function useApiAuditLogs(limit = 50) {
  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{logs: ApiAuditLog[]}>(`/api/audit?limit=${limit}`);
      setLogs(data.logs ?? []);
      setError(undefined);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { void refetch(); }, [refetch]);

  return {logs, loading, error, refetch};
}

/** Map API transactions to AgentAction for display components. */
export function txToAction(tx: ApiTransaction, defaultAgentAddress = "0x0" as Address): AgentAction {
  return {
    kind: tx.execution_status === "CONFIRMED" || tx.execution_status === "APPROVED" ? "approved" : "blocked",
    agent: defaultAgentAddress,
    target: tx.recipient as Address,
    token: tx.token as Address,
    amount: BigInt(tx.amount),
    reason: tx.decision_code !== "APPROVED" ? tx.decision_code : undefined,
    txHash: (tx.tx_hash ?? "0x0") as Hex,
    blockNumber: 0n,
    logIndex: 0,
  };
}
