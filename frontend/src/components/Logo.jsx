import { useState } from "react";

const Logo = ({ variant = "horizontal" }) => {
  const [showImage, setShowImage] = useState(true);
  const imageSrc = variant === "square" ? "/logo-square.png" : "/logo-horizontal.png";

  if (showImage) {
    return (
      <img
        src={imageSrc}
        alt="MongoArchitect AI"
        className={variant === "square" ? "h-16 w-16" : "h-16"}
        onError={() => setShowImage(false)}
      />
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-wave to-amber text-white font-semibold flex items-center justify-center shadow-soft">
        MA
      </div>
      {variant === "horizontal" && (
        <div className="leading-tight">
          <p className="font-display text-lg">MongoArchitect</p>
          <p className="text-xs uppercase tracking-[0.25em] text-slate">AI Studio</p>
        </div>
      )}
    </div>
  );
};

export default Logo;
