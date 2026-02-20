const buildLinePoints = (values, width, height) => {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
};

const buildAreaPath = (values, width, height) => {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });

  const pathStart = `M ${points[0].x} ${height}`;
  const pathPoints = points.map((point) => `L ${point.x} ${point.y}`).join(" ");
  const pathEnd = `L ${points[points.length - 1].x} ${height} Z`;

  return `${pathStart} ${pathPoints} ${pathEnd}`;
};

import { useMemo, useRef, useState } from "react";

const Sparkline = ({
  values,
  height = 44,
  width = 160,
  stroke = "#3A7CA5",
  fill = "rgba(58, 124, 165, 0.18)",
  tooltip,
}) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const containerRef = useRef(null);

  const sanitized = values.filter((value) => Number.isFinite(value));

  const lineValues = useMemo(() => {
    if (sanitized.length === 1) {
      return [sanitized[0], sanitized[0]];
    }
    return sanitized;
  }, [sanitized]);

  if (sanitized.length === 0) {
    return <div className="text-xs text-slate">Not enough data</div>;
  }

  const points = buildLinePoints(lineValues, width, height);
  const areaPath = buildAreaPath(lineValues, width, height);

  const handleMove = (event) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const count = sanitized.length;

    if (count === 1) {
      setHoverIndex(0);
      setHoverX(rect.width / 2);
      return;
    }

    const index = Math.round((x / rect.width) * (count - 1));
    setHoverIndex(index);
    setHoverX((index / (count - 1)) * rect.width);
  };

  const handleLeave = () => {
    setHoverIndex(null);
  };

  const activeValue =
    hoverIndex === null ? null : sanitized[Math.min(hoverIndex, sanitized.length - 1)];

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-12"
        aria-hidden="true"
      >
        {tooltip && <title>{tooltip}</title>}
        <path d={areaPath} fill={fill} />
        <polyline
          points={points}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {hoverIndex !== null && (
        <>
          <div
            className="absolute top-0 bottom-0 w-px bg-slate/30"
            style={{ left: `${hoverX}px` }}
          />
          <div
            className="absolute -top-8 px-2 py-1 rounded-md text-xs bg-wave text-white shadow-lg shadow-wave/30 border border-white/10"
            style={{ left: `${hoverX}px`, transform: "translateX(-50%)" }}
          >
            {activeValue?.toFixed ? activeValue.toFixed(1) : activeValue}
          </div>
        </>
      )}
    </div>
  );
};

export default Sparkline;
