import { useEffect, useMemo, useRef, useState } from 'react';
import { UserCouponView } from '@/shared/types/coupon';

interface UseAvailableOrderCouponsOptions {
  enabled: boolean;
  orderAmount: number;
  overviewCoupons: UserCouponView[];
  loadAvailableCoupons: (orderAmount: number) => Promise<UserCouponView[]>;
}

interface AvailableOrderCouponsState {
  coupons: UserCouponView[];
  error: string | null;
  loading: boolean;
  ready: boolean;
}

interface LoadedCouponScope {
  loadAvailableCoupons: UseAvailableOrderCouponsOptions['loadAvailableCoupons'];
  orderAmount: number;
}

const EMPTY_COUPONS: UserCouponView[] = [];

export function useAvailableOrderCoupons({
  enabled,
  orderAmount,
  overviewCoupons,
  loadAvailableCoupons,
}: UseAvailableOrderCouponsOptions): AvailableOrderCouponsState {
  const requestGenerationRef = useRef(0);
  const [loadedScope, setLoadedScope] = useState<LoadedCouponScope | null>(null);
  const [loadedCoupons, setLoadedCoupons] = useState<UserCouponView[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generation = ++requestGenerationRef.current;
    if (!enabled) {
      setLoadedScope(null);
      setLoadedCoupons([]);
      setLoading(false);
      setReady(false);
      setError(null);
      return;
    }

    setLoadedScope({ loadAvailableCoupons, orderAmount });
    setLoadedCoupons([]);
    setLoading(true);
    setReady(false);
    setError(null);

    const load = async () => {
      try {
        const coupons = await loadAvailableCoupons(orderAmount);
        if (requestGenerationRef.current !== generation) return;
        setLoadedCoupons(coupons);
        setReady(true);
      } catch (loadError) {
        if (requestGenerationRef.current !== generation) return;
        setError(loadError instanceof Error ? loadError.message : '쿠폰 조회에 실패했습니다.');
      } finally {
        if (requestGenerationRef.current === generation) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      if (requestGenerationRef.current === generation) {
        requestGenerationRef.current += 1;
      }
    };
  }, [enabled, loadAvailableCoupons, orderAmount]);

  const ownsCurrentRequest = Boolean(
    enabled
    && loadedScope?.loadAvailableCoupons === loadAvailableCoupons
    && loadedScope.orderAmount === orderAmount,
  );
  const visibleLoadedCoupons = ownsCurrentRequest ? loadedCoupons : EMPTY_COUPONS;

  const coupons = useMemo(() => {
    const merged = new Map<string, UserCouponView>();
    overviewCoupons.forEach((coupon) => merged.set(coupon.id, coupon));
    visibleLoadedCoupons.forEach((coupon) => merged.set(coupon.id, coupon));
    return Array.from(merged.values());
  }, [overviewCoupons, visibleLoadedCoupons]);

  return {
    coupons,
    error: ownsCurrentRequest ? error : null,
    loading: enabled && (!ownsCurrentRequest || loading),
    ready: ownsCurrentRequest && ready,
  };
}
