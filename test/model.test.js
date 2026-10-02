import { test } from 'node:test';
import assert from 'node:assert/strict';
import meta from '../data/countries-meta.js';
import { buildDataset } from '../js/data.js';
import { normalizeState, computeView, computeStats, computeInsights, visitLevel } from '../js/model.js';

// A small, fixed dataset so the expected numbers are easy to verify by hand.
const ds = buildDataset({
    EST: { home: true, years: [] },
    FIN: { years: [2014, 2019, 2020] },
    LVA: { years: [2018, 2020] },
    USA: { years: [2017] },
    THA: { years: [2020] },
    VAT: { years: [2019] },
}, meta);

const viewOf = raw => {
    const state = normalizeState(raw, ds);
    return { state, view: computeView(ds, state) };
};
const codes = view => view.visible.map(e => e.country.code).sort();

test('normalizeState fills defaults from the data', () => {
    assert.deepEqual(normalizeState({}, ds), {
        from: 2014, to: 2020, continent: 'all', selected: null, search: '', playing: false,
    });
});

test('normalizeState clamps, swaps and rejects bad values', () => {
    const s = normalizeState({ from: '2030', to: 1990, continent: 'Atlantis', selected: 'XXX' }, ds);
    assert.equal(s.from, 2014);
    assert.equal(s.to, 2020);
    assert.equal(s.continent, 'all');
    assert.equal(s.selected, null);
    const swapped = normalizeState({ from: 2019, to: 2017 }, ds);
    assert.deepEqual([swapped.from, swapped.to], [2017, 2019]);
});

test('home country is always shown, other countries need a visit in range', () => {
    assert.deepEqual(codes(viewOf({}).view), ['EST', 'FIN', 'LVA', 'THA', 'USA', 'VAT']);
    assert.deepEqual(codes(viewOf({ from: 2015, to: 2017 }).view), ['EST', 'USA']);
});

test('continent filter applies to everything, including home', () => {
    assert.deepEqual(codes(viewOf({ continent: 'Asia' }).view), ['THA']);
    assert.deepEqual(codes(viewOf({ continent: 'North America' }).view), ['USA']);
    const { view } = viewOf({ continent: 'Asia' });
    assert.equal(view.byCode.get('FIN').inContinent, false);
});

test('visit level counts years inside the range', () => {
    const { view } = viewOf({ from: 2019 });
    assert.equal(visitLevel(view.byCode.get('FIN')), 2);
    assert.equal(visitLevel(view.byCode.get('EST')), 'home');
    assert.equal(visitLevel(view.byCode.get('USA')), 0);
});

test('stats: Vatican counts as a country but not as a UN member', () => {
    const stats = computeStats(viewOf({}).view);
    assert.deepEqual(stats, { countries: 6, continents: 3, years: 5, unMembers: 5, unPercent: 3 });
});

test('insights: new vs. return visits use the first visit ever', () => {
    const { state, view } = viewOf({ from: 2019 });
    const { perYear } = computeInsights(ds, state, view);
    const row = y => {
        const r = perYear.find(p => p.year === y);
        return { new: r.new.map(c => c.code).sort(), repeat: r.repeat.map(c => c.code).sort() };
    };
    assert.deepEqual(row(2019), { new: ['VAT'], repeat: ['FIN'] });
    assert.deepEqual(row(2020), { new: ['THA'], repeat: ['FIN', 'LVA'] });
});

test('insights: running total ends at the Countries tile', () => {
    const { state, view } = viewOf({});
    const { cumulative, visits } = computeInsights(ds, state, view);
    assert.deepEqual(cumulative.map(c => c.count), [2, 2, 2, 3, 4, 5, 6]);
    assert.equal(cumulative.at(-1).count, computeStats(view).countries);
    assert.equal(visits, 8);
});

test('insights: highlights', () => {
    const { state, view } = viewOf({});
    const h = computeInsights(ds, state, view).highlights;
    assert.equal(h.first.year, 2014);
    assert.deepEqual(h.mostVisited.countries.map(c => c.code), ['FIN']);
    assert.equal(h.mostVisited.years, 3);
    assert.deepEqual(h.busiest, { year: 2020, count: 3 });
    assert.deepEqual(h.streak, { start: 2017, end: 2020, length: 4 });
    assert.equal(h.newest.year, 2020);
    assert.deepEqual(h.newest.countries.map(c => c.code), ['THA']);
});

test('insights: continent progress counts UN members only', () => {
    const { state, view } = viewOf({ continent: 'Europe' });
    const { continents } = computeInsights(ds, state, view);
    assert.equal(continents.length, 1);
    assert.equal(continents[0].name, 'Europe');
    assert.equal(continents[0].visited, 3, 'EST, FIN, LVA — Vatican is not a UN member');
});

test('insights: no visits gives no highlights', () => {
    const { state, view } = viewOf({ continent: 'Oceania' });
    const insights = computeInsights(ds, state, view);
    assert.equal(insights.highlights, null);
    assert.equal(insights.visits, 0);
});
