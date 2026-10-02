// Quick check of countries.js and cities.js before publishing:
//   npm run check
import visits from '../countries.js';
import cities from '../cities.js';
import meta from '../data/countries-meta.js';
import { buildDataset } from '../js/data.js';

const ds = buildDataset(visits, meta, cities);
const visited = [...ds.countries.values()].filter(c => c.years.length);
const home = [...ds.countries.values()].filter(c => c.home);

if (ds.issues.length) {
    console.error(`Found ${ds.issues.length} problem(s):`);
    ds.issues.forEach(msg => console.error(`  - ${msg}`));
    process.exit(1);
}
console.log(`OK: ${visited.length} visited countries, ${ds.years.length} years with travel (${ds.years[0]}–${ds.years.at(-1)}), home: ${home.map(c => c.name).join(', ') || 'none'}.`);
