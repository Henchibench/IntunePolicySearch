// @vitest-environment node
/**
 * Tests for useEntraGroupSearch.
 *
 * Environment: node (not jsdom) — jsdom initialisation takes ~30 s in WSL2
 * and causes vitest workers to OOM before any test runs. react-dom/client has
 * the same problem (30k-line bundle that vite tries to tree-shake).
 *
 * We avoid both by injecting a custom dispatcher directly into React's
 * internal ReactCurrentDispatcher, which is the only mechanism React uses to
 * resolve useState / useEffect / useRef calls. This lets us run the hook as
 * a plain function while still observing state updates and timer-driven
 * async effects — no DOM, no react-dom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted by vitest before any module evaluation
// ---------------------------------------------------------------------------
const mockGet = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    getAccessToken: async () => 'token',
  }),
}));

// Self-referencing chainable builder for `client.api(...).header(...).count(...)
// .filter(...).select(...).top(...).get()` — the new useEntraGroupSearch chain.
// Variable name must start with `mock` for vitest's vi.mock hoisting to allow
// referencing it inside the factory.
const mockBuilder: Record<string, unknown> = { get: mockGet };
for (const m of ['header', 'count', 'filter', 'select', 'top'] as const) {
  mockBuilder[m] = () => mockBuilder;
}
vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    initWithMiddleware: () => ({
      api: () => mockBuilder,
    }),
  },
}));

// ---------------------------------------------------------------------------
// React dispatcher harness
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
  callCount: number; // incremented each render to know which slot index
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

  let pendingSetState = false;
  let currentResult: T;

  const fakeDispatcher = {
    useState<S>(initialState: S | (() => S)): [S, (s: S | ((prev: S) => S)) => void] {
      const idx = state.stateIdx++;
      if (state.callCount === 0) {
        // First render — initialize
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
          pendingSetState = true;
        }
      };
      return [state.stateSlots[idx] as S, setter];
    },

    useEffect(fn: () => (() => void) | void, deps?: unknown[]) {
      const idx = state.effectIdx++;
      const existing = state.pendingEffects[idx];
      if (!existing) {
        // First registration
        state.pendingEffects[idx] = { fn, deps, prevDeps: undefined };
      } else {
        // Check if deps changed
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

    // Minimal stubs for other hooks React might call internally
    useCallback: <F>(fn: F) => fn,
    useMemo: <T>(fn: () => T) => fn(),
    useContext: () => undefined,
    useReducer: <S, A>(reducer: (s: S, a: A) => S, init: S): [S, (a: A) => void] => {
      const idx = state.stateIdx++;
      if (state.callCount === 0) state.stateSlots[idx] = init;
      return [state.stateSlots[idx] as S, (action: A) => {
        state.stateSlots[idx] = reducer(state.stateSlots[idx] as S, action);
        pendingSetState = true;
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
    pendingSetState = false;

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
    // Run any effects whose deps changed (or first-run)
    for (const effect of state.pendingEffects) {
      if (effect) {
        // Run cleanup from previous call
        // (we handle cleanups separately)
        const cleanup = effect.fn();
        if (typeof cleanup === 'function') {
          state.cleanups.push(cleanup);
        }
        // Mark as "ran" by clearing the effect
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
describe('useEntraGroupSearch', () => {
  let useEntraGroupSearch: (typeof import('./useEntraGroupSearch'))['useEntraGroupSearch'];

  beforeEach(async () => {
    mockGet.mockReset();
    // Dynamically import to get fresh mock bindings each test
    const mod = await import('./useEntraGroupSearch');
    useEntraGroupSearch = mod.useEntraGroupSearch;
  });

  it('debounces and returns matches', async () => {
    mockGet.mockResolvedValueOnce({
      value: [{ id: 'g1', displayName: 'Marketing-US', mail: null }],
    });

    // Initial render with empty query
    let query = '';
    const harness = createHookHarness(() => useEntraGroupSearch(query));
    harness.render();
    harness.flushEffects();

    expect(harness.result.matches).toEqual([]);

    // Re-render with a meaningful query (>= 2 chars)
    harness.flushCleanups();
    // Reset effects so they re-run on next render
    query = 'Mark';
    harness.render();
    harness.flushEffects(); // This sets the 250ms timer

    // Wait for the debounce timer (250ms) + async mockGet resolution
    await new Promise((r) => setTimeout(r, 400));

    // Re-render to pick up the state changes triggered by setMatches
    harness.render();

    expect(harness.result.matches).toHaveLength(1);
    expect(harness.result.matches[0].displayName).toBe('Marketing-US');
    expect(mockGet).toHaveBeenCalledOnce();
  });

  it('exposes total and expandToFullList; full mode pages through nextLinks', async () => {
    // Typeahead first (mode change is one fetch).
    mockGet.mockResolvedValueOnce({
      value: [
        { id: 'g1', displayName: 'Group 1', mail: null },
        { id: 'g2', displayName: 'Group 2', mail: null },
      ],
      '@odata.count': 60,
      '@odata.nextLink': 'https://graph.example/groups?$skiptoken=2',
    });

    let query = '';
    const harness = createHookHarness(() => useEntraGroupSearch(query));
    harness.render();
    harness.flushEffects();

    harness.flushCleanups();
    query = 'Mark';
    harness.render();
    harness.flushEffects();
    await new Promise((r) => setTimeout(r, 400));
    harness.render();

    expect(harness.result.matches).toHaveLength(2);
    expect(harness.result.total).toBe(60);
    expect(harness.result.mode).toBe('typeahead');
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Expand to full mode → fresh fetch with paging loop.
    mockGet
      .mockResolvedValueOnce({
        value: [
          { id: 'a1', displayName: 'A1', mail: null },
          { id: 'a2', displayName: 'A2', mail: null },
        ],
        '@odata.count': 60,
        '@odata.nextLink': 'https://graph.example/groups?$skiptoken=3',
      })
      .mockResolvedValueOnce({
        value: [{ id: 'b1', displayName: 'B1', mail: null }],
        '@odata.count': 60,
      });

    harness.result.expandToFullList();
    harness.flushCleanups();
    harness.render();
    harness.flushEffects();
    await new Promise((r) => setTimeout(r, 400));
    harness.render();

    expect(harness.result.mode).toBe('full');
    expect(harness.result.matches).toHaveLength(3);
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it('returns empty matches for queries shorter than 2 chars', async () => {
    let query = '';
    const harness = createHookHarness(() => useEntraGroupSearch(query));
    harness.render();
    harness.flushEffects();

    // Re-render with 1-char query
    harness.flushCleanups();
    query = 'a';
    harness.render();
    harness.flushEffects();

    // No timer should be set, no API call should happen
    await new Promise((r) => setTimeout(r, 50));

    expect(harness.result.matches).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
