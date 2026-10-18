import { liveQuery, type Subscription } from 'dexie';
import {
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type Ref,
  type WatchSource,
} from 'vue';

/**
 * Risultato reattivo di una query Dexie: si aggiorna da solo quando i dati cambiano.
 * `deps` rilancia la query quando cambiano i parametri (es. id dalla route).
 */
export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps: WatchSource[] = [],
  initial?: T,
): { data: Ref<T | undefined>; loading: Ref<boolean> } {
  const data = shallowRef<T | undefined>(initial);
  const loading = ref(true);
  let sub: Subscription | undefined;

  const start = () => {
    sub?.unsubscribe();
    loading.value = true;
    sub = liveQuery(querier).subscribe({
      next: (v) => {
        data.value = v;
        loading.value = false;
      },
      error: (e) => {
        console.error(e);
        loading.value = false;
      },
    });
  };

  if (deps.length) watch(deps, start, { immediate: true });
  else start();

  if (getCurrentScope()) onScopeDispose(() => sub?.unsubscribe());
  return { data, loading };
}
