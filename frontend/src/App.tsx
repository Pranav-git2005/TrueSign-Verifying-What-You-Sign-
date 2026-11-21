
import Dashboard from "./components/Dashboard";

import LiveMonitor from "./pages/LiveMonitor";
import PassportExplorer from "./pages/PassportExplorer";
import VerificationCenter from "./pages/VerificationCenter";
import TransactionIntelligence from "./pages/TransactionIntelligence";
import SnapshotInspector from "./pages/SnapshotInspector";
import ProofExplorer from "./pages/ProofExplorer";
import AttackSimulator from "./pages/AttackSimulator";
import ContractExplorer from "./pages/ContractExplorer";
import SettingsPage from "./pages/Settings";
import AnomalyMonitor from "./pages/AnomalyMonitor";

import {
  Activity,
  Blocks,
  ChevronDown,
  Code2,
  Command,
  FileCheck2,
  Fingerprint,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  Menu,
  ScanSearch,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import { useState } from "react";

import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { useDashboardLive } from "./hooks/useDashboardLive";

type NavItem = {
  label: string;
  path: string;
  icon: typeof Gauge;
};

const navigation: { title: string; items: NavItem[] }[] = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard },
      { label: "Live Monitor", path: "/monitor", icon: Activity },
    ],
  },
  {
    title: "TRANSACTION SECURITY",
    items: [
      { label: "Passports", path: "/passports", icon: Fingerprint },
      { label: "Verification", path: "/verification", icon: ShieldCheck },
      { label: "Transaction Intel", path: "/transactions", icon: ScanSearch },
      { label: "Snapshots", path: "/snapshots", icon: Blocks },
      { label: "Proof Explorer", path: "/proofs", icon: FileCheck2 },
    ],
  },
  {
    title: "SECURITY OPERATIONS",
    items: [
      { label: "Attack Simulator", path: "/simulator", icon: FlaskConical },
      { label: "Anomalies", path: "/anomalies", icon: ShieldAlert },
      { label: "Contract Explorer", path: "/contracts", icon: Code2 },
    ],
  },
];

type SystemStatus = {
  apiStatus: "checking" | "online" | "offline";
  blockchainConnected: boolean;
  blockchainError: string | null;
};

function getSystemLabel(status: SystemStatus) {
  if (status.apiStatus === "checking") return "CONNECTING";
  if (status.apiStatus === "offline") return "BACKEND OFFLINE";

  if (status.blockchainError) return "BLOCKCHAIN UNAVAILABLE";

  if (!status.blockchainConnected) return "BLOCKCHAIN DISCONNECTED";

  return "SYSTEM OPERATIONAL";
}

function getSystemColor(status: SystemStatus) {
  if (status.apiStatus === "checking") return "amber";
  if (status.apiStatus === "offline") return "rose";
  if (status.blockchainError || !status.blockchainConnected) return "amber";
  return "emerald";
}

function Sidebar({
                   open,
                   close,
                   systemStatus,
                 }: {
  open: boolean;
  close: () => void;
  systemStatus: SystemStatus;
}) {
  const label = getSystemLabel(systemStatus);
  const color = getSystemColor(systemStatus);

  const colors = {
    emerald: {
      border: "border-emerald-400/15",
      background: "bg-emerald-400/[0.06]",
      dot: "bg-emerald-400",
      text: "text-emerald-200",
    },
    amber: {
      border: "border-amber-400/15",
      background: "bg-amber-400/[0.06]",
      dot: "bg-amber-400",
      text: "text-amber-200",
    },
    rose: {
      border: "border-rose-400/15",
      background: "bg-rose-400/[0.06]",
      dot: "bg-rose-400",
      text: "text-rose-200",
    },
  }[color];

  return (
      <>
        {open && (
            <button
                aria-label="Close navigation"
                onClick={close}
                className="fixed inset-0 z-40 bg-black/70 lg:hidden"
            />
        )}

        <aside
            className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-white/[0.07] bg-[#0B1019] transition-transform duration-200 lg:translate-x-0 ${
                open ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="flex h-[76px] items-center justify-between border-b border-white/[0.07] px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300 shadow-glow">
                <Shield size={21} />
              </div>

              <div>
                <div className="text-[17px] font-bold tracking-wide text-white">
                  TRUESIGN<span className="text-emerald-400">.</span>
                </div>

                <div className="text-[9px] font-semibold tracking-[0.22em] text-slate-500">
                  COMMAND CENTER
                </div>
              </div>
            </div>

            <button
                onClick={close}
                aria-label="Close sidebar"
                className="rounded-lg p-2 text-slate-500 hover:bg-white/5 lg:hidden"
            >
              <X size={18} />
            </button>
          </div>

          <div className={`mx-4 mt-5 rounded-xl border p-3 ${colors.border} ${colors.background}`}>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${colors.dot}`} />

              <span className={`text-xs font-semibold ${colors.text}`}>
              {label}
            </span>
            </div>

            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              {systemStatus.apiStatus === "offline"
                  ? "The backend health endpoint is not reachable."
                  : systemStatus.blockchainError
                      ? "The backend is reachable, but blockchain status could not be retrieved."
                      : systemStatus.apiStatus === "checking"
                          ? "Checking backend and blockchain connectivity."
                          : systemStatus.blockchainConnected
                              ? "Backend and blockchain connection are available."
                              : "Backend is reachable, but blockchain connection is unavailable."}
            </p>
          </div>

          <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
            {navigation.map((group) => (
                <div key={group.title}>
                  <p className="eyebrow mb-2 px-3">{group.title}</p>

                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;

                      return (
                          <NavLink
                              key={item.path}
                              to={item.path}
                              end={item.path === "/"}
                              onClick={close}
                              className={({ isActive }) =>
                                  `nav-link ${isActive ? "nav-link-active" : ""}`
                              }
                          >
                            <Icon size={17} />
                            <span>{item.label}</span>
                          </NavLink>
                      );
                    })}
                  </div>
                </div>
            ))}
          </nav>

          <div className="border-t border-white/[0.07] p-4">
            <NavLink
                to="/settings"
                onClick={close}
                className={({ isActive }) =>
                    `nav-link ${isActive ? "nav-link-active" : ""}`
                }
            >
              <Settings size={17} />
              Settings
            </NavLink>

            <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/[0.035] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
                TS
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200">
                  TrueSign Operator
                </p>

                <p className="text-[10px] text-slate-500">
                  Local environment
                </p>
              </div>

              <ChevronDown size={15} className="text-slate-500" />
            </div>
          </div>
        </aside>
      </>
  );
}

function Header({
                  onMenu,
                  systemStatus,
                }: {
  onMenu: () => void;
  systemStatus: SystemStatus;
}) {
  const location = useLocation();

  const current = navigation
      .flatMap((group) => group.items)
      .find((item) => item.path === location.pathname);

  const title =
      current?.label ||
      (location.pathname === "/settings" ? "Settings" : "TrueSign");

  const label = getSystemLabel(systemStatus);
  const color = getSystemColor(systemStatus);

  const statusClass =
      color === "emerald"
          ? "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300"
          : color === "amber"
              ? "border-amber-400/15 bg-amber-400/[0.06] text-amber-300"
              : "border-rose-400/15 bg-rose-400/[0.06] text-rose-300";

  return (
      <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-white/[0.07] bg-[#080B12]/90 px-4 backdrop-blur-xl sm:px-7">
        <div className="flex items-center gap-3">
          <button
              onClick={onMenu}
              aria-label="Open navigation"
              className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"
          >
            <Menu size={19} />
          </button>

          <div>
            <p className="text-sm font-semibold text-white">{title}</p>

            <p className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">
              TrueSign / Command Center / {title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 sm:flex ${statusClass}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className="text-[11px] font-medium">{label}</span>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400">
            <Command size={16} />
          </div>
        </div>
      </header>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
      <div className="panel flex min-h-[340px] flex-col items-center justify-center p-8 text-center">
        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 text-emerald-300">
          <Gauge size={25} />
        </div>

        <h2 className="mt-5 text-lg font-semibold text-white">{title}</h2>

        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          This page is not available.
        </p>
      </div>
  );
}

function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    apiStatus,
    blockchain,
    blockchainError,
  } = useDashboardLive();

  const systemStatus: SystemStatus = {
    apiStatus,
    blockchainConnected: blockchain?.connected === true,
    blockchainError,
  };

  return (
      <div className="min-h-screen">
        <Sidebar
            open={menuOpen}
            close={() => setMenuOpen(false)}
            systemStatus={systemStatus}
        />

        <div className="min-h-screen lg:pl-[264px]">
          <Header
              onMenu={() => setMenuOpen(true)}
              systemStatus={systemStatus}
          />

          <main className="mx-auto max-w-[1600px] p-4 sm:p-7">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/monitor" element={<LiveMonitor />} />
              <Route path="/passports" element={<PassportExplorer />} />
              <Route path="/verification" element={<VerificationCenter />} />
              <Route path="/transactions" element={<TransactionIntelligence />} />
              <Route path="/snapshots" element={<SnapshotInspector />} />
              <Route path="/proofs" element={<ProofExplorer />} />
              <Route path="/simulator" element={<AttackSimulator />} />
              <Route path="/anomalies" element={<AnomalyMonitor />} />
              <Route path="/contracts" element={<ContractExplorer />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Placeholder title="Page not found" />} />
            </Routes>
          </main>
        </div>
      </div>
  );
}

export default function App() {
  return (
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
  );
}
