

import { useCallback, useEffect, useState } from "react";
import { api, API_BASE, getApiErrorMessage } from "../lib/api";

export type ConnectionState =
    | "connecting"
    | "connected"
    | "reconnecting"
    | "disconnected";

export type LiveEvent = {
  id: string;
  type: string;
  receivedAt: string;
  payload: unknown;
};

export type BlockchainStatus = {
  connected?: boolean;
  chainId?: number | string;
  expectedChainId?: number | string;
  correctNetwork?: boolean;
  latestBlock?: number | string;
  safeAddress?: string;
  safeExists?: boolean;
  guardAddress?: string;
  guardExists?: boolean;
  installedGuardAddress?: string;
  guardInstalled?: boolean;
  payeeRegistryAddress?: string;
  payeeRegistryExists?: boolean;
  tokenAddress?: string;
  tokenExists?: boolean;
  status?: string;
  rpcError?: string | null;
};

type HealthResponse = {
  application?: string;
  status?: string;
};

const SUPPORTED_EVENTS = [
  "CONNECTED",
  "PASSPORT_CREATED",
] as const;

export function useDashboardLive() {
  const [apiStatus, setApiStatus] = useState<
      "checking" | "online" | "offline"
  >("checking");

  const [blockchain, setBlockchain] =
      useState<BlockchainStatus | null>(null);

  const [blockchainError, setBlockchainError] =
      useState<string | null>(null);

  const [sseStatus, setSseStatus] =
      useState<ConnectionState>("connecting");

  const [events, setEvents] = useState<LiveEvent[]>([]);

  const [lastUpdated, setLastUpdated] =
      useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const [healthResult, blockchainResult] =
        await Promise.allSettled([
          api.get<HealthResponse>("/api/health"),
          api.get<BlockchainStatus>("/api/blockchain/status"),
        ]);

    if (healthResult.status === "fulfilled") {
      setApiStatus(
          healthResult.value.data?.status?.toUpperCase() === "UP"
              ? "online"
              : "offline"
      );
    } else {
      setApiStatus("offline");
    }

    if (blockchainResult.status === "fulfilled") {
      const status = blockchainResult.value.data;

      setBlockchain(status);
      setBlockchainError(status.rpcError ?? null);
    } else {
      setBlockchain(null);
      setBlockchainError(
          getApiErrorMessage(blockchainResult.reason)
      );
    }

    setLastUpdated(new Date().toISOString());
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      if (mounted) {
        await refreshStatus();
      }
    };

    void refresh();

    const interval = window.setInterval(() => {
      void refresh();
    }, 15000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [refreshStatus]);

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/api/stream`);

    const handleEvent = (event: Event) => {
      const message = event as MessageEvent<string>;

      let payload: unknown = message.data;

      try {
        payload = JSON.parse(message.data);
      } catch {
        // Retain plain-text payloads.
      }

      const newEvent: LiveEvent = {
        id:
            typeof crypto !== "undefined" &&
            "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,
        type: event.type,
        receivedAt: new Date().toISOString(),
        payload,
      };

      setEvents((previous) =>
          [newEvent, ...previous].slice(0, 100)
      );
    };

    source.onopen = () => {
      setSseStatus("connected");
    };

    source.onerror = () => {
      setSseStatus(
          source.readyState === EventSource.CLOSED
              ? "disconnected"
              : "reconnecting"
      );
    };

    SUPPORTED_EVENTS.forEach((eventName) => {
      source.addEventListener(eventName, handleEvent);
    });

    return () => {
      source.close();
      setSseStatus("disconnected");
    };
  }, []);

  return {
    apiStatus,
    blockchain,
    blockchainError,
    sseStatus,
    events,
    lastUpdated,
    refreshStatus,
    clearEvents,
  };
}
