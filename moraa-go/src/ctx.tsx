import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Meta, User } from '../shared/types';
import { api } from './api';

interface Ctx {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  meta: Meta | null;
  toast: (msg: string, kind?: 'ok' | 'error') => void;
}
const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const n = useRef(0);

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => {}).finally(() => setReady(true));
    api.meta().then(setMeta).catch(() => {});
  }, []);

  const toast = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => {
    const id = ++n.current;
    setToasts((t) => [...t.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  const value = useMemo(() => ({ user, ready, setUser, meta, toast }), [user, ready, meta, toast]);
  return (
    <C.Provider value={value}>
      {children}
      <div className="toast-zone" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'toast--error' : ''}`}>{t.msg}</div>
        ))}
      </div>
    </C.Provider>
  );
}

/** Carrega dados assíncronos com estados de loading/erro e recarga. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e?.message ?? 'Erro inesperado.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, setData, error, loading, reload: () => setTick((t) => t + 1) };
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — MORAA GO` : 'MORAA GO — Imóveis para alugar em Senador Canedo, Goiânia e região';
  }, [title]);
}

export function useMedia(query: string) {
  const [m, setM] = useState(() => (typeof matchMedia === 'function' ? matchMedia(query).matches : false));
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}
