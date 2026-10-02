import { computeInsights, computeStats, UN_MEMBERS } from './model.js';
import { escapeHtml } from './map.js';

const { d3 } = window;
const MAX_NAMES = 3;

// Overview tab: headline tiles, highlights, two charts, continent progress and a data table.
export function createOverview(els, { store, dataset }) {
    const tooltip = d3.select(els.root).append('div').attr('class', 'chart-tooltip').attr('hidden', true);
    let last = null;

    // Country names in the highlights select that country.
    els.highlights.addEventListener('click', event => {
        const btn = event.target.closest('[data-code]');
        if (btn) store.set({ selected: btn.dataset.code });
    });

    function render() {
        if (!last) return;
        const { view, state } = last;
        const stats = computeStats(view);
        const insights = computeInsights(dataset, state, view);

        els.statCountries.textContent = stats.countries;
        els.statContinents.textContent = stats.continents;
        els.statYears.textContent = stats.years;
        els.statPercent.textContent = `${stats.unPercent}%`;
        els.statPercentLabel.textContent = `of ${UN_MEMBERS} UN members (${stats.unMembers})`;

        els.highlights.innerHTML = highlightsHtml(insights);
        els.continents.innerHTML = insights.continents.map(row => `
            <li class="meter">
                <span class="meter__label">${row.name}</span>
                <span class="meter__value">${row.visited} <span>/ ${row.total}</span></span>
                <span class="meter__track" role="img" aria-label="${row.name}: ${row.visited} of ${row.total} UN member states">
                    <span class="meter__fill" style="width:${(row.visited / row.total) * 100}%"></span>
                </span>
            </li>`).join('');

        // Charts need a measurable width; skip while the tab is hidden and redraw when shown.
        const width = els.perYear.clientWidth;
        if (width) {
            drawPerYear(els.perYear, insights.perYear, width, tooltip, els.root);
            drawCumulative(els.cumulative, insights.cumulative, width, tooltip, els.root);
        }
        els.table.innerHTML = `
            <thead><tr><th scope="col">Year</th><th scope="col">New</th><th scope="col">Return</th><th scope="col">Total countries</th></tr></thead>
            <tbody>${insights.perYear.map((row, i) => `
                <tr><th scope="row">${row.year}</th><td>${row.new.length}</td><td>${row.repeat.length}</td><td>${insights.cumulative[i].count}</td></tr>`).join('')}
            </tbody>`;
    }

    new ResizeObserver(() => render()).observe(els.perYear);

    return {
        update(view, state) {
            last = { view, state };
            render();
        },
    };
}

function names(countries) {
    const shown = countries.slice(0, MAX_NAMES)
        .map(c => `<button type="button" class="link" data-code="${c.code}">${escapeHtml(c.name)}</button>`)
        .join(', ');
    const more = countries.length - MAX_NAMES;
    return more > 0 ? `${shown} <span class="muted">+${more} more</span>` : shown;
}

function highlightsHtml({ highlights: h, visits }) {
    if (!h) return '<p class="muted">No visits in this range.</p>';
    const rows = [
        ['First trip', `${names(h.first.countries)} <span class="muted">· ${h.first.year}</span>`],
        h.mostVisited.years > 1 && ['Most visited', `${names(h.mostVisited.countries)} <span class="muted">· ${h.mostVisited.years} years</span>`],
        h.busiest.count > 1 && ['Busiest year', `${h.busiest.year} <span class="muted">· ${h.busiest.count} countries</span>`],
        h.streak && h.streak.length > 1 && ['Longest streak', `${h.streak.start}–${h.streak.end} <span class="muted">· ${h.streak.length} years in a row</span>`],
        h.newest && ['Newest country', `${names(h.newest.countries)} <span class="muted">· ${h.newest.year}</span>`],
        ['Country visits', `${visits} <span class="muted">· one per country per year</span>`],
    ].filter(Boolean);
    return rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}

const M = { top: 8, right: 8, bottom: 22, left: 26 };

function frame(el, width, height, label) {
    const svg = d3.select(el).selectAll('svg').data([null]).join('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('role', 'img')
        .attr('aria-label', label);
    svg.selectAll('*').remove();
    return svg;
}

function yearAxis(svg, x, years, height, width) {
    // Label the ends and round years in between, skipping any that would collide.
    const minGap = 30;
    const ticks = [];
    for (const y of years) {
        const isEnd = y === years[0] || y === years[years.length - 1];
        if (!isEnd && y % 5 !== 0) continue;
        const px = x(y);
        if (ticks.length && px - x(ticks[ticks.length - 1]) < minGap) {
            if (y === years[years.length - 1]) ticks.pop();
            else continue;
        }
        ticks.push(y);
    }
    svg.append('g')
        .attr('class', 'axis')
        .selectAll('text')
        .data(ticks)
        .join('text')
        .attr('x', d => Math.min(Math.max(x(d), M.left + 12), width - M.right - 12))
        .attr('y', height - 6)
        .attr('text-anchor', 'middle')
        .text(d => d);
}

function grid(svg, y, width) {
    const ticks = y.ticks(3).filter(Number.isInteger);
    const g = svg.append('g').attr('class', 'grid');
    g.selectAll('line').data(ticks).join('line')
        .attr('x1', M.left).attr('x2', width - M.right)
        .attr('y1', d => y(d)).attr('y2', d => y(d));
    g.selectAll('text').data(ticks).join('text')
        .attr('x', M.left - 6).attr('y', d => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
        .text(d => d);
}

// Column with a 4px rounded top and a square base.
function columnPath(x, y0, y1, w, r) {
    const h = y0 - y1;
    if (h <= 0) return '';
    r = Math.min(r, h, w / 2);
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
}

function showTip(tooltip, root, event, lines) {
    const [px, py] = d3.pointer(event, root);
    tooltip.attr('hidden', null).selectAll('*').remove();
    for (const [value, label, cls] of lines) {
        const row = tooltip.append('div').attr('class', `chart-tooltip__row ${cls || ''}`);
        row.append('strong').text(value);
        if (label) row.append('span').text(label);
    }
    // The panel scrolls, so convert from visible coordinates to content coordinates.
    const { offsetWidth: w, offsetHeight: h } = tooltip.node();
    const left = Math.max(4, Math.min(px - w / 2, root.clientWidth - w - 4));
    const above = py - h - 12;
    tooltip.style('left', `${left}px`).style('top', `${(above < 0 ? py + 20 : above) + root.scrollTop}px`);
}

function drawPerYear(el, rows, width, tooltip, root) {
    const height = 150;
    const svg = frame(el, width, height, 'Countries visited per year, split into new countries and return visits');
    const years = rows.map(r => r.year);
    const x = d3.scaleBand().domain(years).range([M.left, width - M.right]).paddingInner(0.25);
    const max = d3.max(rows, r => r.new.length + r.repeat.length) || 1;
    const y = d3.scaleLinear().domain([0, Math.max(max, 3)]).nice().range([height - M.bottom, M.top]);
    grid(svg, y, width);

    const bw = Math.min(24, x.bandwidth());
    const off = (x.bandwidth() - bw) / 2;
    const base = y(0);
    const GAP = 2;
    const cols = svg.append('g').selectAll('g').data(rows).join('g');
    cols.append('path')
        .attr('class', 'bar bar--new')
        .attr('d', r => {
            const top = y(r.new.length);
            return r.repeat.length
                ? (r.new.length ? `M${x(r.year) + off},${base}V${Math.min(base, top + GAP)}H${x(r.year) + off + bw}V${base}Z` : '')
                : columnPath(x(r.year) + off, base, top, bw, 4);
        });
    cols.append('path')
        .attr('class', 'bar bar--repeat')
        .attr('d', r => columnPath(x(r.year) + off, y(r.new.length), y(r.new.length + r.repeat.length), bw, 4));
    // Hit targets span the whole column slot, not just the painted bar.
    cols.append('rect')
        .attr('class', 'hit')
        .attr('x', r => x(r.year) - (x.step() - x.bandwidth()) / 2)
        .attr('width', x.step())
        .attr('y', M.top)
        .attr('height', base - M.top)
        .on('pointerenter pointermove', function (event, r) {
            d3.select(this.parentNode).classed('is-hover', true);
            const total = r.new.length + r.repeat.length;
            const lines = [[r.year, `${total} ${total === 1 ? 'country' : 'countries'}`]];
            if (r.new.length) lines.push([r.new.length, `new: ${list(r.new)}`, 'key-new']);
            if (r.repeat.length) lines.push([r.repeat.length, `return: ${list(r.repeat)}`, 'key-repeat']);
            showTip(tooltip, root, event, lines);
        })
        .on('pointerleave', function () {
            d3.select(this.parentNode).classed('is-hover', false);
            tooltip.attr('hidden', true);
        });
    yearAxis(svg, year => x(year) + x.bandwidth() / 2, years, height, width);
}

function drawCumulative(el, rows, width, tooltip, root) {
    const height = 130;
    const svg = frame(el, width, height, 'Total countries visited over time');
    const years = rows.map(r => r.year);
    const x = d3.scalePoint().domain(years).range([M.left + 6, width - M.right - 24]);
    const y = d3.scaleLinear().domain([0, Math.max(3, d3.max(rows, r => r.count))]).nice().range([height - M.bottom, M.top]);
    grid(svg, y, width);

    if (rows.length > 1) {
        svg.append('path').attr('class', 'area')
            .attr('d', d3.area().x(r => x(r.year)).y0(y(0)).y1(r => y(r.count)).curve(d3.curveMonotoneX)(rows));
        svg.append('path').attr('class', 'line')
            .attr('d', d3.line().x(r => x(r.year)).y(r => y(r.count)).curve(d3.curveMonotoneX)(rows));
    }
    const end = rows[rows.length - 1];
    svg.append('circle').attr('class', 'end-dot').attr('cx', x(end.year)).attr('cy', y(end.count)).attr('r', 4);
    svg.append('text').attr('class', 'end-label').attr('x', x(end.year) + 8).attr('y', y(end.count)).attr('dy', '0.32em').text(end.count);
    yearAxis(svg, x, years, height, width);

    const cross = svg.append('line').attr('class', 'crosshair').attr('y1', M.top).attr('y2', height - M.bottom).attr('hidden', true);
    const dot = svg.append('circle').attr('class', 'hover-dot').attr('r', 4).attr('hidden', true);
    svg.append('rect')
        .attr('class', 'hit')
        .attr('x', M.left).attr('width', width - M.left - M.right)
        .attr('y', M.top).attr('height', height - M.top - M.bottom)
        .on('pointerenter pointermove', event => {
            const [px] = d3.pointer(event);
            const r = rows.reduce((best, row) => (Math.abs(x(row.year) - px) < Math.abs(x(best.year) - px) ? row : best));
            cross.attr('hidden', null).attr('x1', x(r.year)).attr('x2', x(r.year));
            dot.attr('hidden', null).attr('cx', x(r.year)).attr('cy', y(r.count));
            showTip(tooltip, root, event, [[r.count, `countries by ${r.year}`]]);
        })
        .on('pointerleave', () => {
            cross.attr('hidden', true);
            dot.attr('hidden', true);
            tooltip.attr('hidden', true);
        });
}

function list(countries) {
    const shown = countries.slice(0, 4).map(c => c.name).join(', ');
    return countries.length > 4 ? `${shown} +${countries.length - 4}` : shown;
}
