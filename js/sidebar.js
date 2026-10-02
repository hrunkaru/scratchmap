import { computeStats, UN_MEMBERS } from './model.js';
import { escapeHtml } from './map.js';

// Statistics tiles and the searchable list of visible countries.
export function createSidebar(els, { store }) {
    els.search.addEventListener('input', () => store.set({ search: els.search.value }));
    els.list.addEventListener('click', event => {
        const item = event.target.closest('[data-code]');
        if (item) store.set({ selected: item.dataset.code === store.get().selected ? null : item.dataset.code });
    });

    return {
        update(view, s) {
            const stats = computeStats(view);
            els.statCountries.textContent = stats.countries;
            els.statContinents.textContent = stats.continents;
            els.statYears.textContent = stats.years;
            els.statPercent.textContent = `${stats.unPercent}%`;
            els.statPercentLabel.textContent = `of ${UN_MEMBERS} UN members (${stats.unMembers})`;
            els.summary.textContent = `${stats.countries} ${stats.countries === 1 ? 'country' : 'countries'} · ${
                stats.continents} ${stats.continents === 1 ? 'continent' : 'continents'} · ${
                stats.years} ${stats.years === 1 ? 'year' : 'years'}`;

            const term = s.search.trim().toLowerCase();
            const rows = view.visible.filter(e => e.country.name.toLowerCase().includes(term));
            els.list.innerHTML = rows.map(({ country: c, years }) => `
                <li>
                    <button type="button" class="country-row${c.code === s.selected ? ' is-selected' : ''}"
                            data-code="${c.code}" aria-pressed="${c.code === s.selected}">
                        <span class="country-row__name">${escapeHtml(c.name)}</span>
                        <span class="country-row__meta">${escapeHtml(c.continent)}</span>
                        <span class="badges">${c.home ? '<span class="badge badge--home">Home</span>' : ''}${
                            years.map(y => `<span class="badge">${y}</span>`).join('')}</span>
                    </button>
                </li>`).join('');
            els.empty.hidden = rows.length > 0;
            els.empty.textContent = view.visible.length ? 'No countries match your search.' : 'No visits in this range.';
        },
    };
}
