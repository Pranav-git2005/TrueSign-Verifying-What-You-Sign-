import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Blocks,
  Camera,
  CheckCircle2,
  Clock3,
  Copy,
  Fingerprint,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Timer,
  Wallet,
  XCircle,
} from "lucide-react";
import { api, getApiErrorMessage } from "../lib/api";

interface SnapshotDto {
  id: string;
  passportId: string;
  snapshotType: string;
  capturedAtEpochMs: number;
  blockNumber: string;
  accountAddress: string;
  intendedRecipient: string;
  tokenAddress: string;
  targetContractAddress: string;
  accountNativeBalanceWei: string;
  recipientNativeBalanceWei: string;
  accountTokenBalance: string;
  recipientTokenBalance: string;
  targetCodeHash: string;
  payeeRegistered: boolean;
  payeeReady: boolean;
  readyAtEpochSeconds: number;
  remainingCooldownSeconds: number;
}

function formatDate(epochMs: number) {
  if (!epochMs) return "Not available";
  const date = new Date(epochMs);
  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : date.toLocaleString();
}

function shorten(value?: string, size = 12) {
  if (!value) return "—";
  if (value.length <= size * 2) return value;
  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

function formatValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon size={14} />
        {label}
      </div>
      <div className="mt-3 break-all text-lg font-semibold text-slate-100">
        {value}
      </div>
    </div>
  );
}

function BooleanStatus({
  label,
  value,
}: {
  label: string;
  value: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
      <span className="text-xs text-slate-400">{label}</span>
      {value ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
          <CheckCircle2 size={14} /> YES
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-300">
          <XCircle size={14} /> NO
        </span>
      )}
    </div>
  );
}

export default function SnapshotInspector() {
  const [passportId, setPassportId] = useState("");
  const [snapshots, setSnapshots] = useState<SnapshotDto[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === selectedId) ?? null,
    [snapshots, selectedId]
  );

  const orderedSnapshots = useMemo(
    () =>
      [...snapshots].sort(
        (a, b) => b.capturedAtEpochMs - a.capturedAtEpochMs
      ),
    [snapshots]
  );

  const loadSnapshots = async (id: string) => {
    const response = await api.get<SnapshotDto[]>(
      `/api/passports/${encodeURIComponent(id)}/snapshots`
    );

    const data = Array.isArray(response.data) ? response.data : [];
    setSnapshots(data);

    if (data.length > 0) {
      setSelectedId((current) =>
        data.some((snapshot) => snapshot.id === current)
          ? current
          : [...data].sort(
              (a, b) => b.capturedAtEpochMs - a.capturedAtEpochMs
            )[0].id
      );
    } else {
      setSelectedId("");
    }

    return data;
  };

  const handleLoad = async () => {
    const id = passportId.trim();

    if (!id) {
      setError("Enter a passport ID first.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const data = await loadSnapshots(id);
      setNotice(
        data.length
          ? `${data.length} snapshot record(s) loaded from the backend.`
          : "No snapshots are recorded for this passport yet."
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSnapshots([]);
      setSelectedId("");
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async () => {
    const id = passportId.trim();

    if (!id) {
      setError("Enter a passport ID before capturing a snapshot.");
      return;
    }

    setCapturing(true);
    setError("");
    setNotice("");

    try {
      const response = await api.post<SnapshotDto>(
        `/api/passports/${encodeURIComponent(id)}/snapshots`,
        null,
        { params: { type: "LIVE" } }
      );

      const captured = response.data;

      if (captured?.id) {
        setSnapshots((current) => {
          const withoutDuplicate = current.filter(
            (item) => item.id !== captured.id
          );
          return [captured, ...withoutDuplicate];
        });
        setSelectedId(captured.id);
        setNotice("Live snapshot captured successfully.");
      } else {
        await loadSnapshots(id);
        setNotice("Capture request completed. Snapshot history refreshed.");
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setCapturing(false);
    }
  };

  const copyValue = async (value?: string) => {
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
      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <Activity size={13} className="text-emerald-400" />
            BLOCKCHAIN STATE MONITORING
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
            Snapshot Inspector
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Inspect recorded blockchain state snapshots for a passport.
            Capture a new LIVE snapshot and review balances, contract
            identity, payee readiness and cooldown information.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-400">
          <Blocks size={15} className="text-emerald-400" />
          Live backend integration
        </div>
      </div>

      {/* SEARCH AND ACTIONS */}
      <div className="panel space-y-5 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
            <Fingerprint size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Passport snapshot controls
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Load history or request a fresh LIVE capture.
            </p>
          </div>
        </div>

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

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleLoad}
            disabled={loading || capturing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            Load snapshot history
          </button>

          <button
            type="button"
            onClick={handleCapture}
            disabled={loading || capturing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {capturing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Camera size={16} />
            )}
            Capture LIVE snapshot
          </button>

          <button
            type="button"
            onClick={handleLoad}
            disabled={loading || capturing || !passportId.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={15} />
            Refresh
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

      {/* HISTORY */}
      {snapshots.length > 0 && (
        <div className="panel space-y-4 p-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <div className="eyebrow">RECORDED SNAPSHOTS</div>
              <h2 className="mt-1 text-base font-semibold text-white">
                Snapshot history
              </h2>
            </div>
            <span className="w-fit rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
              {snapshots.length} record(s)
            </span>
          </div>

          <div className="space-y-2">
            {orderedSnapshots.map((snapshot, index) => {
              const active = snapshot.id === selectedId;

              return (
                <button
                  key={snapshot.id}
                  type="button"
                  onClick={() => setSelectedId(snapshot.id)}
                  className={`flex w-full flex-col justify-between gap-3 rounded-xl border p-4 text-left transition sm:flex-row sm:items-center ${
                    active
                      ? "border-emerald-400/30 bg-emerald-400/[0.07]"
                      : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`rounded-lg p-2 ${
                        active
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-white/[0.05] text-slate-500"
                      }`}
                    >
                      <Camera size={17} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-200">
                          {snapshot.snapshotType || "SNAPSHOT"}
                        </span>
                        {index === 0 && (
                          <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            LATEST
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(snapshot.capturedAtEpochMs)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>Block {snapshot.blockNumber || "—"}</span>
                    <span className="font-mono">
                      {shorten(snapshot.id, 7)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SELECTED SNAPSHOT DETAILS */}
      {selectedSnapshot && (
        <div className="space-y-5">
          <div className="panel space-y-5 p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="eyebrow">SELECTED SNAPSHOT</div>
                <h2 className="mt-1 text-base font-semibold text-white">
                  Blockchain state details
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Captured {formatDate(selectedSnapshot.capturedAtEpochMs)}
                </p>
              </div>
              <span className="w-fit rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                {selectedSnapshot.snapshotType}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="BLOCK NUMBER"
                value={formatValue(selectedSnapshot.blockNumber)}
                icon={Blocks}
              />
              <Metric
                label="ACCOUNT NATIVE BALANCE (WEI)"
                value={formatValue(selectedSnapshot.accountNativeBalanceWei)}
                icon={Wallet}
              />
              <Metric
                label="RECIPIENT NATIVE BALANCE (WEI)"
                value={formatValue(selectedSnapshot.recipientNativeBalanceWei)}
                icon={Wallet}
              />
              <Metric
                label="REMAINING COOLDOWN (SECONDS)"
                value={formatValue(selectedSnapshot.remainingCooldownSeconds)}
                icon={Timer}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="ACCOUNT TOKEN BALANCE"
                value={formatValue(selectedSnapshot.accountTokenBalance)}
                icon={Wallet}
              />
              <Metric
                label="RECIPIENT TOKEN BALANCE"
                value={formatValue(selectedSnapshot.recipientTokenBalance)}
                icon={Wallet}
              />
            </div>
          </div>

          <div className="panel space-y-4 p-5">
            <div>
              <div className="eyebrow">ADDRESS INTELLIGENCE</div>
              <h2 className="mt-1 text-base font-semibold text-white">
                Account and contract identities
              </h2>
            </div>

            {[
              ["Account address", selectedSnapshot.accountAddress],
              ["Intended recipient", selectedSnapshot.intendedRecipient],
              ["Token address", selectedSnapshot.tokenAddress],
              ["Target contract", selectedSnapshot.targetContractAddress],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/[0.07] bg-[#090f19] p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">{label}</span>
                  <button
                    type="button"
                    onClick={() => copyValue(value)}
                    disabled={!value}
                    className="text-slate-500 transition hover:text-emerald-300 disabled:opacity-30"
                    title={`Copy ${label}`}
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <p className="break-all font-mono text-xs leading-6 text-slate-300">
                  {value || "Not available"}
                </p>
              </div>
            ))}

            <div className="rounded-xl border border-white/[0.07] bg-[#090f19] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Target contract code hash
                </span>
                <button
                  type="button"
                  onClick={() => copyValue(selectedSnapshot.targetCodeHash)}
                  disabled={!selectedSnapshot.targetCodeHash}
                  className="text-slate-500 transition hover:text-emerald-300 disabled:opacity-30"
                  title="Copy code hash"
                >
                  <Copy size={14} />
                </button>
              </div>
              <p className="break-all font-mono text-xs leading-6 text-slate-300">
                {selectedSnapshot.targetCodeHash || "Not available"}
              </p>
            </div>
          </div>

          <div className="panel space-y-4 p-5">
            <div>
              <div className="eyebrow">PAYEE SECURITY STATUS</div>
              <h2 className="mt-1 text-base font-semibold text-white">
                Registration and readiness
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Values reported by the selected backend snapshot.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <BooleanStatus
                label="Payee registered"
                value={selectedSnapshot.payeeRegistered}
              />
              <BooleanStatus
                label="Payee ready"
                value={selectedSnapshot.payeeReady}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="READY AT (EPOCH SECONDS)"
                value={formatValue(selectedSnapshot.readyAtEpochSeconds)}
                icon={Clock3}
              />
              <Metric
                label="REMAINING COOLDOWN (SECONDS)"
                value={formatValue(selectedSnapshot.remainingCooldownSeconds)}
                icon={ShieldCheck}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyValue(JSON.stringify(selectedSnapshot, null, 2))}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              <Copy size={13} />
              Copy snapshot JSON
            </button>
            <button
              type="button"
              onClick={handleLoad}
              disabled={loading || capturing}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={13} />
              Refresh history
            </button>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {snapshots.length === 0 && !loading && (
        <div className="panel flex min-h-56 flex-col items-center justify-center p-8 text-center">
          <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.05] p-4">
            <Camera size={25} className="text-emerald-400" />
          </div>
          <h2 className="mt-4 text-sm font-semibold text-slate-200">
            No snapshot selected
          </h2>
          <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
            Enter a passport ID and load its snapshot history. If no
            snapshots exist, use Capture LIVE snapshot to request one
            from the backend.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
          <Loader2 size={15} className="animate-spin" />
          Loading snapshot history...
        </div>
      )}
    </div>
  );
}
