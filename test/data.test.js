import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import visits from '../countries.js';
import cities from '../cities.js';
import meta from '../data/countries-meta.js';
import { buildDataset } from '../js/data.js';
import { CONTINENTS, UN_MEMBERS } from '../js/model.js';

test('countries.js and cities.js have no problems', () => {
    const { issues } = buildDataset(visits, meta, cities);
    assert.deepEqual(issues, [], `Fix these in countries.js / cities.js:\n  ${issues.join('\n  ')}`);
});

test('countries.js lists every country and territory', () => {
    const missing = Object.keys(meta).filter(code => !(code in visits));
    assert.deepEqual(missing, [], `Add a line for: ${missing.join(', ')}`);
});

test('exactly one home country', () => {
    const homes = Object.entries(visits).filter(([, v]) => v.home).map(([code]) => code);
    assert.equal(homes.length, 1, `home: true is set on ${homes.join(', ') || 'no country'}`);
});

test('reference data is complete', () => {
    for (const [code, m] of Object.entries(meta)) {
        assert.match(code, /^[A-Z]{3}$/);
        assert.ok(m.name, `${code} has no name`);
        assert.ok(CONTINENTS.includes(m.continent), `${code} has unknown continent ${m.continent}`);
        assert.ok(Number.isFinite(m.lat) && Number.isFinite(m.lng), `${code} has no position`);
    }
    assert.equal(Object.values(meta).filter(m => m.un).length, UN_MEMBERS);
});

test('every map shape belongs to a known country', () => {
    const atlas = JSON.parse(readFileSync(new URL('../vendor/countries-50m.json', import.meta.url)));
    const nums = new Set(Object.values(meta).map(m => m.num));
    // Shapes without an ISO number are matched by name in js/map.js (UNNUMBERED).
    const unnumbered = new Set(['Kosovo', 'N. Cyprus', 'Somaliland', 'Indian Ocean Ter.', 'Siachen Glacier']);
    const unknown = atlas.objects.countries.geometries
        .filter(g => g.id ? !nums.has(g.id) : !unnumbered.has(g.properties.name))
        .map(g => `${g.id ?? '?'} ${g.properties.name}`);
    assert.deepEqual(unknown, []);
});

test('validation reports bad entries', () => {
    const { issues, countries } = buildDataset({
        XXX: { years: [2020] },
        FIN: { years: [2021, 2020, 2020, 'x', 1850] },
        SWE: { years: 2020 },
        NOR: null,
    }, meta, [{ name: 'Nowhere' }, { name: 'Venice', lat: 45.44, lng: 12.33, date: '2023-05' }]);
    assert.deepEqual(issues, [
        'countries.js: unknown country code "XXX"',
        'countries.js: FIN lists 2020 twice',
        'countries.js: FIN has an invalid year "x"',
        'countries.js: FIN has an invalid year "1850"',
        'countries.js: SWE years should be a list, e.g. [2023, 2024]',
        'countries.js: NOR should look like {years: [2024]}',
        'cities.js: entry {"name":"Nowhere"} needs a name, lat and lng',
    ]);
    assert.deepEqual(countries.get('FIN').years, [2020, 2021], 'years are de-duplicated and sorted');
});

test('cities accept the old latitude/longitude/date format', () => {
    const { cities: points } = buildDataset({}, meta, [{ name: 'Venice', latitude: 45.44, longitude: 12.33, date: '2023-05' }]);
    assert.deepEqual(points, [{ name: 'Venice', lat: 45.44, lng: 12.33, year: 2023 }]);
});
