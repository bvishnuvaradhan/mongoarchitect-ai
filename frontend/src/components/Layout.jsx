import { Link, Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../state/auth";
import Logo from "./Logo";
import NavItem from "./NavItem";

const Layout = () => {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();

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
          <NavItem to="/dashboard" label="Dashboard" />
          <NavItem to="/chat" label="AI Agent Chat" />
          <NavItem to="/history" label="History" />
          <NavItem to="/compare" label="Compare" />
          <NavItem to="/analytics" label="Analytics" />
          <NavItem to="/profile" label="Profile" />
        </nav>
        <div className="mt-auto data-card p-4 text-sm flex-shrink-0">
          <p className="text-slate">Signed in as</p>
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
