// @vitest-environment node
/**
 * Tests for useGroupAssignments.
 *
 * Environment: node (not jsdom) — jsdom initialisation takes ~30 s in WSL2 and
 * causes vitest workers to OOM. We use the same React dispatcher harness as
 * useEntraGroupSearch.test.ts to exercise the hook without a DOM.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  CategoryState,
  GroupAssignmentResult,
  IntuneObjectCategory,
  ParentGroupRef,
} from '@/types/graph';
import { ALL_INTUNE_OBJECT_CATEGORIES } from '@/types/graph';

// ---------------------------------------------------------------------------
// Mocks — hoisted by vitest before any module evaluation
// ---------------------------------------------------------------------------
interface ServiceCallbacks {
  signal: AbortSignal;
  onParentGroups: (p: ParentGroupRef[]) => void;
  onCategoryStatus: (cat: IntuneObjectCategory, state: CategoryState) => void;
  onResults: (cat: IntuneObjectCategory, rows: GroupAssignmentResult[]) => void;
}

let lastSignal: AbortSignal | undefined;
const fetchSpy = vi.fn(async (_client: unknown, _gid: string, cb: ServiceCallbacks) => {
  lastSignal = cb.signal;
  cb.onParentGroups([{ id: 'p1', displayName: 'Parent' }]);
  cb.onCategoryStatus('deviceConfiguration', { status: 'loading' });
  cb.onResults('deviceConfiguration', [
    {
      id: 'd1',
      category: 'deviceConfiguration',
      name: 'Pol',
      intent: 'include',
      source: { kind: 'direct' },
      rawObject: {},
    } as GroupAssignmentResult,
  ]);
  cb.onCategoryStatus('deviceConfiguration', { status: 'done', count: 1 });
});

vi.mock('@/services/groupAssignmentService', () => ({
  fetchGroupAssignments: fetchSpy,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    getAccessToken: async () => 'token',
  }),
}));

vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: { initWithMiddleware: () => ({}) },
}));

// ---------------------------------------------------------------------------
// React dispatcher harness — same shape as useEntraGroupSearch.test.ts
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ReactInternals = (require('react') as typeof import('react') & {
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
    ReactCurrentDispatcher: { current: unknown };
  };
}).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

const dispatcher = ReactInternals.ReactCurrentDispatcher;

interface HarnessState {
  stateSlots: unknown[];
  refSlots: Array<{ current: unknown }>;
  pendingEffects: Array<{ fn: () => (() => void) | void; deps: unknown[] | undefined; prevDeps: unknown[] | undefined }>;
  cleanups: Array<(() => void) | void>;
  callCount: number;
  stateIdx: number;
  refIdx: number;
  effectIdx: number;
}

function createHookHarness<T>(hookFn: () => T) {
  const state: HarnessState = {
    stateSlots: [],
    refSlots: [],
    pendingEffects: [],
    cleanups: [],
    callCount: 0,
    stateIdx: 0,
    refIdx: 0,
    effectIdx: 0,
  };

  let currentResult: T;

  const fakeDispatcher = {
    useState<S>(initialState: S | (() => S)): [S, (s: S | ((prev: S) => S)) => void] {
      const idx = state.stateIdx++;
      if (state.callCount === 0) {
        state.stateSlots[idx] = typeof initialState === 'function'
          ? (initialState as () => S)()
          : initialState;
      }
      const setter = (val: S | ((prev: S) => S)) => {
        const next = typeof val === 'function'
          ? (val as (p: S) => S)(state.stateSlots[idx] as S)
          : val;
        if (!Object.is(next, state.stateSlots[idx])) {
          state.stateSlots[idx] = next;
        }
      };
      return [state.stateSlots[idx] as S, setter];
    },

    useEffect(fn: () => (() => void) | void, deps?: unknown[]) {
      const idx = state.effectIdx++;
      const existing = state.pendingEffects[idx];
      if (!existing) {
        state.pendingEffects[idx] = { fn, deps, prevDeps: undefined };
      } else {
        const prevDeps = existing.deps;
        const depsChanged = !deps || !prevDeps ||
          deps.length !== prevDeps.length ||
          deps.some((d, i) => !Object.is(d, prevDeps[i]));
        if (depsChanged) {
          state.pendingEffects[idx] = { fn, deps, prevDeps };
        }
      }
    },

    useRef<R>(initialValue: R): { current: R } {
      const idx = state.refIdx++;
      if (state.callCount === 0) {
        state.refSlots[idx] = { current: initialValue };
      }
      return state.refSlots[idx] as { current: R };
    },

    useCallback: <F>(fn: F) => fn,
    useMemo: <T>(fn: () => T) => fn(),
    useContext: () => undefined,
    useReducer: <S, A>(reducer: (s: S, a: A) => S, init: S): [S, (a: A) => void] => {
      const idx = state.stateIdx++;
      if (state.callCount === 0) state.stateSlots[idx] = init;
      return [state.stateSlots[idx] as S, (action: A) => {
        state.stateSlots[idx] = reducer(state.stateSlots[idx] as S, action);
      }];
    },
    useLayoutEffect: (fn: () => (() => void) | void, deps?: unknown[]) => {
      fakeDispatcher.useEffect(fn, deps);
    },
    useDebugValue: () => {},
    useId: () => ':test:',
    useDeferredValue: <T>(v: T) => v,
    useTransition: (): [boolean, (fn: () => void) => void] => [false, (fn) => fn()],
    useInsertionEffect: () => {},
    useSyncExternalStore: <T>(_sub: unknown, getSnapshot: () => T) => getSnapshot(),
    startTransition: (fn: () => void) => fn(),
    useOptimistic: <T>(v: T) => [v, (_: T) => {}] as [T, (v: T) => void],
    use: <T>(p: T) => p,
    unstable_isNewReconciler: false,
    readContext: () => undefined,
  };

  function render() {
    state.stateIdx = 0;
    state.refIdx = 0;
    state.effectIdx = 0;

    const prevDispatcher = dispatcher.current;
    dispatcher.current = fakeDispatcher;
    try {
      currentResult = hookFn();
    } finally {
      dispatcher.current = prevDispatcher;
    }
    state.callCount++;
  }

  function flushEffects() {
    for (const effect of state.pendingEffects) {
      if (effect) {
        const cleanup = effect.fn();
        if (typeof cleanup === 'function') {
          state.cleanups.push(cleanup);
        }
        effect.fn = () => undefined;
      }
    }
  }

  function flushCleanups() {
    for (const c of state.cleanups) {
      if (typeof c === 'function') c();
    }
    state.cleanups = [];
  }

  return {
    render,
    flushEffects,
    flushCleanups,
    get result() { return currentResult!; },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useGroupAssignments', () => {
  let useGroupAssignments: (typeof import('./useGroupAssignments'))['useGroupAssignments'];

  beforeEach(async () => {
    fetchSpy.mockClear();
    lastSignal = undefined;
    const mod = await import('./useGroupAssignments');
    useGroupAssignments = mod.useGroupAssignments;
  });

  it('initializes all categories as pending then transitions on events', async () => {
    let groupId: string | null = 'g1';
    const harness = createHookHarness(() => useGroupAssignments(groupId));
    harness.render();
    harness.flushEffects();

    // Allow the async IIFE inside the effect to resume past the awaited
    // fetchGroupAssignments call (which fires callbacks synchronously).
    await new Promise((r) => setTimeout(r, 0));

    // Re-render to surface state changes triggered by the callbacks.
    harness.render();

    expect(harness.result.perCategory.deviceConfiguration.status).toBe('done');

    for (const cat of ALL_INTUNE_OBJECT_CATEGORIES) {
      const s = harness.result.perCategory[cat].status;
      expect(s === 'pending' || s === 'done' || s === 'loading' || s === 'error').toBe(true);
    }

    expect(harness.result.results.length).toBeGreaterThan(0);
    expect(harness.result.parentGroups).toEqual([
      { id: 'p1', displayName: 'Parent' },
    ]);
  });

  it('aborts previous request when groupId changes', async () => {
    let groupId: string | null = 'g1';
    const harness = createHookHarness(() => useGroupAssignments(groupId));
    harness.render();
    harness.flushEffects();
    const firstSignal = lastSignal;
    expect(firstSignal).toBeDefined();
    expect(firstSignal!.aborted).toBe(false);

    // Change groupId and re-render → deps change, prior cleanup must abort.
    groupId = 'g2';
    harness.render();
    harness.flushCleanups();

    expect(firstSignal!.aborted).toBe(true);
  });
});
