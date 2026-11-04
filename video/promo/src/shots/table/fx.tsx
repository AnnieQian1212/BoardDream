// origin: video-shotcraft demos/_fixtures/Polish.tsx (SpeedBlur, velocity), the template's tuned
// directional motion blur: blur only along the motion, only while it is fast.
import React from "react";

export const velocity = (f: (t: number) => number, t: number, dt = 1 / 60) => (f(t + dt / 2) - f(t - dt / 2)) / (dt * 30);

export const SpeedBlur: React.FC<{ vx: number; vy?: number; amount?: number; max?: number; children: React.ReactNode; id: string }> = ({ vx, vy = 0, amount = 0.45, max = 36, children, id }) => {
  const speed = Math.hypot(vx, vy);
  const sd = Math.min(max, speed * amount);
  const fill: React.CSSProperties = { position: "absolute", inset: 0 };
  if (sd < 0.35) return <div style={fill}>{children}</div>;
  const deg = (Math.atan2(vy, vx) * 180) / Math.PI;
  return (
    <div style={fill}>
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${sd.toFixed(2)} 0`} edgeMode="none" />
        </filter>
      </svg>
      <div style={{ ...fill, transform: `rotate(${deg}deg)`, filter: `url(#${id})` }}>
        <div style={{ ...fill, transform: `rotate(${-deg}deg)` }}>{children}</div>
      </div>
    </div>
  );
};
