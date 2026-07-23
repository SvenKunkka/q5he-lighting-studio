import { useEffect, useRef } from 'react';

export function useAnimationFrame(callback: (time: number) => void, active = true) {
  const cbRef = useRef(callback);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) return;
    const loop = (time: number) => {
      try {
        cbRef.current(time);
      } finally {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);
}
