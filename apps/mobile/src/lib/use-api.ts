import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Load a screen's data, with pull-to-refresh. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (pull = false) => {
    if (!path) return;
    if (pull) setRefreshing(true);
    try { setData(await api<T>(path)); setError(null); } catch (e) { setError((e as Error).message); } finally { setRefreshing(false); }
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { data, error, refreshing, reload: () => load(true), refetch: () => load(), setData };
}
