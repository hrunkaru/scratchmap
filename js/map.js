import { visitLevel } from './model.js';

const { d3, topojson } = window;

// Shapes in world-atlas without an ISO numeric id, matched to the country they belong to.
const UNNUMBERED = { 'Kosovo': 'UNK', 'N. Cyprus': 'CYP', 'Somaliland': 'SOM' };

const MAX_ZOOM = 60;
// Selecting a micro-state stops zooming here so its neighbours stay in view.
const FOCUS_ZOOM = 24;
const PAD = 12;
// Countries smaller than this on screen (px²) get a dot so they stay visible and clickable.
const DOT_AREA = 40;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const duration = ms => (reducedMotion.matches ? 0 : ms);

export function createMap(root, { topology, dataset, onSelect }) {
    const svg = d3.select(root).append('svg')
        .attr('class', 'map-svg')
        .attr('role', 'img')
        .attr('aria-label', 'World map of visited countries');
    const viewport = svg.append('g');
    const sphere = viewport.append('path').attr('class', 'sphere');
    const shapes = viewport.append('g').attr('class', 'countries');
    const dots = viewport.append('g').attr('class', 'dots');
    const cityLayer = viewport.append('g').attr('class', 'cities');
    const tooltip = d3.select(root).append('div').attr('class', 'map-tooltip').attr('hidden', true);

    const byNum = new Map();
    for (const c of dataset.countries.values()) if (c.num) byNum.set(c.num, c.code);

    const features = topojson.feature(topology, topology.objects.countries).features;
    const featuresByCode = new Map();
    for (const f of features) {
        f.code = byNum.get(f.id) ?? UNNUMBERED[f.properties.name] ?? null;
        if (!f.code) continue;
        if (!featuresByCode.has(f.code)) featuresByCode.set(f.code, []);
        featuresByCode.get(f.code).push(f);
    }
    const fitTarget = { type: 'FeatureCollection', features: features.filter(f => f.code !== 'ATA') };

    const projection = d3.geoNaturalEarth1();
    const path = d3.geoPath(projection);

    const countryPaths = shapes.selectAll('path')
        .data(features)
        .join('path')
        .attr('class', 'country')
        .classed('unknown', d => !d.code);

    // Dots for every country that is tiny at the current zoom or missing from the shape file.
    const dotData = [...dataset.countries.values()].map(c => ({ code: c.code, country: c, area: 0, xy: [0, 0] }));

    const zoom = d3.zoom()
        .scaleExtent([1, MAX_ZOOM])
        .on('zoom', ({ transform }) => {
            viewport.attr('transform', transform);
            k = transform.k;
            layoutMarkers();
        });
    svg.call(zoom);

    let width = 0;
    let height = 0;
    let k = 1;
    let view = null;
    let state = null;
    let focused = null;

    function resize() {
        const w = root.clientWidth;
        const h = root.clientHeight;
        if (!w || !h || (w === width && h === height)) return;
        // Remember which place is in the middle of the screen so the view survives the refit.
        const before = d3.zoomTransform(svg.node());
        const center = width && before.k > 1 ? projection.invert(before.invert([width / 2, height / 2])) : null;
        width = w;
        height = h;
        projection.fitExtent([[PAD, PAD], [w - PAD, h - PAD]], fitTarget);
        sphere.attr('d', path({ type: 'Sphere' }));
        countryPaths.attr('d', path);
        for (const d of dotData) {
            const feats = featuresByCode.get(d.code);
            d.area = feats ? d3.sum(feats, f => path.area(f)) : 0;
            d.xy = feats && d.area > 0.5 ? path.centroid(largestPart(feats)) : projection([d.country.lng, d.country.lat]);
        }
        zoom.extent([[0, 0], [w, h]]).translateExtent([[0, 0], [w, h]]);
        let t = d3.zoomIdentity;
        if (center) {
            const [x, y] = projection(center);
            t = t.translate(w / 2 - before.k * x, h / 2 - before.k * y).scale(before.k);
        }
        svg.call(zoom.transform, t);
        if (state?.selected && focused !== state.selected) focusOn(state.selected, false);
        drawMarkers();
    }

    function focusOn(code, animate = true) {
        const feats = featuresByCode.get(code);
        let x, y, scale;
        if (feats) {
            const [[x0, y0], [x1, y1]] = path.bounds(largestPart(feats, 0.1));
            x = (x0 + x1) / 2;
            y = (y0 + y1) / 2;
            scale = 0.7 / Math.max((x1 - x0) / width, (y1 - y0) / height);
        } else {
            const c = dataset.countries.get(code);
            [x, y] = projection([c.lng, c.lat]);
            scale = 12;
        }
        scale = Math.max(1, Math.min(FOCUS_ZOOM, scale));
        const t = d3.zoomIdentity.translate(width / 2 - scale * x, height / 2 - scale * y).scale(scale);
        (animate ? svg.transition().duration(duration(750)) : svg).call(zoom.transform, t);
        focused = code;
    }

    function drawMarkers() {
        if (!view) return;
        const markers = dotData.filter(d => {
            const entry = view.byCode.get(d.code);
            return (entry.visible || d.code === state.selected) && d.area * k * k < DOT_AREA;
        });
        dots.selectAll('circle')
            .data(markers, d => d.code)
            .join('circle')
            .attr('cx', d => d.xy[0])
            .attr('cy', d => d.xy[1])
            .attr('class', d => `dot lvl-${visitLevel(view.byCode.get(d.code))}`)
            .classed('selected', d => d.code === state.selected)
            .attr('r', d => (d.code === state.selected ? 6 : 4) / k);

        cityLayer.selectAll('circle')
            .data(view.cities, d => d.name)
            .join('circle')
            .attr('class', 'city')
            .attr('cx', d => projection([d.lng, d.lat])[0])
            .attr('cy', d => projection([d.lng, d.lat])[1])
            .attr('r', 3 / k);
    }

    // Cheap update while zooming: only re-filter when a dot crosses the size threshold.
    let lastK = 1;
    function layoutMarkers() {
        const crossed = dotData.some(d => (d.area * lastK * lastK < DOT_AREA) !== (d.area * k * k < DOT_AREA));
        lastK = k;
        if (crossed) drawMarkers();
        else {
            dots.selectAll('circle').attr('r', d => (d.code === state?.selected ? 6 : 4) / k);
            cityLayer.selectAll('circle').attr('r', 3 / k);
        }
    }

    // Tooltip (mouse only — touch uses tap-to-select and the details card).
    svg.on('pointermove', event => {
        if (event.pointerType !== 'mouse') return;
        const d = d3.select(event.target).datum();
        const text = d && tooltipText(d);
        if (!text) {
            tooltip.attr('hidden', true);
            return;
        }
        const [px, py] = d3.pointer(event, root);
        const flip = px > width - 200;
        tooltip.attr('hidden', null)
            .html(text)
            .style('left', `${flip ? px - 12 : px + 12}px`)
            .style('top', `${py + 12}px`)
            .style('transform', flip ? 'translateX(-100%)' : null);
    });
    svg.on('pointerleave', () => tooltip.attr('hidden', true));

    function tooltipText(d) {
        if (d.name && d.lat != null && !d.code) {
            return `<strong>${escapeHtml(d.name)}</strong>${d.year ? `<span>${d.year}</span>` : ''}`;
        }
        if (!d.code || !view) return null;
        const entry = view.byCode.get(d.code);
        const c = entry.country;
        let detail;
        if (c.home) detail = 'Home';
        else if (entry.visible) detail = entry.years.join(', ');
        else if (c.years.length) detail = 'Outside current filter';
        else detail = 'Not visited yet';
        return `<strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(detail)}</span>`;
    }

    svg.on('click', event => {
        const d = d3.select(event.target).datum();
        onSelect(d && d.code ? d.code : null);
    });

    new ResizeObserver(() => requestAnimationFrame(resize)).observe(root);

    return {
        update(nextView, nextState) {
            view = nextView;
            state = nextState;
            countryPaths
                .attr('class', d => {
                    if (!d.code) return 'country unknown';
                    const entry = view.byCode.get(d.code);
                    let cls = `country lvl-${visitLevel(entry)}`;
                    if (!entry.inContinent) cls += ' dim';
                    if (d.code === state.selected) cls += ' selected';
                    return cls;
                });
            shapes.selectAll('.selected').raise();
            if (width) {
                if (state.selected && state.selected !== focused) focusOn(state.selected);
                if (!state.selected) focused = null;
                drawMarkers();
            }
        },
        zoomBy: factor => svg.transition().duration(duration(250)).call(zoom.scaleBy, factor),
        reset() {
            focused = null;
            svg.transition().duration(duration(600)).call(zoom.transform, d3.zoomIdentity);
        },
        refocus() {
            if (state?.selected) focusOn(state.selected);
        },
    };
}

// The parts of a country worth framing: its biggest polygon plus any polygon at least
// `share` of that size (keeps e.g. France framed on Europe rather than French Guiana).
function largestPart(feats, share = 1) {
    const polys = [];
    for (const f of feats) {
        const g = f.geometry;
        if (!g) continue;
        if (g.type === 'Polygon') polys.push(g.coordinates);
        else if (g.type === 'MultiPolygon') polys.push(...g.coordinates);
    }
    const areas = polys.map(p => d3.geoArea({ type: 'Polygon', coordinates: p }));
    const max = Math.max(...areas);
    return { type: 'MultiPolygon', coordinates: polys.filter((_, i) => areas[i] >= max * share) };
}

export function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
