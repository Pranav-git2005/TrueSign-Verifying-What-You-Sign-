
import { useState } from "react";
import type { FormEvent } from "react";
import { api, getApiErrorMessage } from "../lib/api";
import {
  ShieldCheck, ShieldAlert, AlertTriangle, Search,
  Loader2, CheckCircle2, XCircle, Clock3, ChevronDown,
} from "lucide-react";

type Anomaly = {
  code?: string;
  severity?: string;
  message?: string;
  expected?: string;
  actual?: string;
};

type VerifierResult = {
  verifierName?: string;
  passed?: boolean;
  status?: string;
  summary?: string;
  anomalies?: Anomaly[];
  checkedAt?: string;
};

type VerificationResult = {
  passportId?: string;
  overallVerdict?: string;
  passedCount?: number;
  totalVerifiers?: number;
  trafficLight?: string;
  verifierResults?: VerifierResult[];
  anomalies?: Anomaly[];
  proofBundle?: unknown;
  verifiedAt?: string;
};

function asText(value: unknown, fallback = "—") {
  return typeof value === "string" || typeof value === "number"
      ? String(value)
      : fallback;
}

function verdictTone(value: string) {
  const normalized = value.toUpperCase();

  if (
      normalized.includes("GREEN") ||
      normalized.includes("PASS") ||
      normalized === "MATCH"
  ) {
    return "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300";
  }

  if (normalized.includes("AMBER") || normalized.includes("WARN")) {
    return "border-amber-400/20 bg-amber-400/[0.07] text-amber-300";
  }

  if (
      normalized.includes("RED") ||
      normalized.includes("BLOCK") ||
      normalized.includes("FAIL")
  ) {
    return "border-rose-400/20 bg-rose-400/[0.07] text-rose-300";
  }

  return "border-slate-400/20 bg-slate-400/[0.06] text-slate-300";
}

function StatusIcon({ status }: { status: string }) {
  const value = status.toUpperCase();

  if (
      value.includes("GREEN") ||
      value.includes("PASS") ||
      value === "MATCH"
  ) {
    return <CheckCircle2 size={18} className="text-emerald-300" />;
  }

  if (value.includes("AMBER") || value.includes("WARN")) {
    return <AlertTriangle size={18} className="text-amber-300" />;
  }

  if (
      value.includes("RED") ||
      value.includes("BLOCK") ||
      value.includes("FAIL")
  ) {
    return <XCircle size={18} className="text-rose-300" />;
  }

  return <Clock3 size={18} className="text-slate-400" />;
}

function JsonPanel({
                     title,
                     value,
                   }: {
  title: string;
  value: unknown;
}) {
  const [open, setOpen] = useState(false);

  return (
      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0b111c]">
        <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="flex w-full items-center justify-between p-4 text-left"
        >
        <span className="text-xs font-semibold text-slate-200">
          {title}
        </span>

          <ChevronDown
              size={15}
              className={`text-slate-500 transition ${
                  open ? "rotate-180" : ""
              }`}
          />
        </button>

        {open && (
            <pre className="max-h-80 overflow-auto border-t border-white/[0.07] p-4 text-[11px] leading-5 text-emerald-200/90">
          {JSON.stringify(value ?? null, null, 2)}
        </pre>
        )}
      </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString();
}

export default function VerificationCenter() {
  const [passportId, setPassportId] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const id = passportId.trim();
    if (!id) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await api.post<VerificationResult>(
          `/api/verify/${encodeURIComponent(id)}`
      );

      setResult(response.data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const verdict = asText(
      result?.trafficLight ?? result?.overallVerdict,
      "INCONCLUSIVE"
  );

  // Backend field is verifierResults, not verdicts.
  const verifierResults = result?.verifierResults ?? [];
  const anomalies = result?.anomalies ?? [];

  return (
      <div className="space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            MULTI-VERIFIER RISK ANALYSIS
          </p>

          <h1 className="mt-2 text-2xl font-bold text-white">
            Verification Center
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Run the backend verification pipeline for a payment passport
            and inspect the authoritative verdict, verifier results,
            anomalies and proof.
          </p>
        </div>

        <form
            onSubmit={verify}
            className="panel flex flex-col gap-3 p-5 sm:flex-row"
        >
          <label className="flex-1 text-xs font-medium text-slate-400">
            Passport ID

            <input
                value={passportId}
                onChange={(event) => setPassportId(event.target.value)}
                placeholder="Paste a passport ID"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0b111c] px-3 py-3 text-sm text-slate-200 outline-none focus:border-emerald-400/50"
            />
          </label>

          <button
              type="submit"
              disabled={loading || !passportId.trim()}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-xs font-bold text-[#07130f] disabled:opacity-50"
          >
            {loading ? (
                <Loader2 size={15} className="animate-spin" />
            ) : (
                <ShieldCheck size={15} />
            )}

            {loading ? "Running verifiers..." : "Run Verification"}
          </button>
        </form>

        {error && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-300">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert size={16} />
                Verification request failed
              </div>

              <p className="mt-2 break-words text-xs leading-5">
                {error}
              </p>
            </div>
        )}

        {loading && (
            <div className="panel flex min-h-48 flex-col items-center justify-center p-8 text-center">
              <Loader2 size={28} className="animate-spin text-emerald-300" />

              <p className="mt-4 text-sm font-semibold text-white">
                Verification in progress
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Waiting for the backend verifier pipeline.
              </p>
            </div>
        )}

        {result && (
            <>
              <section
                  className={`rounded-2xl border p-5 ${verdictTone(verdict)}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={verdict} />

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">
                        Authoritative traffic light
                      </p>

                      <h2 className="mt-1 text-2xl font-bold">
                        {verdict}
                      </h2>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider opacity-60">
                      Passport
                    </p>

                    <p className="mt-1 max-w-[220px] break-all text-xs font-medium">
                      {asText(result.passportId, passportId)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-3">
                {[
                  ["Passed verifiers", asText(result.passedCount, "0")],
                  ["Total verifiers", asText(result.totalVerifiers, "0")],
                  ["Detected anomalies", String(anomalies.length)],
                ].map(([label, value]) => (
                    <div key={label} className="panel p-5">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="mt-3 text-3xl font-semibold text-white">
                        {value}
                      </p>
                    </div>
                ))}
              </section>

              <section className="panel p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Verification pipeline
                    </p>

                    <h2 className="mt-1 text-base font-semibold text-white">
                      Individual verifier results
                    </h2>
                  </div>

                  <span className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-slate-400">
                {verifierResults.length} results
              </span>
                </div>

                {verifierResults.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
                      The API returned no individual verifier results.
                    </p>
                ) : (
                    <div className="space-y-3">
                      {verifierResults.map((item, index) => {
                        const status = asText(
                            item.status,
                            item.passed ? "PASSED" : "FAILED"
                        );

                        return (
                            <div
                                key={`${item.verifierName ?? "verifier"}-${index}`}
                                className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <StatusIcon status={status} />

                                  <span className="text-sm font-semibold text-slate-200">
                            {asText(
                                item.verifierName,
                                `Verifier ${index + 1}`
                            )}
                          </span>
                                </div>

                                <span
                                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${verdictTone(status)}`}
                                >
                          {status}
                        </span>
                              </div>

                              <p className="mt-2 text-xs leading-5 text-slate-400">
                                {asText(
                                    item.summary,
                                    "No explanation supplied."
                                )}
                              </p>

                              <p className="mt-2 text-[10px] text-slate-500">
                                Checked at: {formatDate(item.checkedAt)}
                              </p>

                              {item.anomalies && item.anomalies.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {item.anomalies.map((anomaly, anomalyIndex) => (
                                        <div
                                            key={`${anomaly.code ?? "anomaly"}-${anomalyIndex}`}
                                            className="rounded-lg border border-amber-400/10 bg-amber-400/[0.03] p-3"
                                        >
                                          <p className="text-xs font-semibold text-amber-200">
                                            {asText(anomaly.code, "Anomaly")}
                                          </p>

                                          <p className="mt-1 text-xs text-slate-400">
                                            {asText(anomaly.message)}
                                          </p>
                                        </div>
                                    ))}
                                  </div>
                              )}

                              <div className="mt-3">
                                <JsonPanel
                                    title="Verifier response details"
                                    value={item}
                                />
                              </div>
                            </div>
                        );
                      })}
                    </div>
                )}
              </section>

              <section className="panel p-5">
                <div className="mb-4 flex items-center gap-2">
                  <AlertTriangle size={17} className="text-amber-300" />

                  <h2 className="text-base font-semibold text-white">
                    Detected anomalies
                  </h2>

                  <span className="ml-auto text-xs text-slate-500">
                {anomalies.length} reported
              </span>
                </div>

                {anomalies.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
                      No anomalies were included in this API response.
                    </p>
                ) : (
                    <div className="space-y-3">
                      {anomalies.map((item, index) => (
                          <div
                              key={`${item.code ?? "anomaly"}-${index}`}
                              className="rounded-xl border border-amber-400/10 bg-amber-400/[0.025] p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-200">
                                {asText(item.code, `Anomaly ${index + 1}`)}
                              </p>

                              <span className="rounded-full border border-amber-400/20 px-2.5 py-1 text-[10px] text-amber-300">
                        {asText(item.severity, "UNSPECIFIED")}
                      </span>
                            </div>

                            <p className="mt-2 text-xs leading-5 text-slate-400">
                              {asText(item.message)}
                            </p>

                            {(item.expected || item.actual) && (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  <div className="rounded-lg bg-black/20 p-3">
                                    <p className="text-[10px] uppercase text-slate-500">
                                      Expected
                                    </p>
                                    <p className="mt-1 break-all text-xs text-slate-300">
                                      {asText(item.expected)}
                                    </p>
                                  </div>

                                  <div className="rounded-lg bg-black/20 p-3">
                                    <p className="text-[10px] uppercase text-slate-500">
                                      Actual
                                    </p>
                                    <p className="mt-1 break-all text-xs text-slate-300">
                                      {asText(item.actual)}
                                    </p>
                                  </div>
                                </div>
                            )}
                          </div>
                      ))}
                    </div>
                )}
              </section>

              <section className="panel space-y-3 p-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Evidence and audit
                  </p>

                  <h2 className="mt-1 text-base font-semibold text-white">
                    Verification record
                  </h2>
                </div>

                <JsonPanel
                    title="Proof bundle"
                    value={result.proofBundle}
                />

                <JsonPanel
                    title="Complete API response"
                    value={result}
                />

                <p className="text-[10px] text-slate-500">
                  Verified at: {formatDate(result.verifiedAt)}
                </p>
              </section>
            </>
        )}

        {!result && !loading && !error && (
            <div className="panel flex min-h-52 flex-col items-center justify-center p-8 text-center">
              <Search size={25} className="text-slate-600" />

              <h2 className="mt-4 text-sm font-semibold text-slate-300">
                Ready to inspect a passport
              </h2>

              <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
                Enter a passport ID above. The results shown here will come
                directly from the backend verification response.
              </p>
            </div>
        )}
      </div>
  );
}
