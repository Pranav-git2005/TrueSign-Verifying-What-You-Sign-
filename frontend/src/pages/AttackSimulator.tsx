import { useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Fingerprint, Loader2, Play, XCircle } from "lucide-react";
import { api, getApiErrorMessage } from "../lib/api";

type ScenarioResult = {
  scenario: string;
  status: "BLOCKED" | "PASS" | "VULNERABLE" | "INCONCLUSIVE" | string;
  title: string;
  summary: string;
  expected?: string;
  actual?: string;
};
type SimulationResponse = {
  passportId: string;
  executedAt: string;
  executionMode: string;
  blockedCount: number;
  passedCount: number;
  vulnerableCount: number;
  inconclusiveCount: number;
  results: ScenarioResult[];
  disclaimer: string;
};

const scenarios = [
  ["AMOUNT_MANIPULATION", "Amount manipulation", "Checks a synthetic amount above the passport maxAmount."],
  ["UNAUTHORIZED_TARGET", "Unauthorized target", "Checks whether an unapproved target is rejected."],
  ["SELECTOR_MANIPULATION", "Function selector manipulation", "Checks whether a changed function selector is rejected."],
  ["NONCE_REPLAY", "Nonce replay", "Checks whether the stored nonce is already stale on the configured chain."],
  ["RECIPIENT_MANIPULATION", "Recipient manipulation", "Requires ABI-aware decoding; reports inconclusive when it cannot be safely evaluated."],
  ["UNAUTHORIZED_EXECUTION", "Unauthorized execution", "Owner signature authorization is not executed by this read-only test."],
  ["GUARD_BYPASS", "Safe Guard bypass", "A full Safe Guard execution path is not exercised."],
  ["BASELINE_EVM_CALL", "Baseline EVM call", "Runs eth_call and gas estimation for the saved target transaction."],
] as const;

function statusClass(status: string) {
  if (status === "BLOCKED" || status === "PASS") return "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300";
  if (status === "VULNERABLE") return "border-rose-400/20 bg-rose-400/[0.06] text-rose-300";
  return "border-amber-400/20 bg-amber-400/[0.06] text-amber-300";
}
function StatusIcon({ status }: { status: string }) {
  if (status === "BLOCKED") return <CheckCircle2 size={17} />;
  if (status === "VULNERABLE") return <XCircle size={17} />;
  return <CircleHelp size={17} />;
}

export default function AttackSimulator() {
  const [passportId, setPassportId] = useState("");
  const [selected, setSelected] = useState<string[]>(scenarios.map(([id]) => id));
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleScenario = (id: string) => setSelected(current =>
    current.includes(id) ? current.filter(item => item !== id) : [...current, id]
  );

  const runSimulation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = passportId.trim();
    if (!id) { setError("Enter a Payment Passport ID."); return; }
    if (!selected.length) { setError("Select at least one scenario."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await api.post<SimulationResponse>(
        `/api/simulation/${encodeURIComponent(id)}/run`,
        { scenarios: selected }
      );
      setResult(response.data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally { setLoading(false); }
  };

  return <div className="space-y-7">
    <section className="relative overflow-hidden rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-[#10251F] via-[#101B20] to-[#111827] p-6 sm:p-8">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1.5 text-[10px] font-semibold tracking-wider text-emerald-200">READ-ONLY SECURITY TESTING</div>
      <h1 className="text-2xl font-semibold text-white sm:text-3xl">Attack Simulation Lab</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Run controlled policy checks against a saved Payment Passport. Each scenario reports whether the modeled policy blocks the synthetic mutation.</p>
    </section>

    <section className="rounded-xl border border-amber-400/15 bg-amber-400/[0.035] p-4">
      <div className="flex items-start gap-3"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300"/><div>
        <p className="text-xs font-semibold text-amber-200">Important simulation limitations</p>
        <p className="mt-2 text-xs leading-6 text-slate-400">This endpoint does not sign or broadcast transactions. It performs read-only policy comparisons and an optional RPC call. Recipient ABI decoding, owner-signature validation, and full Safe Guard enforcement are reported as inconclusive rather than being presented as tested.</p>
      </div></div>
    </section>

    <section className="panel p-5 sm:p-6">
      <div className="flex items-center gap-3"><Fingerprint size={19} className="text-emerald-300"/><div><h2 className="text-sm font-semibold text-white">Select passport and scenarios</h2><p className="mt-1 text-xs text-slate-500">Choose one or more read-only checks.</p></div></div>
      <form onSubmit={runSimulation} className="mt-5 space-y-5">
        <label className="block text-xs font-medium text-slate-400">Passport ID
          <input value={passportId} onChange={e => setPassportId(e.target.value)} placeholder="Paste your Payment Passport ID" className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b111c] px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-400/50"/>
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          {scenarios.map(([id, title, description]) => <label key={id} className="flex cursor-pointer gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <input type="checkbox" checked={selected.includes(id)} onChange={() => toggleScenario(id)} className="mt-1 accent-emerald-400"/>
            <span><span className="block text-xs font-semibold text-slate-200">{title}</span><span className="mt-1 block text-[11px] leading-5 text-slate-500">{description}</span></span>
          </label>)}
        </div>
        <button type="submit" disabled={loading || !passportId.trim() || !selected.length} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-xs font-bold text-[#07130f] disabled:opacity-50">
          {loading ? <Loader2 size={15} className="animate-spin"/> : <Play size={15}/>} {loading ? "Running scenarios…" : "Run selected scenarios"}
        </button>
      </form>
      {error && <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs text-rose-300">{error}</p>}
    </section>

    {loading && <div className="panel flex min-h-40 items-center justify-center gap-3 text-sm text-slate-300"><Loader2 className="animate-spin text-emerald-300"/> Running read-only checks…</div>}
    {result && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-5"><p className="text-xs text-slate-500">Policy blocks</p><p className="mt-3 text-3xl font-semibold text-emerald-300">{result.blockedCount}</p></div>
        <div className="panel p-5"><p className="text-xs text-slate-500">Baseline checks passed</p><p className="mt-3 text-3xl font-semibold text-emerald-300">{result.passedCount}</p></div>
        <div className="panel p-5"><p className="text-xs text-slate-500">Not blocked / vulnerable</p><p className="mt-3 text-3xl font-semibold text-rose-300">{result.vulnerableCount}</p></div>
        <div className="panel p-5"><p className="text-xs text-slate-500">Inconclusive</p><p className="mt-3 text-3xl font-semibold text-amber-300">{result.inconclusiveCount}</p></div>
      </section>
      <section className="panel space-y-4 p-5">
        <div><p className="eyebrow">SCENARIO RESULTS</p><h2 className="mt-1 text-base font-semibold text-white">{result.passportId}</h2><p className="mt-1 text-[11px] text-slate-500">{new Date(result.executedAt).toLocaleString()} · {result.executionMode}</p></div>
        {result.results.map(item => <article key={item.scenario} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><StatusIcon status={item.status}/>{item.title}</div><span className={`rounded-full border px-3 py-1 text-[10px] font-bold ${statusClass(item.status)}`}>{item.status}</span></div>
          <p className="mt-3 text-xs leading-5 text-slate-400">{item.summary}</p>
          {(item.expected || item.actual) && <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-[9px] uppercase text-slate-500">Expected</p><p className="mt-1 break-all text-xs text-slate-300">{item.expected || "—"}</p></div><div><p className="text-[9px] uppercase text-slate-500">Actual</p><p className="mt-1 break-all text-xs text-slate-300">{item.actual || "—"}</p></div></div>}
        </article>)}
        <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.035] p-4 text-xs leading-5 text-amber-100/80">{result.disclaimer}</div>
      </section>
    </>}
  </div>;
}
