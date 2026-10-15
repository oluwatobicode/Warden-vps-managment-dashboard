import { useEffect, useState } from "react";

/**
 * A number that steps 0 → length-1 and wraps, every `ms`. Drives the landing
 * page's little demos (hero tag, activity feed).
 */
export function useCycle(length: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % length), ms);
    return () => clearInterval(t);
  }, [length, ms]);
  return i;
}
