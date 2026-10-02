import { CONTINENTS, yearBounds } from './model.js';

const STEP_MS = 900;

// Year range, continent chips and the timeline (slider + play/pause).
export function createControls(els, { store, dataset }) {
    const { min, max } = yearBounds(dataset);
    const years = [];
    for (let y = min; y <= max; y++) years.push(y);

    for (const select of [els.from, els.to]) {
        select.replaceChildren(...years.map(y => new Option(y, y)));
    }
    els.from.addEventListener('change', () => {
        const to = store.get().to;
        store.set({ from: +els.from.value, cursor: to, playing: false });
    });
    els.to.addEventListener('change', () => {
        store.set({ to: +els.to.value, cursor: +els.to.value, playing: false });
    });

    const used = new Set([...dataset.countries.values()].filter(c => c.home || c.years.length).map(c => c.continent));
    const chips = ['all', ...CONTINENTS.filter(c => c !== 'Antarctica' || used.has(c))].map(value => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.dataset.value = value;
        b.textContent = value === 'all' ? 'All' : value;
        b.addEventListener('click', () => store.set({ continent: value }));
        return b;
    });
    els.continents.replaceChildren(...chips);

    els.slider.addEventListener('input', () => store.set({ cursor: +els.slider.value, playing: false }));

    els.play.addEventListener('click', () => {
        const s = store.get();
        if (s.playing) store.set({ playing: false });
        else store.set({ playing: true, cursor: s.cursor >= s.to ? s.from : s.cursor });
    });

    let timer = null;
    function syncPlayback(s) {
        if (s.playing && !timer) {
            timer = setInterval(() => {
                const cur = store.get();
                if (cur.cursor >= cur.to) store.set({ playing: false });
                else store.set({ cursor: cur.cursor + 1, playing: cur.cursor + 1 < cur.to });
            }, STEP_MS);
        } else if (!s.playing && timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    return {
        update(s, view) {
            els.from.value = s.from;
            els.to.value = s.to;
            for (const opt of els.from.options) opt.disabled = +opt.value > s.to;
            for (const opt of els.to.options) opt.disabled = +opt.value < s.from;

            for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.value === s.continent));

            els.slider.min = s.from;
            els.slider.max = s.to;
            els.slider.value = s.cursor;
            els.slider.disabled = s.from === s.to;
            const pct = s.to > s.from ? ((s.cursor - s.from) / (s.to - s.from)) * 100 : 100;
            els.slider.style.setProperty('--progress', `${pct}%`);

            els.year.textContent = s.from === s.cursor ? s.cursor : `${s.from} – ${s.cursor}`;
            const n = view.visible.length;
            els.count.textContent = `${n} ${n === 1 ? 'country' : 'countries'}`;

            els.play.disabled = s.from === s.to;
            els.play.textContent = s.playing ? 'Pause' : s.cursor >= s.to ? 'Replay' : 'Play';
            els.play.setAttribute('aria-pressed', String(s.playing));
            els.play.classList.toggle('is-playing', s.playing);
            syncPlayback(s);
        },
    };
}
