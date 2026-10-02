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

// Everything the Overview panel shows, scoped to the same filters as the map.
// "New" means the first visit ever recorded for that country, so a 2020 visit to a
// country first seen in 2014 counts as a return visit even when the range starts in 2020.
export function computeInsights(ds, state, view) {
    const perYear = [];
    for (let y = state.from; y <= state.to; y++) perYear.push({ year: y, new: [], repeat: [] });
    const at = y => perYear[y - state.from];

    let visits = 0;
    const homes = [];
    for (const { country: c, years } of view.visible) {
        if (c.home) homes.push(c);
        visits += years.length;
        for (const y of years) (c.years[0] === y ? at(y).new : at(y).repeat).push(c);
    }

    // Running total of distinct countries seen since `from` (home counts from the start,
    // so the last point matches the Countries tile).
    const seen = new Set(homes.map(c => c.code));
    const cumulative = perYear.map(row => {
        row.new.forEach(c => seen.add(c.code));
        row.repeat.forEach(c => seen.add(c.code));
        return { year: row.year, count: seen.size };
    });

    const continents = CONTINENTS
        .filter(name => state.continent === 'all' || state.continent === name)
        .map(name => ({
            name,
            total: [...ds.countries.values()].filter(c => c.un && c.continent === name).length,
            visited: view.visible.filter(e => e.country.un && e.country.continent === name).length,
        }))
        .filter(row => row.total > 0);

    return { perYear, cumulative, continents, visits, highlights: highlights(view, perYear) };
}

function highlights(view, perYear) {
    const travelled = view.visible.filter(e => e.years.length > 0);
    if (!travelled.length) return null;
    const byName = (a, b) => a.name.localeCompare(b.name);

    const mostCount = Math.max(...travelled.map(e => e.years.length));
    const firstYear = Math.min(...travelled.map(e => e.years[0]));
    const newestYear = Math.max(...travelled.map(e => e.country.years[0]));

    let busiest = perYear[0];
    for (const row of perYear) {
        if (row.new.length + row.repeat.length >= busiest.new.length + busiest.repeat.length) busiest = row;
    }

    // Longest run of consecutive years with at least one visit (latest wins a tie).
    let streak = null;
    let start = null;
    for (const row of perYear) {
        if (row.new.length + row.repeat.length > 0) {
            start ??= row.year;
            if (!streak || row.year - start + 1 >= streak.length) streak = { start, end: row.year, length: row.year - start + 1 };
        } else {
            start = null;
        }
    }

    return {
        first: { year: firstYear, countries: travelled.filter(e => e.years[0] === firstYear).map(e => e.country).sort(byName) },
        mostVisited: { years: mostCount, countries: travelled.filter(e => e.years.length === mostCount).map(e => e.country).sort(byName) },
        busiest: { year: busiest.year, count: busiest.new.length + busiest.repeat.length },
        streak,
        newest: newestYear >= perYear[0].year
            ? { year: newestYear, countries: travelled.filter(e => e.country.years[0] === newestYear).map(e => e.country).sort(byName) }
            : null,
    };
}
