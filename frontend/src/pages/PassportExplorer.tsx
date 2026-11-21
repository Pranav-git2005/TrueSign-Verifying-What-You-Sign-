import { useState } from "react";
import { api, getApiErrorMessage } from "../lib/api";
import { Search, Plus, FileCheck2, Loader2, Copy, CheckCircle2 } from "lucide-react";

type Passport = Record<string, unknown>;

const initialForm = {
  account: "",
  mode: "SAFE_MULTISIG",
  chainId: "31337",
  expiresAt: "",
  purpose: "Vendor payment",
  summary: "Payment to an approved vendor",
  recipient: "",
  tokenAddress: "",
  tokenSymbol: "TST",
  amount: "10",
  maxAmount: "100",
  allowedTarget: "",
  allowedSelector: "",
  expectedCodeHash: "",
  allowDelegateCall: false,
  allowUnlimitedApproval: false,
  dailyLimit: "500",
  cooldownSeconds: "0",
  txTo: "",
  valueWei: "0",
  data: "0x",
  operation: "0",
  nonce: "1",
};

const inputClass =
    "mt-1.5 w-full rounded-xl border border-white/10 bg-[#0b111c] px-3 py-2.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-400/50";

const labelClass = "text-xs font-medium text-slate-400";

function Field({
                 label,
                 value,
                 onChange,
                 placeholder,
                 type = "text",
                 required = false,
               }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
      <label className={labelClass}>
        {label}
        <input
            className={inputClass}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
        />
      </label>
  );
}

function Section({
                   title,
                   children,
                 }: {
  title: string;
  children: React.ReactNode;
}) {
  return (
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-4 sm:p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">{title}</h3>
        <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      </section>
  );
}

export default function PassportExplorer() {
  const [form, setForm] = useState(initialForm);
  const [passportId, setPassportId] = useState("");
  const [passport, setPassport] = useState<Passport | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(true);

  const update = (key: keyof typeof initialForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const createPassport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setPassport(null);

    try {
      // datetime-local returns a browser-local value without a timezone.
      // The backend entity stores java.time.Instant, so send an ISO-8601 UTC instant.
      const expiryDate = new Date(form.expiresAt);
      if (!form.expiresAt || Number.isNaN(expiryDate.getTime())) {
        throw new Error("Please provide a valid passport expiry date and time.");
      }

      if (!form.allowedTarget.trim()) {
        throw new Error("Allowed target is required by the backend.");
      }

      const payload = {
        account: form.account.trim(),
        mode: form.mode,
        chainId: Number(form.chainId),
        expiresAt: expiryDate.toISOString(),
        intent: {
          purpose: form.purpose,
          summary: form.summary,
          recipient: form.recipient.trim(),
          tokenAddress: form.tokenAddress.trim(),
          tokenSymbol: form.tokenSymbol,
          amount: form.amount,
        },
        constraints: {
          maxAmount: form.maxAmount,
          allowedTarget: form.allowedTarget.trim(),
          allowedSelector: form.allowedSelector.trim() || null,
          expectedCodeHash: form.expectedCodeHash.trim() || null,
          allowDelegateCall: form.allowDelegateCall,
          allowUnlimitedApproval: form.allowUnlimitedApproval,
          dailyLimit: form.dailyLimit,
          cooldownSeconds: Number(form.cooldownSeconds),
        },
        transaction: {
          to: form.txTo.trim(),
          valueWei: form.valueWei,
          data: form.data.trim(),
          operation: Number(form.operation),
          nonce: Number(form.nonce),
        },
      };

      const response = await api.post<Passport>("/api/passports", payload);
      setPassport(response.data);

      // PassportController builds its Location from PassportResponse.passportId().
      const createdPassportId = response.data.passportId;
      if (typeof createdPassportId === "string" && createdPassportId.length > 0) {
        setPassportId(createdPassportId);
        setShowForm(false);
      } else {
        setSuccess(
            "Passport created, but the response did not contain passportId. Check the API response."
        );
        return;
      }

      setSuccess("Payment Passport created and saved by the backend. Its ID is ready in Lookup.");
    } catch (err) {
      setError(err instanceof Error ? err.message : getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const lookupPassport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passportId.trim()) return;

    setLookupLoading(true);
    setError("");
    setSuccess("");
    setPassport(null);

    try {
      const response = await api.get<Passport>(
          `/api/passports/${encodeURIComponent(passportId.trim())}`,
      );
      setPassport(response.data);
      setSuccess("Passport retrieved from the backend.");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLookupLoading(false);
    }
  };

  const copyJson = async () => {
    if (!passport) return;
    await navigator.clipboard.writeText(JSON.stringify(passport, null, 2));
    setSuccess("Passport JSON copied.");
  };

  const toggle = (
      key: "allowDelegateCall" | "allowUnlimitedApproval",
      label: string,
  ) => (
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#0b111c] p-3">
        <span className="text-xs text-slate-300">{label}</span>
        <input
            type="checkbox"
            checked={form[key]}
            onChange={(e) => update(key, e.target.checked)}
            className="h-4 w-4 accent-emerald-400"
        />
      </label>
  );

  return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              PAYMENT PASSPORT LIFECYCLE
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white">Passport Explorer</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Create a payment intent with policy constraints, or retrieve an
              existing passport using its ID.
            </p>
          </div>
          <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button
                onClick={() => setShowForm(true)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                    showForm ? "bg-emerald-300 text-[#07130f]" : "text-slate-400"
                }`}
            >
              <Plus size={13} className="mr-1 inline" /> Create
            </button>
            <button
                onClick={() => setShowForm(false)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                    !showForm ? "bg-emerald-300 text-[#07130f]" : "text-slate-400"
                }`}
            >
              <Search size={13} className="mr-1 inline" /> Lookup
            </button>
          </div>
        </div>

        {error && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-sm text-rose-300">
              {error}
            </div>
        )}
        {success && (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-sm text-emerald-300">
              {success}
            </div>
        )}

        {showForm ? (
            <form onSubmit={createPassport} className="space-y-4">
              <Section title="01 · Account and network">
                <Field label="Account address" value={form.account} onChange={(v) => update("account", v)} placeholder="0x..." />
                <label className={labelClass}>
                  Execution mode
                  <select className={inputClass} value={form.mode} onChange={(e) => update("mode", e.target.value)}>
                    <option value="SAFE_MULTISIG">SAFE_MULTISIG</option>
                    <option value="SINGLE_KEY_EOA">SINGLE_KEY_EOA</option>
                  </select>
                </label>
                <Field label="Chain ID" value={form.chainId} onChange={(v) => update("chainId", v)} type="number" />
                <Field
                    label="Expiry (your local time; sent to backend as UTC)"
                    value={form.expiresAt}
                    onChange={(v) => update("expiresAt", v)}
                    type="datetime-local"
                    required
                />
              </Section>

              <Section title="02 · Payment intent">
                <Field label="Purpose" value={form.purpose} onChange={(v) => update("purpose", v)} />
                <Field label="Human-readable summary" value={form.summary} onChange={(v) => update("summary", v)} />
                <Field label="Intended recipient" value={form.recipient} onChange={(v) => update("recipient", v)} placeholder="0x..." />
                <Field label="Token address" value={form.tokenAddress} onChange={(v) => update("tokenAddress", v)} placeholder="0x..." />
                <Field label="Token symbol" value={form.tokenSymbol} onChange={(v) => update("tokenSymbol", v)} />
                <Field label="Payment amount" value={form.amount} onChange={(v) => update("amount", v)} />
              </Section>

              <Section title="03 · Security constraints">
                <Field label="Maximum amount" value={form.maxAmount} onChange={(v) => update("maxAmount", v)} />
                <Field label="Daily limit" value={form.dailyLimit} onChange={(v) => update("dailyLimit", v)} />
                <Field
                    label="Allowed target (required by backend)"
                    value={form.allowedTarget}
                    onChange={(v) => update("allowedTarget", v)}
                    placeholder="0x..."
                    required
                />
                <Field label="Allowed selector (optional)" value={form.allowedSelector} onChange={(v) => update("allowedSelector", v)} placeholder="0xa9059cbb" />
                <Field label="Expected code hash (optional)" value={form.expectedCodeHash} onChange={(v) => update("expectedCodeHash", v)} placeholder="0x..." />
                <Field label="Cooldown (seconds)" value={form.cooldownSeconds} onChange={(v) => update("cooldownSeconds", v)} type="number" />
                {toggle("allowDelegateCall", "Allow DELEGATECALL")}
                {toggle("allowUnlimitedApproval", "Allow unlimited token approval")}
              </Section>

              <Section title="04 · Proposed transaction">
                <Field label="Transaction target (to)" value={form.txTo} onChange={(v) => update("txTo", v)} placeholder="0x..." />
                <Field label="Native value (wei)" value={form.valueWei} onChange={(v) => update("valueWei", v)} />
                <Field label="Calldata (hex)" value={form.data} onChange={(v) => update("data", v)} />
                <label className={labelClass}>
                  Operation
                  <select className={inputClass} value={form.operation} onChange={(e) => update("operation", e.target.value)}>
                    <option value="0">0 · CALL</option>
                    <option value="1">1 · DELEGATECALL</option>
                  </select>
                </label>
                <Field label="Nonce" value={form.nonce} onChange={(v) => update("nonce", v)} type="number" />
              </Section>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.035] p-4">
                <div>
                  <p className="text-sm font-semibold text-white">Create payment passport</p>
                  <p className="mt-1 text-xs text-slate-500">The backend validates and persists this request.</p>
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-xs font-bold text-[#07130f] transition hover:bg-emerald-200 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <FileCheck2 size={15} />}
                  {loading ? "Creating..." : "Create Passport"}
                </button>
              </div>
            </form>
        ) : (
            <form onSubmit={lookupPassport} className="panel flex flex-col gap-3 p-5 sm:flex-row">
              <label className="flex-1 text-xs font-medium text-slate-400">
                Passport ID
                <input
                    className={inputClass}
                    value={passportId}
                    onChange={(e) => setPassportId(e.target.value)}
                    placeholder="Enter the passport ID returned by the backend"
                />
              </label>
              <button
                  disabled={lookupLoading || !passportId.trim()}
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-xs font-bold text-[#07130f] disabled:opacity-50"
              >
                {lookupLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Retrieve Passport
              </button>
            </form>
        )}

        {passport && (
            <section className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={17} className="text-emerald-300" />
                  <div>
                    <h2 className="text-sm font-semibold text-white">Passport response</h2>
                    <p className="mt-1 text-[11px] text-slate-500">Returned by the TrueSign API</p>
                  </div>
                </div>
                <button type="button" onClick={copyJson} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.04]">
                  <Copy size={13} /> Copy JSON
                </button>
              </div>
              <pre className="max-h-[480px] overflow-auto p-5 text-xs leading-6 text-emerald-200/90">
            {JSON.stringify(passport, null, 2)}
          </pre>
            </section>
        )}
      </div>
  );
}
