import {
  Activity,
  ArrowUpRight,
  Blocks,
  CircleDot,
  Clock3,
  Fingerprint,
  FlaskConical,
  Network,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  WifiOff,
  Server,
} from "lucide-react";

import {
  useDashboardLive,
  type ConnectionState,
  type LiveEvent,
} from "../hooks/useDashboardLive";

function StatusIndicator({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  const good = status === "Online" || status === "Connected";

  const color = good
    ? "bg-emerald-400"
    : status === "Checking" || status === "Connecting"
      ? "bg-amber-400"
      : "bg-rose-400";

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-xs text-slate-300">{label}</span>
      </div>
      <span className="text-[10px] text-slate-400">{status}</span>
    </div>
  );
}

function connectionLabel(status: ConnectionState) {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "reconnecting":
      return "Reconnecting";
    default:
      return "Disconnected";
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function describeEvent(event: LiveEvent) {
  if (
    event.payload &&
    typeof event.payload === "object" &&
    "message" in event.payload
  ) {
    return String(
      (event.payload as Record<string, unknown>).message
    );
  }

  return "Event received from the backend stream.";
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Shield;
}) {
  return (
    <div className="panel group p-5 transition hover:border-emerald-400/20">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400">
          {label}
        </p>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-2 text-emerald-300">
          <Icon size={17} />
        </div>
      </div>

      <p className="mt-5 break-words text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>

      <p className="mt-2 text-[11px] text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function EventFeed({
  events,
  status,
}: {
  events: LiveEvent[];
  status: ConnectionState;
}) {
  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">REAL-TIME ACTIVITY</p>
          <h2 className="mt-1 text-base font-semibold text-white">
            Live event stream
          </h2>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] px-3 py-2">
          {status === "connected" ? (
            <Wifi size={15} className="text-emerald-300" />
          ) : (
            <WifiOff size={15} className="text-amber-400" />
          )}

          <span className="text-[10px] text-slate-400">
            {connectionLabel(status)}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {events.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-5 text-center">
            <Activity size={25} className="text-slate-600" />

            <p className="mt-3 text-sm font-medium text-slate-300">
              {status === "connected"
                ? "Listening for events"
                : "Waiting for stream connection"}
            </p>

            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
              Passport creation, verification, snapshot and
              execution events will appear here when published
              by the backend.
            </p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="mt-0.5 rounded-lg bg-emerald-400/[0.08] p-2 text-emerald-300">
                <Radio size={15} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-emerald-300">
                    {event.type}
                  </p>

                  <span className="text-[10px] text-slate-500">
                    {formatTime(event.receivedAt)}
                  </span>
                </div>

                <p className="mt-1 break-words text-xs leading-5 text-slate-400">
                  {describeEvent(event)}
                </p>

                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300">
                    View event payload
                  </summary>

                  <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-3 text-[10px] text-slate-400">
                    {typeof event.payload === "string"
                      ? event.payload
                      : JSON.stringify(event.payload, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="text-[10px] text-slate-500">
          Showing latest {events.length} events
        </span>

        <span className="text-[10px] text-slate-500">
          Browser EventSource
        </span>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const {
    apiStatus,
    blockchain,
    blockchainError,
    sseStatus,
    events,
    lastUpdated,
    refreshStatus,
  } = useDashboardLive();

  const blockchainConnected = blockchain?.connected === true;
  const chainId = blockchain?.chainId;
  const latestBlock = blockchain?.latestBlock;

  const backendLabel =
    apiStatus === "online"
      ? "Online"
      : apiStatus === "checking"
        ? "Checking"
        : "Offline";

  const blockchainLabel =
    blockchainConnected
      ? "Connected"
      : blockchain
        ? "Configuration issue"
        : "Unavailable";

  return (
    <div className="space-y-7">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-[#10251F] via-[#101B20] to-[#111827] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-emerald-300/10" />
        <div className="pointer-events-none absolute -right-2 -top-14 h-52 w-52 rounded-full border border-emerald-300/[0.07]" />

        <div className="relative max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1.5">
            <ShieldCheck size={13} className="text-emerald-300" />
            <span className="text-[10px] font-semibold tracking-[0.14em] text-emerald-200">
              TRANSACTION SECURITY PLATFORM
            </span>
          </div>

          <h1 className="text-2xl font-bold leading-tight text-white sm:text-4xl">
            Secure every transaction.
            <br />
            <span className="text-emerald-300">
              Trust every execution.
            </span>
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
            Monitor payment passports, inspect verification
            decisions, analyze transaction risks and explore
            on-chain execution evidence from one command center.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/passports"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-xs font-bold text-[#07130F] transition hover:bg-emerald-200"
            >
              Explore passports <ArrowUpRight size={15} />
            </a>

            <a
              href="/simulator"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]"
            >
              <FlaskConical size={15} />
              Open simulation lab
            </a>
          </div>
        </div>
      </section>

      {/* LIVE METRICS */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">SYSTEM OVERVIEW</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Security at a glance
            </h2>
          </div>

          <button
            onClick={() => void refreshStatus()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[11px] text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
          >
            <RefreshCw size={13} />
            Refresh status
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Backend API"
            value={backendLabel}
            detail="GET /api/health"
            icon={Server}
          />

          <MetricCard
            label="Blockchain RPC"
            value={blockchainLabel}
            detail={
              blockchain?.correctNetwork === true
                ? "Expected network connected"
                : blockchain?.correctNetwork === false
                  ? "Network mismatch"
                  : blockchainError || "Checking blockchain status"
            }
            icon={ShieldCheck}
          />

          <MetricCard
            label="Latest Block"
            value={
              latestBlock !== undefined && latestBlock !== null
                ? String(latestBlock)
                : "—"
            }
            detail={
              chainId !== undefined
                ? `Chain ID: ${chainId}`
                : "Waiting for blockchain API"
            }
            icon={Blocks}
          />

          <MetricCard
            label="Live Events"
            value={String(events.length)}
            detail={`${connectionLabel(sseStatus)} · Current session`}
            icon={Activity}
          />
        </div>
      </section>

      {/* EVENTS + INFRASTRUCTURE */}
      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <EventFeed events={events} status={sseStatus} />

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">INFRASTRUCTURE</p>
              <h2 className="mt-1 text-base font-semibold text-white">
                Component connectivity
              </h2>
            </div>

            <Network size={18} className="text-emerald-300" />
          </div>

          <div className="mt-6 space-y-5">
            <StatusIndicator
              label="Spring Boot API"
              status={backendLabel}
            />

            <StatusIndicator
              label="Blockchain RPC"
              status={blockchainLabel}
            />

            <StatusIndicator
              label="Expected network"
              status={
                blockchain?.correctNetwork === true
                  ? "Online"
                  : blockchain?.correctNetwork === false
                    ? "Network mismatch"
                    : "Not checked"
              }
            />

            <StatusIndicator
              label="SSE event stream"
              status={connectionLabel(sseStatus)}
            />

            <StatusIndicator
              label="Smart contracts"
              status={
                blockchain
                  ? blockchain.status || "Status unavailable"
                  : "Not checked"
              }
            />

            <StatusIndicator
              label="Database"
              status="Not exposed by health API"
            />
          </div>

          {blockchainError && (
            <div className="mt-5 rounded-xl border border-rose-400/15 bg-rose-400/[0.05] p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-rose-300">
                <ShieldAlert size={14} />
                Blockchain status unavailable
              </div>

              <p className="mt-1 break-words text-[11px] leading-5 text-slate-400">
                {blockchainError}
              </p>
            </div>
          )}

          <div className="mt-5 rounded-xl bg-white/[0.03] p-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <CircleDot size={14} className="text-emerald-300" />
              Connection monitoring
            </div>

            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              API and blockchain status refresh every 15 seconds.
              The event stream uses automatic browser reconnection.
            </p>

            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
              <Clock3 size={11} />
              Last checked:{" "}
              {lastUpdated
                ? new Date(lastUpdated).toLocaleTimeString()
                : "Not checked yet"}
            </p>
          </div>
        </div>
      </section>

      {/* PLATFORM MODULES */}
      <section className="panel p-5">
        <div className="flex items-center gap-2">
          <Fingerprint size={17} className="text-emerald-300" />
          <h2 className="text-sm font-semibold text-white">
            Platform modules
          </h2>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Passport lifecycle", "Create and track payment passports.", "/passports"],
            ["Verification engine", "Inspect verifier decisions and anomalies.", "/verification"],
            ["Transaction intelligence", "Decode and inspect transaction calldata.", "/transactions"],
            ["Snapshot inspector", "Compare state before and after execution.", "/snapshots"],
            ["Attack simulation", "Run controlled security test scenarios.", "/simulator"],
            ["Proof explorer", "Inspect receipts and verification evidence.", "/proofs"],
          ].map(([title, description, path]) => (
            <a
              href={path}
              key={title}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-emerald-300/20 hover:bg-emerald-300/[0.035]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  {title}
                </span>
                <ArrowUpRight size={14} className="text-slate-500" />
              </div>

              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                {description}
              </p>
            </a>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 pb-3 text-[10px] text-slate-600">
        <span>TRUESIGN COMMAND CENTER · DEVELOPMENT BUILD</span>
        <span>Live dashboard · Batch 2A</span>
      </footer>
    </div>
  );
}
