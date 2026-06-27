import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { PedidoMapa } from '../types';
import { USE_MOCK_DATA } from '../constants/columns';
import { db } from './firebase';
import {
  buildPedidoReviewKey,
  reviewDocId,
  todayReviewDateBR,
} from './pedidoReviewQueue';

export interface PedidoDailyReview {
  reviewDate: string;
  pedidoKey: string;
  rowNum: number;
  mapaKind: string;
  mapaSpreadsheetId?: string;
  reviewedBy: string;
  reviewedByName: string;
  statusSnapshot: string;
  obsClienteSnapshot: string;
  reviewedAt?: string;
}

const COLLECTION = 'pedidoDailyReviews';
const MOCK_STORAGE_KEY = 'binsight_daily_reviews';

function mapReview(data: Record<string, unknown>): PedidoDailyReview {
  return {
    reviewDate: String(data.reviewDate ?? ''),
    pedidoKey: String(data.pedidoKey ?? ''),
    rowNum: Number(data.rowNum ?? 0),
    mapaKind: String(data.mapaKind ?? 'pedido'),
    mapaSpreadsheetId: data.mapaSpreadsheetId ? String(data.mapaSpreadsheetId) : undefined,
    reviewedBy: String(data.reviewedBy ?? ''),
    reviewedByName: String(data.reviewedByName ?? ''),
    statusSnapshot: String(data.statusSnapshot ?? ''),
    obsClienteSnapshot: String(data.obsClienteSnapshot ?? ''),
    reviewedAt: data.reviewedAt ? String(data.reviewedAt) : undefined,
  };
}

function loadMockReviews(reviewDate: string): PedidoDailyReview[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as PedidoDailyReview[];
    return all.filter((r) => r.reviewDate === reviewDate);
  } catch {
    return [];
  }
}

function saveMockReviews(reviewDate: string, reviews: PedidoDailyReview[]): void {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    const all: PedidoDailyReview[] = raw ? JSON.parse(raw) : [];
    const rest = all.filter((r) => r.reviewDate !== reviewDate);
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify([...rest, ...reviews]));
  } catch {
    /* ignore */
  }
}

export function subscribeDailyReviews(
  reviewDate: string,
  onChange: (reviews: PedidoDailyReview[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (USE_MOCK_DATA) {
    const emit = () => onChange(loadMockReviews(reviewDate));
    emit();
    const handler = (e: StorageEvent) => {
      if (e.key === MOCK_STORAGE_KEY) emit();
    };
    window.addEventListener('storage', handler);
    const interval = window.setInterval(emit, 1500);
    return () => {
      window.removeEventListener('storage', handler);
      window.clearInterval(interval);
    };
  }

  const q = query(collection(db, COLLECTION), where('reviewDate', '==', reviewDate));
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => mapReview(d.data() as Record<string, unknown>)));
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err)))
  );
}

export async function markPedidoReviewed(
  pedido: PedidoMapa,
  reviewer: { email: string; displayName: string }
): Promise<void> {
  const reviewDate = todayReviewDateBR();
  const pedidoKey = buildPedidoReviewKey(pedido);
  const payload: PedidoDailyReview = {
    reviewDate,
    pedidoKey,
    rowNum: pedido.rowNum,
    mapaKind: pedido.mapaKind ?? 'pedido',
    mapaSpreadsheetId: pedido.mapaSpreadsheetId,
    reviewedBy: reviewer.email.trim().toLowerCase(),
    reviewedByName: reviewer.displayName.trim() || reviewer.email,
    statusSnapshot: String(pedido.status ?? ''),
    obsClienteSnapshot: String(pedido.obsCliente ?? ''),
    reviewedAt: new Date().toISOString(),
  };

  if (USE_MOCK_DATA) {
    const current = loadMockReviews(reviewDate).filter((r) => r.pedidoKey !== pedidoKey);
    saveMockReviews(reviewDate, [...current, payload]);
    window.dispatchEvent(new StorageEvent('storage', { key: MOCK_STORAGE_KEY }));
    return;
  }

  const id = reviewDocId(reviewDate, pedidoKey);
  await setDoc(doc(db, COLLECTION, id), {
    ...payload,
    reviewedAt: serverTimestamp(),
  });
}

export async function unmarkPedidoReviewed(pedido: PedidoMapa): Promise<void> {
  const reviewDate = todayReviewDateBR();
  const pedidoKey = buildPedidoReviewKey(pedido);

  if (USE_MOCK_DATA) {
    const current = loadMockReviews(reviewDate).filter((r) => r.pedidoKey !== pedidoKey);
    saveMockReviews(reviewDate, current);
    window.dispatchEvent(new StorageEvent('storage', { key: MOCK_STORAGE_KEY }));
    return;
  }

  const id = reviewDocId(reviewDate, pedidoKey);
  await deleteDoc(doc(db, COLLECTION, id));
}

export function reviewedKeysSet(reviews: PedidoDailyReview[]): Set<string> {
  return new Set(reviews.map((r) => r.pedidoKey));
}

export function reviewByPedidoKey(
  reviews: PedidoDailyReview[]
): Map<string, PedidoDailyReview> {
  return new Map(reviews.map((r) => [r.pedidoKey, r]));
}
