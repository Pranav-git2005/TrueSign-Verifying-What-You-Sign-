import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileCheck2,
  FileJson,
  Fingerprint,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
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

function formatDate(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

function shorten(value?: string, size = 12) {
  if (!value) return "—";
  if (value.length <= size * 2) return value;
  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

function parsePayload(value?: string): unknown {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getObjectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value);
}

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof FileCheck2;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-3 break-all text-base font-semibold text-slate-100">
        {value}
      </p>
    </div>
  );
}

function EvidenceIndicator({
  label,
  present,
}: {
  label: string;
  present: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
      <span className="text-xs text-slate-400">{label}</span>
      {present ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
          <CheckCircle2 size={14} /> PRESENT
        </span>
      ) : (
        <span className="text-xs font-medium text-slate-500">
          NOT FOUND
        </span>
      )}
    </div>
  );
}

export default function ProofExplorer() {
  const [passportId, setPassportId] = useState("");
  const [proof, setProof] = useState<ProofBundleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const parsedPayload = useMemo(
    () => parsePayload(proof?.proofPayload),
    [proof?.proofPayload]
  );

  const payloadKeys = useMemo(
    () => getObjectKeys(parsedPayload),
    [parsedPayload]
  );

  const payloadText = useMemo(() => {
    if (!proof?.proofPayload) return "";
    if (parsedPayload !== null) {
      return JSON.stringify(parsedPayload, null, 2);
    }
    return proof.proofPayload;
  }, [proof?.proofPayload, parsedPayload]);

  const payloadLower = payloadText.toLowerCase();

  const hasExecutionEvidence =
    payloadLower.includes("executionreceipt") ||
    payloadLower.includes("execution_receipt");

  const hasAttestationEvidence =
    payloadLower.includes("attestation") ||
    payloadLower.includes("quorumsignature");

  const hasSafeEvidence =
    payloadLower.includes("safe") ||
    payloadLower.includes("authorization");

  const loadProof = async () => {
    const id = passportId.trim();

    if (!id) {
      setError("Enter a passport ID first.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await api.get<ProofBundleResponse>(
        `/api/proofs/${encodeURIComponent(id)}`
      );

      setProof(response.data);
      setNotice("Latest proof bundle loaded from the TrueSign backend.");
    } catch (err) {
      setProof(null);
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (value: string) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied to clipboard.");
      setError("");
    } catch {
      setError("Unable to copy. Select and copy the text manually.");
    }
  };

  const downloadJson = () => {
    if (!proof) return;

    const content = JSON.stringify(
      {
        proofId: proof.proofId,
        passportId: proof.passportId,
        passportHash: proof.passportHash,
        overallVerdict: proof.overallVerdict,
        createdAt: proof.createdAt,
        proofPayload: parsedPayload ?? proof.proofPayload,
      },
      null,
      2
    );

    const blob = new Blob([content], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `truesign-proof-${proof.passportId || "bundle"}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
    setNotice("Proof JSON export generated.");
  };

  const verdict = proof?.overallVerdict?.toUpperCase() || "";

  const verdictClass =
    verdict === "GREEN" || verdict === "PASS" || verdict === "PASSED"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : verdict === "RED" || verdict === "FAIL" || verdict === "FAILED"
        ? "border-red-400/20 bg-red-400/10 text-red-300"
        : "border-amber-400/20 bg-amber-400/10 text-amber-300";

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <ShieldCheck size={13} className="text-emerald-400" />
            EVIDENCE AND AUDIT
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
            Proof Explorer
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Inspect the latest TrueSign proof bundle, review its
            verification metadata and examine the evidence recorded
            in its proof payload.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-400">
          <FileJson size={15} className="text-emerald-400" />
          Backend proof records
        </div>
      </div>

      {/* SEARCH */}
      <div className="panel space-y-5 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
            <Fingerprint size={18} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Retrieve proof bundle
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Search using the passport ID associated with the proof.
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
            onKeyDown={(event) => {
              if (event.key === "Enter" && !loading) {
                void loadProof();
              }
            }}
            placeholder="Enter TrueSign passport ID"
            className="w-full rounded-xl border border-white/10 bg-[#090f19] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-400/50"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={loadProof}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            Retrieve proof bundle
          </button>

          <button
            type="button"
            onClick={loadProof}
            disabled={loading || !passportId.trim()}
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

      {/* PROOF METADATA */}
      {proof && (
        <>
          <div className="panel space-y-5 p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="eyebrow">PROOF BUNDLE METADATA</div>
                <h2 className="mt-1 text-base font-semibold text-white">
                  Retrieved proof record
                </h2>
              </div>

              <span
                className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${verdictClass}`}
              >
                {proof.overallVerdict || "VERDICT NOT AVAILABLE"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <InfoCard
                label="PROOF ID"
                value={shorten(proof.proofId, 9)}
                icon={FileCheck2}
              />

              <InfoCard
                label="PASSPORT ID"
                value={shorten(proof.passportId, 9)}
                icon={Fingerprint}
              />

              <InfoCard
                label="CREATED AT"
                value={formatDate(proof.createdAt)}
                icon={Clock3}
              />
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-[#090f19] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Passport hash
                </span>

                <button
                  type="button"
                  onClick={() => copyText(proof.passportHash || "")}
                  disabled={!proof.passportHash}
                  className="text-slate-500 transition hover:text-emerald-300 disabled:opacity-30"
                  title="Copy passport hash"
                >
                  <Copy size={15} />
                </button>
              </div>

              <p className="break-all font-mono text-xs leading-6 text-slate-300">
                {proof.passportHash || "Not available"}
              </p>
            </div>
          </div>

          {/* EVIDENCE PRESENCE */}
          <div className="panel space-y-4 p-5">
            <div>
              <div className="eyebrow">PAYLOAD EVIDENCE INSPECTION</div>
              <h2 className="mt-1 text-base font-semibold text-white">
                Evidence field indicators
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                These indicators only detect matching field names or
                keywords in the returned payload. They do not independently
                validate cryptographic signatures or on-chain execution.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <EvidenceIndicator
                label="Execution receipt reference"
                present={hasExecutionEvidence}
              />

              <EvidenceIndicator
                label="Attestation reference"
                present={hasAttestationEvidence}
              />

              <EvidenceIndicator
                label="Safe authorization reference"
                present={hasSafeEvidence}
              />

              <EvidenceIndicator
                label="Structured JSON payload"
                present={parsedPayload !== null}
              />
            </div>

            {payloadKeys.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-[#090f19] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Top-level payload fields
                </div>

                <div className="flex flex-wrap gap-2">
                  {payloadKeys.map((key) => (
                    <span
                      key={key}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-slate-300"
                    >
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RAW PROOF PAYLOAD */}
          <div className="panel space-y-4 p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="eyebrow">COMPLETE PROOF PAYLOAD</div>
                <h2 className="mt-1 text-base font-semibold text-white">
                  Evidence JSON viewer
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyText(payloadText)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <Copy size={13} />
                  Copy JSON
                </button>

                <button
                  type="button"
                  onClick={downloadJson}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/[0.12]"
                >
                  <Download size={13} />
                  Export proof
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#070c13]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <FileJson size={14} />
                  proofPayload
                </div>

                <span className="text-[10px] uppercase tracking-wider text-slate-600">
                  {parsedPayload !== null ? "JSON" : "Raw payload"}
                </span>
              </div>

              <pre className="max-h-[600px] overflow-auto p-4 font-mono text-xs leading-6 text-emerald-200/90">
                {payloadText || "No proof payload returned."}
              </pre>
            </div>

            {parsedPayload === null && proof.proofPayload && (
              <p className="text-xs text-amber-300">
                The payload could not be parsed as JSON. The original
                backend response is displayed without modification.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                copyText(JSON.stringify(proof, null, 2))
              }
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              <Copy size={13} />
              Copy complete response
            </button>
          </div>
        </>
      )}

      {/* EMPTY STATE */}
      {!proof && !loading && (
        <div className="panel flex min-h-56 flex-col items-center justify-center p-8 text-center">
          <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.05] p-4">
            <FileCheck2 size={25} className="text-emerald-400" />
          </div>

          <h2 className="mt-4 text-sm font-semibold text-slate-200">
            Ready to inspect proof evidence
          </h2>

          <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
            Enter a passport ID to retrieve its latest proof bundle.
            The metadata and payload displayed here will come from
            the TrueSign backend.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
          <Loader2 size={15} className="animate-spin" />
          Retrieving proof bundle...
        </div>
      )}
    </div>
  );
}
