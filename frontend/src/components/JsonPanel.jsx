const JsonPanel = ({ title, data }) => {
  return (
    <section className="data-card p-5">
      <h3 className="text-sm uppercase tracking-[0.3em] text-wave font-semibold">
        {title}
      </h3>
      <pre className="mt-4 text-xs bg-mist/60 p-4 rounded-xl overflow-auto text-slate">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
};

export default JsonPanel;
