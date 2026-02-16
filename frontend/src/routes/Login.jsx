import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import Logo from "../components/Logo";
import { useAuth } from "../state/auth";

const Login = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="data-card w-full max-w-md p-8">
        <div className="flex justify-center mb-6">
          <Logo variant="horizontal" />
        </div>
        <h1 className="font-display text-2xl text-center">Welcome back</h1>
        <p className="text-center text-slate mt-2">Sign in to generate your next schema.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-xl border border-slate/20 px-4 py-3"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate/20 px-4 py-3"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p className="text-sm text-amber">{error}</p>}
          <button
            className="w-full rounded-full bg-wave text-white py-3 font-semibold shadow-soft"
            disabled={loading}
            type="submit"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-slate mt-6">
          New here? <Link className="text-wave font-semibold" to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
