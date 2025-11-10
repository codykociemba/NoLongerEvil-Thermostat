import { useEffect, useRef, useState } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  resistance?: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
}: UsePullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);

  useEffect(() => {
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        touchStartY = e.touches[0].clientY;
        startY.current = touchStartY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY > 0 || isRefreshing) return;

      currentY.current = e.touches[0].clientY;
      const diff = currentY.current - startY.current;

      if (diff > 0) {
        setIsPulling(true);
        const distance = Math.min(diff / resistance, threshold * 1.5);
        setPullDistance(distance);

        if (distance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);

        if (navigator.vibrate) {
          navigator.vibrate([10, 50, 10]);
        }

        try {
          await onRefresh();
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setIsPulling(false);
            setPullDistance(0);
          }, 500);
        }
      } else {
        setIsPulling(false);
        setPullDistance(0);
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onRefresh, threshold, resistance, pullDistance, isRefreshing]);

  return {
    isPulling,
    isRefreshing,
    pullDistance,
    progress: Math.min((pullDistance / threshold) * 100, 100),
  };
}
