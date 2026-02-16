const Analytics = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Analytics</h1>
        <p className="text-slate mt-2">Insights across all generated schemas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {["Embed vs Reference", "Top Entities", "Workload Mix"].map((title) => (
          <div key={title} className="data-card p-5">
            <p className="text-sm uppercase tracking-[0.2em] text-wave font-semibold">{title}</p>
            <div className="mt-4 h-28 rounded-2xl bg-mist/70 border border-slate/10" />
          </div>
        ))}
      </div>

      <div className="data-card p-6">
        <h2 className="font-display text-xl">Charts coming soon</h2>
        <p className="text-slate mt-2">This area will host interactive graphs and trend lines.</p>
      </div>
    </div>
  );
};

export default Analytics;
