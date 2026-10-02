import { normalizeState } from './model.js';

// Single source of truth for UI state. Every change goes through set(),
// is normalised, mirrored to the URL and then re-rendered by subscribers.
export function createStore(ds) {
    let state = normalizeState(readUrl(), ds);
    const listeners = new Set();

    return {
        get: () => state,
        set(patch) {
            const next = normalizeState({ ...state, ...patch }, ds);
            if (Object.keys(next).every(k => next[k] === state[k])) return;
            state = next;
            writeUrl(state, ds);
            listeners.forEach(fn => fn(state));
        },
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
}

function readUrl() {
    const p = new URLSearchParams(location.search);
    return {
        from: p.get('from'),
        to: p.get('to'),
        continent: p.get('continent'),
        selected: p.get('country')?.toUpperCase(),
    };
}

function writeUrl(state, ds) {
    const p = new URLSearchParams();
    const min = ds.years[0];
    const max = ds.years[ds.years.length - 1];
    if (state.from !== min) p.set('from', state.from);
    if (state.to !== max) p.set('to', state.to);
    if (state.continent !== 'all') p.set('continent', state.continent);
    if (state.selected) p.set('country', state.selected);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}
