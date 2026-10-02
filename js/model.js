// Pure functions that derive everything shown on screen from (dataset, state).
// The dataset is never modified; every view is recomputed from scratch.

export const CONTINENTS = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania', 'Antarctica'];
export const UN_MEMBERS = 193;

export function yearBounds(ds) {
    const now = new Date().getFullYear();
    return ds.years.length ? { min: ds.years[0], max: ds.years[ds.years.length - 1] } : { min: now, max: now };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const toInt = v => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
};

// Makes any (possibly partial or hand-typed) state consistent:
// from <= to, both inside the data's year range.
export function normalizeState(raw, ds) {
    const { min, max } = yearBounds(ds);
    let from = clamp(toInt(raw.from) ?? min, min, max);
    let to = clamp(toInt(raw.to) ?? max, min, max);
    if (from > to) [from, to] = [to, from];
    const continent = CONTINENTS.includes(raw.continent) ? raw.continent : 'all';
    const selected = raw.selected && ds.countries.has(raw.selected) ? raw.selected : null;
    return {
        from, to, continent, selected,
        search: typeof raw.search === 'string' ? raw.search : '',
        playing: !!raw.playing,
    };
}

// A country is shown when it matches the continent filter and has at least one
// visit between `from` and `to`. The home country is always shown.
export function computeView(ds, state) {
    const byCode = new Map();
    const visible = [];
    for (const c of ds.countries.values()) {
        const inContinent = state.continent === 'all' || c.continent === state.continent;
        const years = c.years.filter(y => y >= state.from && y <= state.to);
        const entry = {
            country: c,
            years,
            inContinent,
            visible: inContinent && (c.home || years.length > 0),
        };
        byCode.set(c.code, entry);
        if (entry.visible) visible.push(entry);
    }
    visible.sort((a, b) => a.country.name.localeCompare(b.country.name));
    const cities = ds.cities.filter(p => p.year == null || (p.year >= state.from && p.year <= state.to));
    return { byCode, visible, cities };
}

export function computeStats(view) {
    const continents = new Set();
    const years = new Set();
    let un = 0;
    for (const { country, years: ys } of view.visible) {
        continents.add(country.continent);
        ys.forEach(y => years.add(y));
        if (country.un) un++;
    }
    return {
        countries: view.visible.length,
        continents: continents.size,
        years: years.size,
        unMembers: un,
        unPercent: Math.round((un / UN_MEMBERS) * 100),
    };
}

// Colour bucket for the map: 'home', 1..4 (4 = four or more visits), or 0.
export function visitLevel(entry) {
    if (!entry || !entry.visible) return 0;
    if (entry.country.home) return 'home';
    return Math.min(entry.years.length, 4);
}
