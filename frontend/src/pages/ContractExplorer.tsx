
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Blocks,
  CheckCircle2,
  CircleHelp,
  Copy,
  ExternalLink,
  FileCode2,
  Fingerprint,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";

import { api, getApiErrorMessage } from "../lib/api";

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
  checkedAt?: string;
}

interface ContractInfo {
  name: string;
  description: string;
  address?: string;
  exists?: boolean;
  icon: typeof Shield;
  extra?: string;
}

function StatusBadge({ ok }: { ok?: boolean }) {
  if (ok === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-400">
        <CircleHelp size={12} />
        Unknown
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
        ok
          ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300"
          : "border-rose-400/20 bg-rose-400/[0.07] text-rose-300"
      }`}
    >
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {ok ? "Verified on RPC" : "Not detected"}
    </span>
  );
}

function ContractCard({
  contract,
}: {
  contract: ContractInfo;
}) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!contract.address) return;

    try {
      await navigator.clipboard.writeText(contract.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className="panel p-5 transition hover:border-emerald-400/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] p-2.5 text-emerald-300">
            <contract.icon size={19} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              {contract.name}
            </h3>
            <p className="mt-1 text-[11px] text-slate-500">
              {contract.description}
            </p>
          </div>
        </div>

        <StatusBadge ok={contract.exists} />
      </div>

      <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-3">
        <p className="text-[9px] font-semibold tracking-wider text-slate-500">
          CONTRACT ADDRESS
        </p>

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="min-w-0 break-all font-mono text-xs text-slate-300">
            {contract.address || "Address unavailable"}
          </p>

          <button
            onClick={copyAddress}
            disabled={!contract.address}
            title="Copy contract address"
            className="shrink-0 rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-emerald-400/20 hover:text-emerald-300 disabled:opacity-30"
          >
            <Copy size={14} />
          </button>
        </div>

        {copied && (
          <p className="mt-2 text-[10px] text-emerald-300">
            Address copied
          </p>
        )}
      </div>

      {contract.extra && (
        <p className="mt-3 text-[11px] text-slate-500">
          {contract.extra}
        </p>
      )}
    </article>
  );
}

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Blocks;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{label}</p>
        <Icon size={17} className="text-emerald-300" />
      </div>

      <p className="mt-4 break-all text-xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

export default function ContractExplorer() {
  const [data, setData] = useState<BlockchainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const response = await api.get<BlockchainStatus>(
        "/api/blockchain/status"
      );

      setData(response.data);
      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const refresh = () => {
    setRefreshing(true);
    void loadStatus();
  };

  const contracts: ContractInfo[] = [
    {
      name: "Safe Proxy",
      description: "Smart account proxy",
      address: data?.safeAddress,
      exists: data?.safeExists,
      icon: Wallet,
    },
    {
      name: "TrueSign Guard",
      description: "Transaction enforcement contract",
      address: data?.guardAddress,
      exists: data?.guardExists,
      icon: ShieldCheck,
      extra: data?.guardInstalled
        ? "Guard is installed on the Safe."
        : "Guard installation has not been confirmed.",
    },
    {
      name: "Payee Registry",
      description: "Registered payee contract",
      address: data?.payeeRegistryAddress,
      exists: data?.payeeRegistryExists,
      icon: Fingerprint,
    },
    {
      name: "MockERC20 Token",
      description: "Local test ERC20 token",
      address: data?.tokenAddress,
      exists: data?.tokenExists,
      icon: FileCode2,
      extra: "Test token for the local prototype. Not real USDC or QUAI.",
    },
  ];

  const connected = data?.connected === true;
  const correctNetwork = data?.correctNetwork === true;



  const deploymentCount = [
    data?.safeExists,
    data?.guardExists,
    data?.payeeRegistryExists,
    data?.tokenExists,
  ].filter(Boolean).length;

  if (loading) {
    return (
      <div className="panel flex min-h-72 flex-col items-center justify-center p-8">
        <Loader2
          size={30}
          className="animate-spin text-emerald-300"
        />
        <p className="mt-4 text-sm font-semibold text-white">
          Loading contract information
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Connecting to the TrueSign blockchain status API.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* HEADER */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-[#10251F] via-[#101B20] to-[#111827] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full border border-emerald-300/10" />

        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1.5">
              <Blocks size={12} className="text-emerald-300" />
              <span className="text-[10px] font-semibold tracking-wider text-emerald-200">
                ON-CHAIN INFRASTRUCTURE
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Contract Explorer
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Inspect deployed TrueSign contracts, blockchain
              connectivity, Safe Guard installation and network
              configuration.
            </p>
          </div>

          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-300/[0.14] disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh contracts
          </button>
        </div>
      </section>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.05] p-4">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0 text-rose-300"
          />
          <div>
            <p className="text-xs font-semibold text-rose-300">
              Unable to retrieve blockchain status
            </p>
            <p className="mt-2 break-words text-xs leading-5 text-slate-400">
              {error}
            </p>
          </div>
        </div>
      )}

      {data?.connected === false && data.rpcError && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
          <p className="text-xs font-semibold text-amber-200">Blockchain RPC unavailable</p>
          <p className="mt-2 break-words text-xs leading-5 text-slate-400">{data.rpcError}</p>
        </div>
      )}

      {/* NETWORK */}
      <section>
        <div className="mb-4">
          <p className="eyebrow">NETWORK OVERVIEW</p>
          <h2 className="mt-1 text-base font-semibold text-white">
            Blockchain connection
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            label="Connection"
            value={
              connected ? "Connected" : "Disconnected"
            }
            icon={Activity}
          />

          <InfoCard
            label="Chain ID"
            value={String(data?.chainId ?? "—")}
            icon={Blocks}
          />

          <InfoCard
            label="Latest Block"
            value={String(data?.latestBlock ?? "—")}
            icon={FileCode2}
          />

          <InfoCard
            label="Contracts Detected"
            value={`${deploymentCount}/4`}
            icon={Shield}
          />
        </div>

        <div className="panel mt-4 flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="text-xs font-semibold text-white">
              Network compatibility
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Actual chain ID compared with configured expected chain ID.
            </p>
          </div>

          <StatusBadge ok={correctNetwork} />
        </div>
      </section>

      {/* CONTRACTS */}
      <section>
        <div className="mb-4">
          <p className="eyebrow">DEPLOYED CONTRACTS</p>
          <h2 className="mt-1 text-base font-semibold text-white">
            TrueSign contract registry
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Addresses are retrieved from the backend. No contract
            addresses are hardcoded in this page.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {contracts.map((contract) => (
            <ContractCard
              key={contract.name}
              contract={contract}
            />
          ))}
        </div>
      </section>

      {/* GUARD */}
      <section className="panel p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] p-2.5 text-emerald-300">
            <ShieldCheck size={19} />
          </div>

          <div>
            <p className="eyebrow">SAFE SECURITY</p>
            <h2 className="mt-1 text-base font-semibold text-white">
              Guard installation status
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Configured Guard
            </p>
            <p className="mt-2 break-all font-mono text-xs text-slate-300">
              {data?.guardAddress || "Unavailable"}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Installed Guard
            </p>
            <p className="mt-2 break-all font-mono text-xs text-slate-300">
              {data?.installedGuardAddress || "Unavailable"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div>
            <p className="text-xs font-semibold text-white">
              Safe Guard installation
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Based on the backend's installedGuardAddress check.
            </p>
          </div>

          <StatusBadge ok={data?.guardInstalled} />
        </div>

        {data?.installedGuardAddress &&
          data?.guardAddress &&
          data.installedGuardAddress.toLowerCase() !==
            data.guardAddress.toLowerCase() && (
            <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.05] p-3 text-xs text-rose-300">
              Warning: The installed Guard address does not match
              the configured Guard address.
            </div>
          )}
      </section>

      {/* FOOTER */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <ExternalLink size={12} />
        Live data from GET /api/blockchain/status
      </div>
    </div>
  );
}
