import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";

import { useAuth } from "../state/auth";
import Logo from "./Logo";
import NavItem from "./NavItem";

const Layout = () => {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();

  // Sidebar group expand/collapse state
  const [expanded, setExpanded] = useState({
    design: false,
    analysis: false,
    perf: false,
  });

  const toggleGroup = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="data-card px-6 py-4">Loading workspace...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[260px_1fr]">
      <aside className="glass-panel p-6 flex flex-col gap-6 h-screen overflow-y-auto sticky top-0 max-h-screen">
        <div className="flex items-center justify-between flex-shrink-0">
          <Logo variant="horizontal" />
        </div>
        <nav className="flex flex-col gap-2 flex-shrink-0">
          {/* Dashboard always at top */}
          <NavItem to="/dashboard" label="Dashboard" />
          {/* Expandable groups in the middle */}
          <div className="flex flex-col gap-2 mt-2 mb-2">
            {/* DESIGN group */}
            <div>
              <button
                className="w-full flex items-center justify-between px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-wave focus:outline-none"
                onClick={() => toggleGroup('design')}
                type="button"
              >
                DESIGN
                <span className={`ml-2 transition-transform ${expanded.design ? '' : 'rotate-180'}`}>▼</span>
              </button>
              {expanded.design && (
                <div className="pl-2 flex flex-col gap-1 mt-1">
                  <NavItem to="/chat" label="AI Agent Chat" />
                  <NavItem to="/advisor" label="Modeling Advisor" />
                  <NavItem to="/history" label="History" />
                </div>
              )}
            </div>
            {/* ANALYSIS group */}
            <div>
              <button
                className="w-full flex items-center justify-between px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-wave focus:outline-none"
                onClick={() => toggleGroup('analysis')}
                type="button"
              >
                ANALYSIS
                <span className={`ml-2 transition-transform ${expanded.analysis ? '' : 'rotate-180'}`}>▼</span>
              </button>
              {expanded.analysis && (
                <div className="pl-2 flex flex-col gap-1 mt-1">
                  <NavItem to="/compare" label="Compare" />
                  <NavItem to="/analytics" label="Analytics" />
                </div>
              )}
            </div>
            {/* PERFORMANCE & GROWTH group */}
            <div>
              <button
                className="w-full flex items-center justify-between px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-wave focus:outline-none"
                onClick={() => toggleGroup('perf')}
                type="button"
              >
                PERFORMANCE & GROWTH
                <span className={`ml-2 transition-transform ${expanded.perf ? '' : 'rotate-180'}`}>▼</span>
              </button>
              {expanded.perf && (
                <div className="pl-2 flex flex-col gap-1 mt-1">
                  <NavItem to="/evolution" label="Schema Evolution" />
                  <NavItem to="/query-latency" label="Query Latency" />
                  <NavItem to="/access-patterns" label="Access Patterns" />
                </div>
              )}
            </div>
          </div>
          {/* Profile just below PERFORMANCE & GROWTH */}
          <NavItem to="/profile" label="Profile" />
        </nav>
        <div className="mt-auto data-card p-4 text-sm flex-shrink-0">
          <p className="text-slate mt-2">Signed in as</p>
          <p className="font-medium text-ink truncate">{user.email}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 text-wave hover:text-amber font-semibold"
          >
            Log out
          </button>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center rounded-full bg-wave text-white px-4 py-2 text-sm shadow-soft flex-shrink-0"
        >
          New Schema
        </Link>
      </aside>
      <main className="px-6 py-8 lg:px-12 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
