import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-slate-900 to-rose-900 text-white">
      <style>{`
        @keyframes floaty { 0% { transform: translateY(0px) } 50% { transform: translateY(-18px) } 100% { transform: translateY(0px) } }
        .floaty { animation: floaty 6s ease-in-out infinite; }
        .fade-in-up { transform: translateY(8px); opacity: 0; animation: fadeUp 0.8s ease forwards; }
        @keyframes fadeUp { to { transform: translateY(0); opacity: 1 } }
      `}</style>

      <div className="relative w-full max-w-6xl px-6 py-20">
        {/* animated background blobs */}
        <div className="absolute inset-0 overflow-hidden -z-10">
          <div className="absolute -left-20 -top-20 w-80 h-80 bg-gradient-to-tr from-pink-500/40 via-rose-400/30 to-transparent rounded-full blur-3xl floaty" />
          <div className="absolute right-10 top-10 w-60 h-60 bg-gradient-to-tr from-indigo-400/30 via-sky-300/20 to-transparent rounded-full blur-2xl floaty" style={{ animationDelay: '1.5s' }} />
          <div className="absolute left-1/2 bottom-10 -translate-x-1/2 w-[420px] h-[420px] bg-gradient-to-tr from-yellow-400/20 via-orange-300/10 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">Design MongoDB Schemas with AI</h1>
            <p className="text-slate-200 max-w-xl">MongoArchitect AI helps you model collections, indexes and relationships with instant LLM-driven suggestions, versioning, and actionable insights tailored to your workload.</p>

            <div className="flex flex-wrap gap-3 mt-4">
              <Link to="/signup" className="inline-flex items-center px-5 py-3 bg-wave hover:bg-wave/90 text-white rounded-lg font-semibold shadow-lg transition">
                Get Started — It's Free
              </Link>
              <Link to="/login" className="inline-flex items-center px-5 py-3 border border-white/20 text-white rounded-lg hover:bg-white/5 transition">
                Sign In
              </Link>
            </div>

            <div className="mt-6 text-sm text-slate-300">Or try the AI Agent after signing up to generate schemas from natural language.</div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-md p-6 bg-white/5 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-lg">
              <div className="text-xs text-slate-300 uppercase tracking-wider mb-3">Live Preview</div>
              <div className="h-48 bg-gradient-to-b from-white/5 to-white/3 rounded-lg p-4 relative">
                <div className="absolute -top-6 -left-6 w-16 h-16 bg-white/6 rounded-lg blur-sm" />
                <div className="space-y-2">
                  <div className="h-4 bg-white/20 rounded w-2/3 animate-pulse" />
                  <div className="h-3 bg-white/10 rounded w-1/2 animate-pulse" />
                  <div className="h-3 bg-white/10 rounded w-5/6 animate-pulse" />
                </div>
                <svg className="absolute right-3 bottom-3 w-24 h-24 opacity-60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 80 C 30 10, 70 10, 90 80" stroke="url(#g)" strokeWidth="3" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="g" x1="0" x2="1">
                      <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#fff" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-slate-300">
          <p className="text-sm">Built for engineers and product teams — accelerate schema design, avoid costly mistakes, and scale with confidence.</p>
        </div>
      </div>
    </div>
  );
}
