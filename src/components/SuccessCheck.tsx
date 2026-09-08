"use client";

import { useEffect, useRef, useState } from "react";

import { CheckIcon } from "./icons";

/**
 * Coche de succès — transitions.dev n°10 : fondu + rotation + flou + rebond en
 * Y, et le trait qui se dessine. Le CSS porte l'animation, ce composant ne fait
 * que basculer `data-state` après le montage pour que les keyframes partent.
 */
export function SuccessCheck() {
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<"out" | "in">("out");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setState("in"));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span className="wt-success-badge">
      <span ref={ref} className="wt-success-check" data-state={state} aria-hidden="true">
        <CheckIcon />
      </span>
    </span>
  );
}
