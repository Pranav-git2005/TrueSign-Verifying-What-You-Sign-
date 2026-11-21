import { useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  FileSearch,
  Fuel,
  Hash,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api, getApiErrorMessage } from "../lib/api";

interface ProofBundleResponse {
  proofId: string;
  passportId: string;
  passportHash: string;
  overallVerdict: string;
  proofPayload: string;
  createdAt: string;
}

interface ExecutionReceipt {
  transactionHash?: string;
  blockNumber?: string | number | null;
  successful?: boolean;
  status?: string;
  gasUsed?: string | number | null;
  executedAt?: string | null;
  outcome?: string;
  recordedAt?: string;
}

interface ExecutionAttachResponse {
  state: string;
  message: string;
  transactionHash?: string;
  successful?: boolean | null;
  proofBundle?: ProofBundleResponse | null;
}

interface ProofPayload {
  executionReceipt?: ExecutionReceipt;
  [key: string]: unknown;
}

function parseProofPayload(payload: string): ProofPayload | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (parsed && typeof parsed === "object") {
      return parsed as ProofPayload;
    }
    return null;
  } catch {
    return null;
  }
}

function shorten(value?: string | null, size = 12) {
  if (!value) return "—";
  if (value.length <= size * 2) return value;
  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

function formatNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : String(value);
}

function StatusPill({ successful }: { successful: boolean }) {
  return successful ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
      <CheckCircle2 size={13} /> EXECUTED SUCCESSFULLY
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-300">
      <XCircle size={13} /> EXECUTION FAILED
    </span>
  );
}

function DetailCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Hash;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-3 break-all text-lg font-semibold text-slate-100">
        {value}
      </p>
    </div>
  );
}

export default function TransactionIntelligence() {
  const [passportId, setPassportId] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [proof, setProof] = useState<ProofBundleResponse | null>(null);
  const [receipt, setReceipt] = useState<ExecutionReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"attach" | "load" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProof = async (id: string) => {
    const response = await api.get<ProofBundleResponse>(
      `/api/proofs/${encodeURIComponent(id)}`
    );

    const data = response.data;
    setProof(data);

    const payload = parseProofPayload(data.proofPayload);
    const savedReceipt = payload?.executionReceipt ?? null;
    setReceipt(savedReceipt);

    return savedReceipt;
  };

  const handleLoadProof = async () => {
    if (!passportId.trim()) {
      setError("Enter a passport ID first.");
      return;
    }

    setLoading(true);
    setAction("load");
    setError("");
    setNotice("");

    try {
      const savedReceipt = await loadProof(passportId.trim());

      if (savedReceipt) {
        setNotice("Existing proof bundle and execution receipt loaded.");
      } else {
        setNotice(
          "Proof bundle loaded. No execution receipt is attached yet."
        );
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
      setProof(null);
      setReceipt(null);
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const handleAttachReceipt = async () => {
    const id = passportId.trim();
    const hash = transactionHash.trim();

    if (!id || !hash) {
      setError("Passport ID and transaction hash are required.");
      return;
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      setError("Enter a valid 32-byte transaction hash beginning with 0x.");
      return;
    }

    setLoading(true);
    setAction("attach");
    setError("");
    setNotice("");

    try {
      const response = await api.post<ExecutionAttachResponse>(
        `/api/proofs/${encodeURIComponent(id)}/execution`,
        { transactionHash: hash }
      );

      const outcome = response.data;
      if (outcome.state === "PENDING") {
        setNotice(outcome.message || "Transaction is pending. Retry after it is mined.");
        setReceipt(null);
        // Refresh proof data, but do not treat an absent receipt as an error.
        try { await loadProof(id); } catch { /* The pending state remains authoritative. */ }
      } else if (outcome.state === "MINED_SUCCESS" || outcome.state === "MINED_FAILED") {
        if (outcome.proofBundle) {
          setProof(outcome.proofBundle);
          const payload = parseProofPayload(outcome.proofBundle.proofPayload);
          setReceipt(payload?.executionReceipt ?? null);
        } else {
          await loadProof(id);
        }
        setNotice(outcome.message);
      } else {
        setNotice(outcome.message || `Receipt lookup state: ${outcome.state}`);
      }
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      setNotice("");
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const copyValue = async (value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied to clipboard.");
    } catch {
      setError("Unable to copy. Select and copy the value manually.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <Activity size={13} className="text-emerald-400" />
            TRANSACTION SECURITY
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
            Transaction Intelligence
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Inspect blockchain execution receipts and connect confirmed
            transactions to their TrueSign passport proof bundles.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-400">
          <Database size={15} className="text-emerald-400" />
          Backend-linked data
        </div>
      </div>

      <div className="panel space-y-5 p-5">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
            <FileSearch size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Execution receipt lookup
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              A receipt is retrieved through its associated passport.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-400">
              PASSPORT ID
            </span>
            <input
              value={passportId}
              onChange={(event) => setPassportId(event.target.value)}
              placeholder="Enter TrueSign passport ID"
              className="w-full rounded-xl border border-white/10 bg-[#090f19] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-400/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-400">
              TRANSACTION HASH
            </span>
            <input
              value={transactionHash}
              onChange={(event) => setTransactionHash(event.target.value)}
              placeholder="0x..."
              spellCheck={false}
              className="w-full rounded-xl border border-white/10 bg-[#090f19] px-4 py-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-400/50"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleLoadProof}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && action === "load" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            Load existing proof
          </button>

          <button
            type="button"
            onClick={handleAttachReceipt}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && action === "attach" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ShieldCheck size={16} />
            )}
            Retrieve and attach receipt
            <ArrowUpRight size={15} />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.07] p-3 text-sm text-red-300">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && !error && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-sm text-emerald-300">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
      </div>

      {proof && (
        <div className="panel space-y-5 p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="eyebrow">PASSPORT PROOF BUNDLE</div>
              <h2 className="mt-2 text-base font-semibold text-white">
                Execution record
              </h2>
            </div>
            <span className="w-fit rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300">
              {proof.overallVerdict || "VERDICT UNAVAILABLE"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DetailCard
              label="PROOF ID"
              value={shorten(proof.proofId, 9)}
              icon={Hash}
            />
            <DetailCard
              label="PASSPORT ID"
              value={shorten(proof.passportId, 9)}
              icon={FileSearch}
            />
            <DetailCard
              label="PROOF CREATED"
              value={formatDate(proof.createdAt)}
              icon={Clock3}
            />
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-[#090f19] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Passport hash
              </span>
              <button
                type="button"
                onClick={() => copyValue(proof.passportHash)}
                className="text-slate-500 transition hover:text-emerald-300"
                title="Copy passport hash"
              >
                <Copy size={15} />
              </button>
            </div>
            <p className="break-all font-mono text-xs leading-6 text-slate-300">
              {proof.passportHash || "Not available"}
            </p>
          </div>

          {receipt ? (
            <div className="space-y-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="eyebrow">ON-CHAIN EXECUTION</div>
                  <h3 className="mt-1 text-sm font-semibold text-white">
                    Transaction receipt
                  </h3>
                </div>
                {typeof receipt.successful === "boolean" ? (
                  <StatusPill successful={receipt.successful} />
                ) : (
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
                    STATUS UNAVAILABLE
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <DetailCard
                  label="BLOCK NUMBER"
                  value={formatNumber(receipt.blockNumber)}
                  icon={Hash}
                />
                <DetailCard
                  label="GAS USED"
                  value={formatNumber(receipt.gasUsed)}
                  icon={Fuel}
                />
                <DetailCard
                  label="RECEIPT STATUS"
                  value={receipt.status || "—"}
                  icon={Activity}
                />
                <DetailCard
                  label="EXECUTED AT"
                  value={formatDate(receipt.executedAt)}
                  icon={Clock3}
                />
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-[#090f19] p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Transaction hash
                  </span>
                  <button
                    type="button"
                    onClick={() => copyValue(receipt.transactionHash)}
                    className="text-slate-500 transition hover:text-emerald-300"
                    title="Copy transaction hash"
                  >
                    <Copy size={15} />
                  </button>
                </div>
                <p className="break-all font-mono text-xs leading-6 text-emerald-300">
                  {receipt.transactionHash || "Not available"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <CheckCircle2 size={14} className="text-emerald-400" />
                Receipt recorded in proof bundle
                {receipt.recordedAt && (
                  <span>· {formatDate(receipt.recordedAt)}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-5 py-10 text-center">
              <Clock3 size={25} className="text-amber-400" />
              <h3 className="mt-3 text-sm font-semibold text-slate-200">
                No execution receipt attached
              </h3>
              <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">
                This proof bundle does not currently contain an execution
                receipt. Enter the transaction hash above and use
                Retrieve and attach receipt to check its on-chain status.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
            <button
              type="button"
              onClick={handleLoadProof}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={13} />
              Refresh proof
            </button>
            <button
              type="button"
              onClick={() => copyValue(proof.proofPayload)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              <Copy size={13} />
              Copy proof JSON
            </button>
          </div>
        </div>
      )}

      {!proof && !loading && (
        <div className="panel flex min-h-56 flex-col items-center justify-center p-8 text-center">
          <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.05] p-4">
            <Search size={25} className="text-emerald-400" />
          </div>
          <h2 className="mt-4 text-sm font-semibold text-slate-200">
            Ready to inspect a transaction
          </h2>
          <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
            Enter a passport ID to load its proof bundle, or provide a
            transaction hash to retrieve and attach its execution receipt.
            Results are supplied by the TrueSign backend.
          </p>
        </div>
      )}
    </div>
  );
}

