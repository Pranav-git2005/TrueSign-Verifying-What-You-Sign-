
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Clock3,
  Copy,
  Database,
  Globe,
  Info,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Terminal,
  XCircle,
} from "lucide-react";

import { api, API_BASE, getApiErrorMessage } from "../lib/api";

interface HealthResponse {
  application?: string;
  status?: string;
  rpcError?: string | null;
  checkedAt?: string;
}

interface BlockchainStatus {
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
}

type CheckState = "checking" | "success" | "error";

function StateBadge({
  state,
  label,
}: {
  state: CheckState;
  label?: string;
}) {
  const styles = {
    checking:
      "border-amber-400/20 bg-amber-400/[0.06] text-amber-300",
    success:
      "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300",
    error:
      "border-rose-400/20 bg-rose-400/[0.06] text-rose-300",
  };

  const Icon =
    state === "success"
      ? CheckCircle2
      : state === "error"
        ? XCircle
        : CircleDot;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold ${styles[state]}`}
    >
      <Icon size={12} />
      {label ||
        (state === "success"
          ? "Operational"
          : state === "error"
            ? "Unavailable"
            : "Checking")}
    </span>
  );
}

function ConfigRow({
  label,
  value,
  description,
  copyable = false,
}: {
  label: string;
  value: string;
  description?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-white/[0.06] py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-medium text-slate-300">
          {label}
        </p>
        {description && (
          <p className="mt-1 text-[10px] text-slate-500">
            {description}
          </p>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 break-all font-mono text-xs text-slate-400">
          {value}
        </p>

        {copyable && (
          <button
            onClick={copyValue}
            title={`Copy ${label}`}
            className="shrink-0 rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-emerald-400/20 hover:text-emerald-300"
          >
            <Copy size={13} />
          </button>
        )}

        {copied && (
          <span className="text-[10px] text-emerald-300">
            Copied
          </span>
        )}
      </div>
    </div>
  );
}

function OverviewCard({
  title,
  value,
  description,
  icon: Icon,
  state,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Server;
  state: CheckState;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{title}</p>
        <Icon size={18} className="text-emerald-300" />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            state === "success"
              ? "bg-emerald-400"
              : state === "error"
                ? "bg-rose-400"
                : "bg-amber-400"
          }`}
        />
        <p className="text-lg font-semibold text-white">
          {value}
        </p>
      </div>

      <p className="mt-2 text-[10px] text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default function Settings() {
  const [health, setHealth] =
    useState<HealthResponse | null>(null);

  const [blockchain, setBlockchain] =
    useState<BlockchainStatus | null>(null);

  const [healthState, setHealthState] =
    useState<CheckState>("checking");

  const [blockchainState, setBlockchainState] =
    useState<CheckState>("checking");

  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] =
    useState<string | null>(null);

  const [errors, setErrors] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrors([]);

    const [healthResult, blockchainResult] =
      await Promise.allSettled([
        api.get<HealthResponse>("/api/health"),
        api.get<BlockchainStatus>("/api/blockchain/status"),
      ]);

    const nextErrors: string[] = [];

    if (healthResult.status === "fulfilled") {
      setHealth(healthResult.value.data);

      setHealthState(
        healthResult.value.data.status === "UP"
          ? "success"
          : "error"
      );
    } else {
      setHealth(null);
      setHealthState("error");
      nextErrors.push(
        `Backend: ${getApiErrorMessage(healthResult.reason)}`
      );
    }

    if (blockchainResult.status === "fulfilled") {
      setBlockchain(blockchainResult.value.data);

      setBlockchainState(
        blockchainResult.value.data.connected === true
          ? "success"
          : "error"
      );
      if (blockchainResult.value.data.connected !== true) {
        nextErrors.push(`Blockchain RPC: ${blockchainResult.value.data.rpcError || "RPC is unavailable or returned an incomplete status."}`);
      }
    } else {
      setBlockchain(null);
      setBlockchainState("error");

      nextErrors.push(
        `Blockchain: ${getApiErrorMessage(blockchainResult.reason)}`
      );
    }

    setErrors(nextErrors);
    setLastChecked(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const correctNetwork =
    blockchain?.correctNetwork === true;

  const guardInstalled =
    blockchain?.guardInstalled === true;

  const deploymentReady =
    blockchain?.status === "CONNECTED";

  const frontendMode = import.meta.env.MODE;
  const backendApplication =
    health?.application || "Unknown";

  const contractCount = [
    blockchain?.safeExists,
    blockchain?.guardExists,
    blockchain?.payeeRegistryExists,
    blockchain?.tokenExists,
  ].filter(Boolean).length;

  return (
    <div className="space-y-7">
      {/* HEADER */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-[#10251F] via-[#101B20] to-[#111827] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full border border-emerald-300/10" />

        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1.5">
              <Settings2 size={12} className="text-emerald-300" />
              <span className="text-[10px] font-semibold tracking-wider text-emerald-200">
                SYSTEM CONFIGURATION
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Settings & Configuration
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Inspect your TrueSign application environment,
              backend availability, blockchain network and
              deployed infrastructure.
            </p>
          </div>

          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-300/[0.14] disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />
            Refresh diagnostics
          </button>
        </div>
      </section>

      {/* OVERVIEW */}
      <section>
        <div className="mb-4">
          <p className="eyebrow">SYSTEM OVERVIEW</p>
          <h2 className="mt-1 text-base font-semibold text-white">
            Service health
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewCard
            title="Frontend"
            value="Running"
            description={`Vite ${frontendMode} environment`}
            icon={Globe}
            state="success"
          />

          <OverviewCard
            title="Backend API"
            value={
              healthState === "success"
                ? "Online"
                : healthState === "error"
                  ? "Offline"
                  : "Checking"
            }
            description="Spring Boot health endpoint"
            icon={Server}
            state={healthState}
          />

          <OverviewCard
            title="Blockchain RPC"
            value={
              blockchainState === "success"
                ? "Connected"
                : blockchainState === "error"
                  ? "Unavailable"
                  : "Checking"
            }
            description="Configured Web3j connection"
            icon={Activity}
            state={blockchainState}
          />

          <OverviewCard
            title="Safe Guard"
            value={
              guardInstalled ? "Installed" : "Not confirmed"
            }
            description="Guard installation check"
            icon={ShieldCheck}
            state={
              blockchain
                ? guardInstalled
                  ? "success"
                  : "error"
                : "checking"
            }
          />
        </div>
      </section>

      {/* ERRORS */}
      {errors.length > 0 && (
        <section className="rounded-xl border border-rose-400/15 bg-rose-400/[0.04] p-4">
          <div className="flex items-center gap-2">
            <AlertCircle
              size={17}
              className="text-rose-300"
            />
            <p className="text-xs font-semibold text-rose-300">
              Diagnostic warnings
            </p>
          </div>

          <div className="mt-3 space-y-2">
            {errors.map((error, index) => (
              <p
                key={index}
                className="break-words text-xs leading-5 text-slate-400"
              >
                {error}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* APPLICATION CONFIGURATION */}
      <section className="panel p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] p-2.5 text-emerald-300">
            <Settings2 size={19} />
          </div>

          <div>
            <p className="eyebrow">APPLICATION</p>
            <h2 className="mt-1 text-base font-semibold text-white">
              Frontend configuration
            </h2>
          </div>
        </div>

        <div className="mt-4">
          <ConfigRow
            label="Application"
            value="TrueSign"
            description="Frontend application name"
          />

          <ConfigRow
            label="Frontend mode"
            value={frontendMode}
            description="Vite build environment"
          />

          <ConfigRow
            label="Frontend origin"
            value={window.location.origin}
            description="Current browser origin"
            copyable
          />

          <ConfigRow
            label="Backend API base URL"
            value={API_BASE}
            description="VITE_API_BASE_URL or frontend fallback"
            copyable
          />
        </div>
      </section>

      {/* BACKEND */}
      <section className="panel p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.07] p-2.5 text-sky-300">
            <Server size={19} />
          </div>

          <div>
            <p className="eyebrow">BACKEND SERVICE</p>
            <h2 className="mt-1 text-base font-semibold text-white">
              Backend diagnostics
            </h2>
          </div>

          <div className="ml-auto">
            <StateBadge state={healthState} />
          </div>
        </div>

        <div className="mt-4">
          <ConfigRow
            label="Application name"
            value={backendApplication}
          />

          <ConfigRow
            label="Health status"
            value={health?.status || "Unknown"}
          />

          <ConfigRow
            label="Health endpoint"
            value={`${API_BASE}/api/health`}
            copyable
          />

          <ConfigRow
            label="Last diagnostic check"
            value={
              lastChecked
                ? new Date(lastChecked).toLocaleString()
                : "Not checked"
            }
          />
        </div>
      </section>

      {/* BLOCKCHAIN */}
      <section className="panel p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] p-2.5 text-emerald-300">
            <Database size={19} />
          </div>

          <div>
            <p className="eyebrow">BLOCKCHAIN ENVIRONMENT</p>
            <h2 className="mt-1 text-base font-semibold text-white">
              Network configuration
            </h2>
          </div>

          <div className="ml-auto">
            <StateBadge
              state={blockchainState}
              label={
                blockchainState === "success"
                  ? blockchain?.status || "Connected"
                  : undefined
              }
            />
          </div>
        </div>

        <div className="mt-4">
          <ConfigRow
            label="Connected chain ID"
            value={String(blockchain?.chainId ?? "Unavailable")}
          />

          <ConfigRow
            label="Expected chain ID"
            value={String(
              blockchain?.expectedChainId ?? "Unavailable"
            )}
          />

          <ConfigRow
            label="Network compatibility"
            value={
              blockchain
                ? correctNetwork
                  ? "Correct network"
                  : "Network mismatch"
                : "Unavailable"
            }
          />

          <ConfigRow
            label="Latest block"
            value={String(blockchain?.latestBlock ?? "Unavailable")}
          />

          <ConfigRow
            label="Blockchain status endpoint"
            value={`${API_BASE}/api/blockchain/status`}
            copyable
          />
        </div>
      </section>

      {/* DEPLOYMENT */}
      <section className="panel p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] p-2.5 text-emerald-300">
            <ShieldCheck size={19} />
          </div>

          <div>
            <p className="eyebrow">DEPLOYMENT STATUS</p>
            <h2 className="mt-1 text-base font-semibold text-white">
              Smart contract infrastructure
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Contracts detected
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {blockchain ? `${contractCount}/4` : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Guard installed
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {blockchain
                ? guardInstalled
                  ? "Yes"
                  : "No"
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Deployment readiness
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {blockchain
                ? deploymentReady
                  ? "Ready"
                  : "Check required"
                : "—"}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[11px] leading-5 text-slate-500">
          Deployment readiness reflects the backend's configured
          chain, contract-existence and Guard-installation checks.
          It does not certify production security.
        </p>
      </section>

      {/* ENVIRONMENT SAFETY */}
      <section className="rounded-xl border border-amber-400/15 bg-amber-400/[0.035] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Info
            size={18}
            className="mt-0.5 shrink-0 text-amber-300"
          />

          <div>
            <p className="text-xs font-semibold text-amber-200">
              Configuration and security notice
            </p>

            <p className="mt-2 text-xs leading-6 text-slate-400">
              This page is read-only. It does not expose private keys,
              verifier signing keys, database credentials or other
              secrets. Backend configuration changes must be made
              through your secured server environment, not through
              browser-visible settings.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-2">
          <Terminal size={12} />
          TrueSign System Diagnostics
        </span>

        <span className="flex items-center gap-2">
          <Clock3 size={12} />
          {lastChecked
            ? `Updated ${new Date(lastChecked).toLocaleTimeString()}`
            : "Awaiting diagnostics"}
        </span>
      </div>
    </div>
  );
}
