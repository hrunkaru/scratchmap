import visits from '../countries.js';
import cities from '../cities.js';
import meta from '../data/countries-meta.js';
import { buildDataset } from './data.js';
import { computeView } from './model.js';
import { createStore } from './store.js';
import { initTheme } from './theme.js';
import { createMap } from './map.js';
import { createControls } from './controls.js';
import { createSidebar } from './sidebar.js';
import { createDetails } from './details.js';
import { initLayout } from './layout.js';

const $ = id => document.getElementById(id);

initTheme($('themeToggle'));

const dataset = buildDataset(visits, meta, cities);
if (dataset.issues.length) {
    dataset.issues.forEach(msg => console.warn(msg));
    $('issues').hidden = false;
    $('issues').textContent = `Data problems: ${dataset.issues.join('; ')}`;
}

const store = createStore(dataset);

let topology;
try {
    const res = await fetch('vendor/countries-50m.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    topology = await res.json();
} catch (err) {
    $('bootError').textContent = `Could not load the map shapes (${err.message}). See README for how to preview locally.`;
    $('bootError').classList.add('is-visible');
    throw err;
}
$('bootError').remove();

const map = createMap($('map'), {
    topology,
    dataset,
    onSelect: code => store.set({ selected: code === store.get().selected ? null : code }),
});
$('zoomIn').addEventListener('click', () => map.zoomBy(1.6));
$('zoomOut').addEventListener('click', () => map.zoomBy(1 / 1.6));
$('zoomReset').addEventListener('click', () => map.reset());

const controls = createControls({
    continents: $('continents'),
    range: $('yearRange'),
    from: $('fromYear'),
    to: $('toYear'),
    back: $('stepBack'),
    play: $('playBtn'),
    forward: $('stepForward'),
    speed: $('speedBtn'),
    year: $('timelineYear'),
    count: $('timelineCount'),
}, { store, dataset });

const sidebar = createSidebar({
    search: $('search'),
    list: $('countryList'),
    empty: $('listEmpty'),
    statCountries: $('statCountries'),
    statContinents: $('statContinents'),
    statYears: $('statYears'),
    statPercent: $('statPercent'),
    statPercentLabel: $('statPercentLabel'),
    summary: $('sheetSummary'),
}, { store });

const details = createDetails($('details'), { store });

initLayout({
    app: $('app'),
    sidebar: $('sidebar'),
    panelToggle: $('panelToggle'),
    handle: $('sheetHandle'),
}, { store });

function render(state) {
    const view = computeView(dataset, state);
    controls.update(state, view);
    map.update(view, state);
    sidebar.update(view, state);
    details.update(view, state);
}

store.subscribe(render);
render(store.get());
document.body.classList.add('is-ready');
