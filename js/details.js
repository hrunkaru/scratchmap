import { escapeHtml } from './map.js';

// Card describing the selected country.
export function createDetails(el, { store }) {
    el.addEventListener('click', event => {
        if (event.target.closest('[data-close]')) store.set({ selected: null });
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && store.get().selected) store.set({ selected: null });
    });

    return {
        update(view, s) {
            el.hidden = !s.selected;
            if (!s.selected) return;
            const entry = view.byCode.get(s.selected);
            const c = entry.country;
            const inWindow = new Set(entry.years);
            const kind = c.un ? 'UN member' : 'Not a UN member';
            let body;
            if (c.years.length) {
                const visits = c.years.length;
                body = `
                    <p class="details__summary">${visits} ${visits === 1 ? 'visit' : 'visits'}
                        ${visits > 1 ? `· first ${c.years[0]} · latest ${c.years[visits - 1]}` : `in ${c.years[0]}`}</p>
                    <div class="badges">${c.years.map(y =>
                        `<span class="badge${inWindow.has(y) ? '' : ' badge--muted'}">${y}</span>`).join('')}</div>
                    ${c.years.length > entry.years.length ? '<p class="details__hint">Faded years are outside the current filter.</p>' : ''}`;
            } else if (c.home) {
                body = '<p class="details__summary">Home country</p>';
            } else {
                body = `<p class="details__summary">Not visited yet</p>
                    <p class="details__hint">Been there? Add the year to <code>${c.code}</code> in <code>countries.js</code>.</p>`;
            }
            el.innerHTML = `
                <button type="button" class="details__close" data-close aria-label="Close">×</button>
                <h2 class="details__title">${escapeHtml(c.name)}${c.home ? ' <span class="badge badge--home">Home</span>' : ''}</h2>
                <p class="details__meta">${escapeHtml(c.subregion || c.continent)} · ${kind}</p>
                ${body}`;
        },
    };
}
