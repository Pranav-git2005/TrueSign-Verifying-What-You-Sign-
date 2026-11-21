import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api, getApiErrorMessage } from "../lib/api";

interface Anomaly {
  code: string;
  severity: string;
  message: string;
  expected: string;
  actual: string;
}

interface VerifierResult {
  verifierName: string;
  passed: boolean;
  status: string;
  summary: string;
  anomalies: Anomaly[];
  checkedAt: string;
}

interface VerificationResponse {
  passportId: string;
  overallVerdict: string;
  passedCount: number;
  totalVerifiers: number;
  trafficLight: string;
  verifierResults: VerifierResult[];
  anomalies: Anomaly[];
  verifiedAt: string;
}

type SeverityFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

function formatDate(value?: string) {
  if (!value) return "Not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

function severityStyle(severity?: string) {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    case "HIGH":
      return "border-orange-400/20 bg-orange-400/10 text-orange-300";
    case "MEDIUM":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "LOW":
      return "border-sky-400/20 bg-sky-400/10 text-sky-300";
    default:
      return "border-white/10 bg-white/[0.05] text-slate-300";
  }
}

function verdictStyle(verdict?: string) {
  switch (verdict?.toUpperCase()) {
    case "GREEN":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "RED":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    case "AMBER":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    default:
      return "border-white/10 bg-white/[0.05] text-slate-300";
  }
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: typeof Activity;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">{label}</span>
        <Icon size={17} className={accent} />
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

export default function AnomalyMonitor() {
  const [passportId, setPassportId] = useState("");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>("ALL");

  const [result, setResult] =
    useState<VerificationResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runVerification = async () => {
    const id = passportId.trim();

    if (!id) {
      setError("Enter a passport ID before running verification.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await api.post<VerificationResponse>(
        `/api/verify/${encodeURIComponent(id)}`
      );

      setResult(response.data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const anomalies = result?.anomalies ?? [];
  const verifiers = result?.verifierResults ?? [];

  const severityCounts = useMemo(() => {
    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    anomalies.forEach((anomaly) => {
      const severity = anomaly.severity?.toUpperCase();

      if (severity === "CRITICAL") counts.critical++;
      else if (severity === "HIGH") counts.high++;
      else if (severity === "MEDIUM") counts.medium++;
      else if (severity === "LOW") counts.low++;
    });

    return counts;
  }, [anomalies]);

  const filteredAnomalies = useMemo(() => {
    const query = search.trim().toLowerCase();

    return anomalies.filter((anomaly) => {
      const matchesSeverity =
        severityFilter === "ALL" ||
        anomaly.severity?.toUpperCase() === severityFilter;

      const matchesSearch =
        !query ||
        [
          anomaly.code,
          anomaly.severity,
          anomaly.message,
          anomaly.expected,
          anomaly.actual,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));

      return matchesSeverity && matchesSearch;
    });
  }, [anomalies, search, severityFilter]);

  const verdict = result?.trafficLight || result?.overallVerdict || "";

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <ShieldAlert size={14} className="text-emerald-400" />
            SECURITY INTELLIGENCE
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
            Anomaly & Security Monitor
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Inspect verifier-detected anomalies, compare expected and
            actual values, and review the authoritative verification
            verdict for a payment passport.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-400">
          <Activity size={15} className="text-emerald-400" />
          Verification-backed analysis
        </div>
      </div>

      {/* PASSPORT SEARCH */}
      <div className="panel space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
            <Fingerprint size={18} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Security verification
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Enter a passport ID and explicitly run its verifiers.
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
                void runVerification();
              }
            }}
            placeholder="Enter payment passport ID"
            className="w-full rounded-xl border border-white/10 bg-[#090f19] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-400/50"
          />
        </label>

        <button
          type="button"
          onClick={runVerification}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ShieldCheck size={16} />
          )}
          {loading ? "Running verification..." : "Run security verification"}
        </button>

        <p className="text-xs leading-5 text-slate-500">
          This action executes the backend verifiers, generates a proof
          bundle and records a new verification result.
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.07] p-3 text-sm text-red-300">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* RESULTS */}
      {result && (
        <>
          {/* VERDICT */}
          <div className="panel flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
            <div>
              <div className="eyebrow">AUTHORITATIVE VERIFICATION VERDICT</div>
              <h2 className="mt-2 text-base font-semibold text-white">
                Passport security assessment
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Passport: {result.passportId}
              </p>
            </div>

            <div
              className={`w-fit rounded-xl border px-5 py-3 text-center ${verdictStyle(verdict)}`}
            >
              <div className="text-[10px] font-semibold tracking-widest">
                TRAFFIC LIGHT
              </div>
              <div className="mt-1 text-2xl font-black">
                {verdict || "UNKNOWN"}
              </div>
            </div>
          </div>

          {/* METRICS */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total anomalies"
              value={anomalies.length}
              description="Detected by registered verifiers"
              icon={AlertTriangle}
              accent="text-amber-300"
            />

            <MetricCard
              label="Critical"
              value={severityCounts.critical}
              description="Critical severity findings"
              icon={ShieldAlert}
              accent="text-red-400"
            />

            <MetricCard
              label="High severity"
              value={severityCounts.high}
              description="High severity findings"
              icon={AlertCircle}
              accent="text-orange-300"
            />

            <MetricCard
              label="Verifier success"
              value={`${result.passedCount} / ${result.totalVerifiers}`}
              description="Passed registered verifiers"
              icon={CheckCircle2}
              accent="text-emerald-300"
            />
          </div>

          {/* SEVERITY SUMMARY */}
          <div className="panel space-y-4 p-5">
            <div>
              <div className="eyebrow">ANOMALY DISTRIBUTION</div>
              <h2 className="mt-1 text-base font-semibold text-white">
                Severity breakdown
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {(
                [
                  ["CRITICAL", severityCounts.critical],
                  ["HIGH", severityCounts.high],
                  ["MEDIUM", severityCounts.medium],
                  ["LOW", severityCounts.low],
                ] as const
              ).map(([label, count]) => (
                <div
                  key={label}
                  className={`rounded-xl border p-4 ${severityStyle(label)}`}
                >
                  <p className="text-[10px] font-bold tracking-widest">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-bold">{count}</p>
                </div>
              ))}
            </div>

            {anomalies.length === 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
                <CheckCircle2
                  size={20}
                  className="text-emerald-300"
                />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    No anomalies returned
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    The verification response contains an empty anomaly list.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ANOMALY INSPECTOR */}
          <div className="panel space-y-5 p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="eyebrow">DETECTED SECURITY FINDINGS</div>
                <h2 className="mt-1 text-base font-semibold text-white">
                  Anomaly inspector
                </h2>
              </div>

              <span className="text-xs text-slate-500">
                {filteredAnomalies.length} of {anomalies.length} findings
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search code, message or values..."
                  className="w-full rounded-xl border border-white/10 bg-[#090f19] py-3 pl-9 pr-3 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-400/50"
                />
              </div>

              <select
                value={severityFilter}
                onChange={(event) =>
                  setSeverityFilter(event.target.value as SeverityFilter)
                }
                className="rounded-xl border border-white/10 bg-[#090f19] px-3 py-3 text-xs text-slate-300 outline-none focus:border-emerald-400/50"
              >
                <option value="ALL">All severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div className="space-y-3">
              {filteredAnomalies.map((anomaly, index) => (
                <div
                  key={`${anomaly.code}-${index}`}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-200">
                          {anomaly.code || "UNSPECIFIED"}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${severityStyle(anomaly.severity)}`}
                        >
                          {anomaly.severity || "UNSPECIFIED"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {anomaly.message || "No message provided."}
                      </p>
                    </div>

                    <AlertTriangle
                      size={18}
                      className="shrink-0 text-amber-300"
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/[0.06] bg-[#090f19] p-3">
                      <p className="text-[10px] font-semibold tracking-widest text-slate-500">
                        EXPECTED
                      </p>
                      <p className="mt-2 break-all font-mono text-xs leading-5 text-emerald-300">
                        {anomaly.expected || "Not provided"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/[0.06] bg-[#090f19] p-3">
                      <p className="text-[10px] font-semibold tracking-widest text-slate-500">
                        ACTUAL
                      </p>
                      <p className="mt-2 break-all font-mono text-xs leading-5 text-amber-300">
                        {anomaly.actual || "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {filteredAnomalies.length === 0 && anomalies.length > 0 && (
                <div className="rounded-xl border border-white/[0.07] p-8 text-center">
                  <Search
                    size={22}
                    className="mx-auto text-slate-500"
                  />
                  <p className="mt-3 text-sm font-medium text-slate-300">
                    No matching anomalies
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Try changing your search or severity filter.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* VERIFIER RESULTS */}
          <div className="panel space-y-4 p-5">
            <div>
              <div className="eyebrow">VERIFICATION ENGINE</div>
              <h2 className="mt-1 text-base font-semibold text-white">
                Individual verifier results
              </h2>
            </div>

            <div className="space-y-3">
              {verifiers.map((verifier, index) => (
                <div
                  key={`${verifier.verifierName}-${index}`}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-lg p-2 ${
                          verifier.passed
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-red-400/10 text-red-300"
                        }`}
                      >
                        {verifier.passed ? (
                          <CheckCircle2 size={17} />
                        ) : (
                          <XCircle size={17} />
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-200">
                          {verifier.verifierName || `Verifier ${index + 1}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {verifier.status || "Status not provided"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-[10px] font-bold ${
                        verifier.passed
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                          : "border-red-400/20 bg-red-400/10 text-red-300"
                      }`}
                    >
                      {verifier.passed ? "PASSED" : "NOT PASSED"}
                    </span>
                  </div>

                  {verifier.summary && (
                    <p className="mt-3 text-xs leading-5 text-slate-400">
                      {verifier.summary}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                    <Clock3 size={12} />
                    Checked: {formatDate(verifier.checkedAt)}
                    <span className="ml-2">
                      Anomalies: {verifier.anomalies?.length ?? 0}
                    </span>
                  </div>
                </div>
              ))}

              {verifiers.length === 0 && (
                <p className="rounded-xl border border-white/[0.07] p-5 text-center text-xs text-slate-500">
                  No verifier results were returned.
                </p>
              )}
            </div>
          </div>

          {/* VERIFICATION FOOTER */}
          <div className="flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <Clock3 size={14} />
              Verified: {formatDate(result.verifiedAt)}
            </span>
            <span>
              {result.passedCount} / {result.totalVerifiers} verifiers passed
            </span>
          </div>
        </>
      )}

      {/* EMPTY STATE */}
      {!result && !loading && (
        <div className="panel flex min-h-56 flex-col items-center justify-center p-8 text-center">
          <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.05] p-4">
            <ShieldAlert size={25} className="text-emerald-400" />
          </div>

          <h2 className="mt-4 text-sm font-semibold text-slate-200">
            Security monitor ready
          </h2>

          <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
            Enter a passport ID and run verification to inspect detected
            anomalies, verifier outcomes and the overall security verdict.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
          <Loader2 size={15} className="animate-spin" />
          Executing registered verifiers...
        </div>
      )}
    </div>
  );
}
