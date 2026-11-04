// origin: video-shotcraft demos/_fixtures/Polish.tsx SpeedBlur — directional motion blur along the
// screen velocity, nothing once still.
import React from "react";

export const SpeedBlur: React.FC<{ vx: number; vy?: number; amount?: number; max?: number; children: React.ReactNode; id: string }> = ({ vx, vy = 0, amount = 0.3, max = 22, children, id }) => {
  const speed = Math.hypot(vx, vy);
  const sd = Math.min(max, speed * amount);
  const fill: React.CSSProperties = { position: "absolute", inset: 0 };
  if (sd < 0.35) return <div style={fill}>{children}</div>;
  const deg = (Math.atan2(vy, vx) * 180) / Math.PI;
  const fid = `speedblur-${id}`;
  return (
    <div style={fill}>
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <filter id={fid} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${sd.toFixed(2)} 0`} edgeMode="none" />
        </filter>
      </svg>
      <div style={{ ...fill, transform: `rotate(${deg}deg)`, filter: `url(#${fid})` }}>
        <div style={{ ...fill, transform: `rotate(${-deg}deg)` }}>{children}</div>
      </div>
    </div>
  );
};
