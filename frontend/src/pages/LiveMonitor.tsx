import { useMemo, useState } from "react";
import {
  Activity,
  Clock3,
  Filter,
  Radio,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  WifiOff,
} from "lucide-react";

import {
  useDashboardLive,
  type ConnectionState,
  type LiveEvent,
} from "../hooks/useDashboardLive";

type EventFilter = "ALL" | "CONNECTED" | "PASSPORT_CREATED";

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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

function StatusDot({ status }: { status: string }) {
  const color =
    status === "connected" || status === "online"
      ? "bg-emerald-400"
      : status === "connecting" || status === "reconnecting"
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <span className={`h-2 w-2 rounded-full ${color}`} />
  );
}

function StatusCard({
  title,
  value,
  description,
  icon: Icon,
  status,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Activity;
  status: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400">
          {title}
        </p>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-2 text-emerald-300">
          <Icon size={18} />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <StatusDot status={status} />

        <p className="text-xl font-semibold text-white">
          {value}
        </p>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        {description}
      </p>
    </div>
  );
}

function eventDescription(event: LiveEvent) {
  if (
    event.payload &&
    typeof event.payload === "object" &&
    "message" in event.payload
  ) {
    return String(
      (event.payload as Record<string, unknown>).message
    );
  }

  if (
    event.payload &&
    typeof event.payload === "object" &&
    "passportId" in event.payload
  ) {
    return `Payment Passport ${
      String(
        (event.payload as Record<string, unknown>).passportId
      )
    } was created.`;
  }

  return "An event was received from the backend.";
}

function EventPayload({ event }: { event: LiveEvent }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-[11px] font-medium text-slate-500 transition hover:text-emerald-300">
        Inspect event payload
      </summary>

      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-white/[0.06] bg-black/30 p-4 text-[11px] leading-5 text-slate-400">
        {typeof event.payload === "string"
          ? event.payload
          : JSON.stringify(event.payload, null, 2)}
      </pre>
    </details>
  );
}

function EventItem({ event }: { event: LiveEvent }) {
  const isPassport = event.type === "PASSPORT_CREATED";

  return (
    <article className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-emerald-400/20">
      <div className="flex items-start gap-3">
        <div
          className={`rounded-xl border p-2 ${
            isPassport
              ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"
              : "border-sky-400/20 bg-sky-400/[0.08] text-sky-300"
          }`}
        >
          {isPassport ? (
            <ShieldCheck size={17} />
          ) : (
            <Radio size={17} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">
              {event.type}
            </span>

            <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Clock3 size={12} />
              {formatTime(event.receivedAt)}
            </span>
          </div>

          <p className="mt-2 break-words text-xs leading-5 text-slate-400">
            {eventDescription(event)}
          </p>

          <EventPayload event={event} />
        </div>
      </div>
    </article>
  );
}

export default function LiveMonitor() {
  const {
    apiStatus,
    blockchain,
    blockchainError,
    sseStatus,
    events,
    lastUpdated,
    refreshStatus,
    clearEvents,
  } = useDashboardLive();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<EventFilter>("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesFilter =
        filter === "ALL" || event.type === filter;

      const searchableContent = [
        event.type,
        event.receivedAt,
        typeof event.payload === "string"
          ? event.payload
          : JSON.stringify(event.payload),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchableContent.includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [events, filter, search]);

  async function handleRefresh() {
    setRefreshing(true);

    try {
      await refreshStatus();
    } finally {
      setRefreshing(false);
    }
  }

  const blockchainLabel = blockchain?.connected
    ? "Connected"
    : blockchain
      ? "Unavailable"
      : "Unknown";

  const chainLabel =
    blockchain?.chainId !== undefined
      ? String(blockchain.chainId)
      : "—";

  const latestBlock =
    blockchain?.latestBlock !== undefined
      ? String(blockchain.latestBlock)
      : "—";

  return (
    <div className="space-y-7">
      {/* PAGE HEADER */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-[#10251F] via-[#101B20] to-[#111827] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-emerald-300/10" />

        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1.5">
              <StatusDot status={sseStatus} />
              <span className="text-[10px] font-semibold tracking-wider text-emerald-200">
                LIVE EVENT MONITOR
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              System Activity Monitor
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Monitor backend connectivity, blockchain status,
              and events received through the TrueSign event stream.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-300/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh status
          </button>
        </div>
      </section>

      {/* CONNECTION STATUS */}
      <section>
        <div className="mb-4">
          <p className="eyebrow">INFRASTRUCTURE</p>
          <h2 className="mt-1 text-base font-semibold text-white">
            Connection overview
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            title="Backend API"
            value={
              apiStatus === "online"
                ? "Online"
                : apiStatus === "checking"
                  ? "Checking"
                  : "Offline"
            }
            description="Spring Boot health endpoint"
            icon={Server}
            status={apiStatus}
          />

          <StatusCard
            title="Blockchain RPC"
            value={blockchainLabel}
            description="Configured blockchain connection"
            icon={ShieldCheck}
            status={
              blockchain?.connected ? "connected" : "disconnected"
            }
          />

          <StatusCard
            title="Event Stream"
            value={connectionLabel(sseStatus)}
            description="Server-Sent Events connection"
            icon={Activity}
            status={sseStatus}
          />

          <StatusCard
            title="Received Events"
            value={String(events.length)}
            description="Events currently held in this browser view"
            icon={Radio}
            status={sseStatus}
          />
        </div>
      </section>

      {/* BLOCKCHAIN DETAILS */}
      <section className="panel p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={17} className="text-emerald-300" />
          <h2 className="text-sm font-semibold text-white">
            Blockchain connection details
          </h2>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-slate-500">
              CHAIN ID
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {chainLabel}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold tracking-wider text-slate-500">
              LATEST BLOCK
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {latestBlock}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold tracking-wider text-slate-500">
              EXPECTED CHAIN
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {blockchain?.expectedChainId !== undefined
                ? String(blockchain.expectedChainId)
                : "—"}
            </p>
          </div>
        </div>

        {blockchainError && (
          <p className="mt-5 rounded-lg border border-rose-400/15 bg-rose-400/[0.05] p-3 text-xs text-rose-300">
            {blockchainError}
          </p>
        )}

        <div className="mt-5 border-t border-white/[0.06] pt-3 text-[10px] text-slate-500">
          Last status check:{" "}
          {lastUpdated ? formatTime(lastUpdated) : "Not checked yet"}
        </div>
      </section>

      {/* EVENT TIMELINE */}
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow">SERVER-SENT EVENTS</p>
            <h2 className="mt-1 text-base font-semibold text-white">
              Live event timeline
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Events appear here when the backend publishes them.
            </p>
          </div>

          <button
            onClick={clearEvents}
            disabled={events.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-slate-400 transition hover:border-rose-400/20 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={14} />
            Clear view
          </button>
        </div>

        {/* SEARCH AND FILTER */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search event type or payload..."
              className="w-full rounded-xl border border-white/[0.08] bg-black/20 py-3 pl-10 pr-4 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/30"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3">
            <Filter size={14} className="text-slate-500" />

            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as EventFilter)
              }
              className="min-w-0 bg-transparent py-3 text-xs text-slate-300 outline-none"
            >
              <option value="ALL" className="bg-[#111827]">
                All events
              </option>
              <option
                value="CONNECTED"
                className="bg-[#111827]"
              >
                Connection
              </option>
              <option
                value="PASSPORT_CREATED"
                className="bg-[#111827]"
              >
                Passport created
              </option>
            </select>
          </div>
        </div>

        {/* EVENT LIST */}
        <div className="mt-5 space-y-3">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <EventItem key={event.id} event={event} />
            ))
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-5 text-center">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3 text-slate-500">
                {sseStatus === "connected" ? (
                  <Radio size={22} />
                ) : (
                  <WifiOff size={22} />
                )}
              </div>

              <p className="mt-4 text-sm font-medium text-slate-300">
                {events.length === 0
                  ? sseStatus === "connected"
                    ? "Listening for backend events"
                    : "Waiting for event stream"
                  : "No matching events"}
              </p>

              <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
                {events.length === 0
                  ? "Create a Payment Passport or reconnect the backend to see events here."
                  : "Try changing your search term or event filter."}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4">
          <span className="text-[10px] text-slate-500">
            Showing {filteredEvents.length} of {events.length} received events
          </span>

          <span className="text-[10px] text-slate-500">
            Live browser session · Not historical storage
          </span>
        </div>
      </section>
    </div>
  );
}