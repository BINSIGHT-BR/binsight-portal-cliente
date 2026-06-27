import { useEffect, useMemo, useState } from 'react';
import { PedidoMapa } from '../types';
import {
  PedidoDailyReview,
  reviewByPedidoKey,
  subscribeDailyReviews,
} from '../utils/pedidoDailyReview';
import {
  buildPedidoReviewKey,
  filterDailyReviewQueue,
  todayReviewDateBR,
} from '../utils/pedidoReviewQueue';

export function useDailyReviewState(pedidos: PedidoMapa[]) {
  const reviewDate = todayReviewDateBR();
  const [reviews, setReviews] = useState<PedidoDailyReview[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    return subscribeDailyReviews(
      reviewDate,
      setReviews,
      (err) => setError(err.message)
    );
  }, [reviewDate]);

  const queue = useMemo(() => filterDailyReviewQueue(pedidos), [pedidos]);
  const reviewMap = useMemo(() => reviewByPedidoKey(reviews), [reviews]);

  const remaining = useMemo(
    () => queue.filter((p) => !reviewMap.has(buildPedidoReviewKey(p))),
    [queue, reviewMap]
  );

  const reviewed = useMemo(
    () => queue.filter((p) => reviewMap.has(buildPedidoReviewKey(p))),
    [queue, reviewMap]
  );

  return {
    reviewDate,
    queue,
    remaining,
    reviewed,
    reviewMap,
    reviews,
    remainingCount: remaining.length,
    reviewedCount: reviewed.length,
    totalCount: queue.length,
    error,
  };
}
