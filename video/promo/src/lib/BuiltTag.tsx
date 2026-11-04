// The hackathon rule asks that judges can tell what was built during the event: from the first look
// at the app to the end card, a tag in the corner says all of it was.
import React from "react";
import { C, F } from "./theme";
import { prog, useSec } from "./time";
import { Mark } from "./ui";

export const BuiltTag: React.FC = () => {
  const t = useSec();
  const k = prog(t, 0.2, 0.7);
  return (
    <div
      style={{
        position: "absolute",
        left: 36,
        top: 30,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 20px 9px 12px",
        borderRadius: 999,
        background: "rgba(45, 32, 22, 0.88)",
        color: "#fbf3e1",
        fontFamily: F.ui,
        fontWeight: 600,
        fontSize: 25,
        letterSpacing: "0.01em",
        opacity: k,
        transform: `translateX(${(1 - k) * -30}px)`,
        boxShadow: "0 6px 18px rgba(30,20,10,0.25)",
        zIndex: 50,
      }}
    >
      <Mark size={30} id="tag" />
      <span>
        Built at the Meta AI Developer Hackathon <span style={{ color: C.goldLight }}>· Oct 26 – Nov 4</span>
      </span>
    </div>
  );
};
