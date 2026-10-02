// Turns the hand-edited data files into one validated dataset.
// Nothing here touches the DOM, so it can be tested with plain Node.

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export function buildDataset(visits, meta, cities = []) {
    const issues = [];
    const countries = new Map();

    for (const [code, m] of Object.entries(meta)) {
        countries.set(code, { code, ...m, home: false, years: [] });
    }

    for (const [code, entry] of Object.entries(visits)) {
        const country = countries.get(code);
        if (!country) {
            issues.push(`countries.js: unknown country code "${code}"`);
            continue;
        }
        if (entry == null || typeof entry !== 'object') {
            issues.push(`countries.js: ${code} should look like {years: [2024]}`);
            continue;
        }
        if (entry.years !== undefined && !Array.isArray(entry.years)) {
            issues.push(`countries.js: ${code} years should be a list, e.g. [2023, 2024]`);
        }
        const years = new Set();
        for (const y of Array.isArray(entry.years) ? entry.years : []) {
            if (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR) {
                issues.push(`countries.js: ${code} has an invalid year "${y}"`);
            } else if (years.has(y)) {
                issues.push(`countries.js: ${code} lists ${y} twice`);
            } else {
                years.add(y);
            }
        }
        country.years = [...years].sort((a, b) => a - b);
        country.home = entry.home === true;
    }

    const allYears = new Set();
    for (const c of countries.values()) c.years.forEach(y => allYears.add(y));

    const points = [];
    for (const city of Array.isArray(cities) ? cities : []) {
        const lat = city.lat ?? city.latitude;
        const lng = city.lng ?? city.longitude;
        if (!city.name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            issues.push(`cities.js: entry ${JSON.stringify(city)} needs a name, lat and lng`);
            continue;
        }
        const year = city.year ?? (city.date ? parseInt(String(city.date).slice(0, 4), 10) : null);
        points.push({ name: city.name, lat, lng, year: Number.isInteger(year) ? year : null });
    }

    return {
        countries,
        years: [...allYears].sort((a, b) => a - b),
        cities: points,
        issues,
    };
}
