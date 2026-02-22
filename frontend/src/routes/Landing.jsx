import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function MockPreview() {
  const scenarios = [
    {
      query: " Generate MongoDB schema for e-commerce, optimized for balanced.",
      schema: `{
  "collections": {
    "users": ["_id", "name", "email"],
    "products": ["_id", "name", "category", "price", "rating"],
    "orders": ["_id", "user_id", "items", "total_amount", "status"]
  }
}`,
    },
    {
      query: " Generate MongoDB schema for social media, optimized for read-heavy.",
      schema: `{
  "collections": {
    "users": ["_id", "username", "followers_count"],
    "posts": ["_id", "user_id", "content", "likes_count"],
    "comments": ["_id", "post_id", "user_id", "text"]
  }
}`,
    },
    {
      query: " Generate MongoDB schema for IoT telemetry, optimized for time-series.",
      schema: `{
  "collections": {
    "devices": ["_id", "device_id", "location"],
    "sensor_readings": ["_id", "device_id", "temperature", "humidity"],
    "alerts": ["_id", "device_id", "alert_type", "triggered_at"]
  }
}`,
    },
  ];

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState("typing");
  const [query, setQuery] = useState("");
  const [displayedSchema, setDisplayedSchema] = useState("");

  useEffect(() => {
    let timers = [];

    const startTyping = () => {
      setQuery("");
      setDisplayedSchema("");
      setPhase("typing");
      const fullQuery = scenarios[idx].query || "";
      let i = 0;
      const t = setInterval(() => {
        if (i >= fullQuery.length) {
          clearInterval(t);
          timers.push(setTimeout(() => setPhase("generating"), 600));
          return;
        }
        const ch = fullQuery[i];
        if (typeof ch !== "string") {
          // defensive: skip undefined/non-string characters
          i += 1;
          return;
        }
        setQuery((s) => s + ch);
        i += 1;
      }, 28);
      timers.push(t);
    };

    if (phase === "typing") startTyping();

    if (phase === "generating") {
      timers.push(setTimeout(() => setPhase("revealing"), 900));
    }

    if (phase === "revealing") {
      const schema = scenarios[idx].schema;
      let j = 0;
      const t = setInterval(() => {
        setDisplayedSchema(schema.slice(0, j));
        j += 3;
        if (j > schema.length) {
          setDisplayedSchema(schema);
          setPhase("done");
          clearInterval(t);
        }
      }, 20);
      timers.push(t);
    }

    if (phase === "done") {
      // after a short pause, move to next scenario
      timers.push(setTimeout(() => {
        setIdx((p) => (p + 1) % scenarios.length);
        setPhase("typing");
      }, 1800));
    }

    return () => timers.forEach((t) => clearTimeout(t));
  }, [phase, idx]);

  useEffect(() => {
    // Kick off when idx changes
    setQuery("");
    setDisplayedSchema("");
    setPhase("typing");
  }, [idx]);

  return (
    <div className="w-full h-full p-3 flex flex-col">
      <div className="flex gap-2 items-center mb-3">
        <div className="flex-1 bg-white/5 rounded px-3 py-2 text-sm text-slate">{query || <span className="text-slate/60">Describe your app...</span>}</div>
        <div className="px-3 py-2 rounded bg-wave/80 text-white text-xs font-medium">
          {phase === "generating" ? "Generating..." : phase === "done" ? "Done" : "Generate"}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-black/40 rounded p-3 text-xs font-mono text-ink">
        {displayedSchema ? (
          <pre className="whitespace-pre-wrap">{displayedSchema}</pre>
        ) : (
          <div className="text-slate/70">{phase === "generating" ? "…thinking" : "A clean product screenshot"}</div>
        )}
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-mist text-ink">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-mist/60 backdrop-blur border-b border-wave/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-horizontal.png" alt="MongoArchitect AI" className="h-8" />
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate">
            <a href="#features" className="hover:text-wave">Features</a>
            <a href="#how" className="hover:text-wave">How It Works</a>
            <a href="#architecture" className="hover:text-wave">Architecture</a>
            <Link to="/login" className="hover:text-wave">Login</Link>
            <Link to="/signup" className="inline-flex items-center px-4 py-2 bg-wave text-white rounded-lg shadow-sm">🚀 Get Started</Link>
          </nav>
          <div className="md:hidden">
            <Link to="/signup" className="inline-flex items-center px-3 py-2 bg-wave text-white rounded">Get Started</Link>
          </div>
        </div>
      </header>

      <main className="pt-20">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-extrabold text-ink">Design Smarter MongoDB Architectures.<br />Eliminate Surprise Infrastructure Costs Before You Deploy.</h1>
            <p className="text-slate max-w-xl">AI-powered schema design, cost forecasting, and performance simulation — engineered for production-scale MongoDB environments.</p>

            <div className="flex items-center gap-4 mt-6">
              <Link to="/signup" className="px-6 py-3 bg-wave text-white rounded-lg font-semibold shadow">🚀 Get Started</Link>
              <a href="#demo" className="px-4 py-3 border border-wave/20 rounded-lg text-slate hover:bg-wave/5">▶️ Watch Demo</a>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-lg p-6 bg-white/5 border border-wave/10 rounded-2xl shadow-lg">
              <div className="h-64 bg-blush/30 rounded-lg overflow-hidden flex items-center justify-center">
                <MockPreview />
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section id="problem" className="bg-mist/50 border-t border-wave/10 py-12">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-ink">The Hidden Cost of Poor MongoDB Design</h2>
            <p className="mt-4 font-semibold text-ink">Poor schema decisions can silently multiply your infrastructure costs at scale.</p>
            <div className="mt-4 grid md:grid-cols-2 gap-6 text-slate">
              <ul className="space-y-2">
                <li>• Unexpected Atlas bills</li>
                <li>• Tier upgrade surprises</li>
                <li>• Over-indexing & storage waste</li>
              </ul>
              <ul className="space-y-2">
                <li>• IOPS bottlenecks under peak load</li>
                <li>• Performance issues discovered too late</li>
              </ul>
            </div>
            <p className="mt-4 font-semibold text-ink">Most tools react after deployment.<br />MongoArchitect AI prevents costly failures before they happen.</p>
          </div>
        </section>

        {/* Solution - 3 Intelligence Layers */}
        <section id="solution" className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-ink">End-to-End MongoDB Architecture Intelligence Platform</h2>
            <div className="mt-8 grid md:grid-cols-3 gap-6">
              <div className="p-6 bg-white/5 border border-wave/10 rounded-lg">
                <h3 className="font-semibold text-wave">AI-Powered Schema Design</h3>
                <p className="text-slate text-sm mt-2">Generate production-ready schemas using AI. Get modeling guidance before writing a single query.</p>
              </div>
              <div className="p-6 bg-white/5 border border-wave/10 rounded-lg">
                <h3 className="font-semibold text-wave">Predictive Cost Modeling</h3>
                <p className="text-slate text-sm mt-2">Forecast storage, IOPS, and tier upgrades across 12 months. Compare architectures before committing.</p>
              </div>
              <div className="p-6 bg-white/5 border border-wave/10 rounded-lg">
                <h3 className="font-semibold text-wave">Performance &amp; Scalability Simulation</h3>
                <p className="text-slate text-sm mt-2">Simulate workloads, analyze query latency, and predict scaling limits.</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how" className="bg-mist/50 py-12">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-ink">How It Works</h2>
            <div className="mt-8 grid md:grid-cols-3 gap-6 text-slate">
              <div className="p-4 text-center">
                <div className="text-2xl font-bold">1️⃣</div>
                <h4 className="font-semibold mt-2">Describe Your Application</h4>
                <p className="text-sm mt-1">Explain your app in plain language.</p>
              </div>
              <div className="p-4 text-center">
                <div className="text-2xl font-bold">2️⃣</div>
                <h4 className="font-semibold mt-2">Analyze Architecture Impact</h4>
                <p className="text-sm mt-1">Instantly visualize projected costs, tier upgrades, and performance bottlenecks.</p>
              </div>
              <div className="p-4 text-center">
                <div className="text-2xl font-bold">3️⃣</div>
                <h4 className="font-semibold mt-2">Optimize With Confidence</h4>
                <p className="text-sm mt-1">Apply recommendations and simulate growth scenarios.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights */}
        <section id="features" className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-ink">Powerful Capabilities Built for Real-World Architectures</h2>
            <div className="mt-6 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                ["AI Schema Generator","Transform natural language into structured MongoDB schemas."],
                ["Cost Estimator","Forecast storage growth, IOPS demand, and tier trajectory."],
                ["Architecture Compare","Evaluate architecture designs side-by-side before deployment."],
                ["Query Latency Modeling","Simulate realistic query performance under production workloads."],
                ["Access Pattern Simulation","Identify workload hotspots and scaling risks early."],
                ["Schema Evolution Tracking","Versioned changes with structured diffs."]
              ].map(([title, sub]) => (
                <div key={title} className="p-4 bg-white/5 border border-wave/10 rounded-lg">
                  <div className="font-semibold text-wave">{title}</div>
                  <div className="text-slate text-sm mt-1">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust Signal Section */}
        <section className="py-12 bg-mist/40">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h3 className="text-xl font-semibold text-ink">Built for Developers Who Take Architecture Seriously</h3>
            <div className="mt-3 text-slate max-w-2xl mx-auto space-y-1">
              <div>Built for teams running production-scale MongoDB systems.</div>
              <div>Backed by lifecycle architecture intelligence.</div>
              <div>Powered by real cost modeling logic.</div>
            </div>
            <p className="mt-4 text-slate/70">MongoArchitect AI shifts MongoDB optimization from reactive monitoring to proactive architecture intelligence.</p>
          </div>
        </section>

        {/* Why Different */}
        <section className="bg-mist/50 py-12">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-ink">Why It Matters</h2>
            <p className="mt-4 text-slate max-w-2xl">Traditional MongoDB tools focus on monitoring performance after deployment.<br />MongoArchitect AI delivers pre-deployment architecture intelligence to eliminate cost surprises, prevent performance failures, and enable predictable scaling.</p>
            <div className="mt-6 grid md:grid-cols-3 gap-4 text-slate">
              <div className="p-4 bg-white/5 border border-wave/10 rounded-lg">Pre-deployment cost forecasting</div>
              <div className="p-4 bg-white/5 border border-wave/10 rounded-lg">Tier trajectory simulation</div>
              <div className="p-4 bg-white/5 border border-wave/10 rounded-lg">Before/After cost impact modeling</div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-wave/5 border-t border-wave/10">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-4xl md:text-5xl font-extrabold leading-none tracking-tight text-ink">Stop Guessing Your MongoDB Costs.<br />Start Designing with Predictable Intelligence.</h2>
            <div className="mt-8">
              <Link to="/signup" className="px-10 py-5 bg-wave text-white rounded-lg font-semibold shadow-lg text-lg">🚀 Start Designing Now</Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t border-wave/10 bg-mist">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo-square.png" alt="MongoArchitect AI" className="h-8" />
              <div className="text-sm text-slate">MongoArchitect AI</div>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate">
              <a href="#features">Features</a>
              <a href="https://github.com/bvishnuvaradhan/mongoarchitect-ai" target="_blank" rel="noreferrer">GitHub</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
          <div className="mt-6 text-center text-xs text-slate">© 2026 MongoArchitect AI</div>
        </footer>
      </main>
    </div>
  );
}
