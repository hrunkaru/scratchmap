import { CONTINENTS, yearBounds } from './model.js';

const STEP_MS = 900;
const SPEEDS = [0.5, 1, 2];

// Continent chips and the timeline: a two-handle year range with play/pause, step and speed.
// Playback grows the end of the range one year at a time, so the map fills in chronologically.
export function createControls(els, { store, dataset }) {
    const { min, max } = yearBounds(dataset);

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

    for (const input of [els.from, els.to]) {
        input.min = min;
        input.max = max;
        input.step = 1;
    }

    // Where the current playback stops; null when no playback is in progress.
    let playEnd = null;
    let speed = 1;
    let timer = null;

    function setRange(patch) {
        playEnd = null;
        store.set({ ...patch, playing: false });
    }

    els.from.addEventListener('input', () => setRange({ from: Math.min(+els.from.value, store.get().to) }));
    els.to.addEventListener('input', () => setRange({ to: Math.max(+els.to.value, store.get().from) }));

    function step(delta) {
        const s = store.get();
        setRange({ to: Math.min(max, Math.max(s.from, s.to + delta)) });
    }
    els.back.addEventListener('click', () => step(-1));
    els.forward.addEventListener('click', () => step(1));

    function togglePlay() {
        const s = store.get();
        if (s.playing) {
            store.set({ playing: false });
        } else if (playEnd !== null && s.to < playEnd) {
            store.set({ playing: true });
        } else {
            playEnd = s.to > s.from ? s.to : max;
            if (playEnd === s.from) return;
            store.set({ to: s.from, playing: true });
        }
    }
    els.play.addEventListener('click', togglePlay);

    els.speed.addEventListener('click', () => {
        speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
        els.speed.textContent = `${speed}×`;
        els.speed.setAttribute('aria-label', `Playback speed ${speed}×`);
        if (timer) {
            stopTimer();
            syncPlayback(store.get());
        }
    });

    function tick() {
        const s = store.get();
        if (playEnd === null || s.to >= playEnd) {
            playEnd = null;
            store.set({ playing: false });
            return;
        }
        const to = s.to + 1;
        if (to >= playEnd) playEnd = null;
        store.set({ to, playing: playEnd !== null });
    }

    function stopTimer() {
        clearInterval(timer);
        timer = null;
    }

    function syncPlayback(s) {
        if (s.playing && !timer) timer = setInterval(tick, STEP_MS / speed);
        else if (!s.playing && timer) stopTimer();
    }

    // Space plays/pauses and ←/→ step, unless the user is typing or using another control.
    document.addEventListener('keydown', event => {
        if (event.target !== document.body || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === ' ') togglePlay();
        else if (event.key === 'ArrowLeft') step(-1);
        else if (event.key === 'ArrowRight') step(1);
        else return;
        event.preventDefault();
    });

    return {
        update(s, view) {
            for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.value === s.continent));

            els.from.value = s.from;
            els.to.value = s.to;
            // When both handles meet, keep the one that can still move on top.
            els.from.style.zIndex = s.from === s.to && s.to === max ? 2 : 1;
            els.to.style.zIndex = s.from === s.to && s.to === max ? 1 : 2;
            const pct = y => (max > min ? ((y - min) / (max - min)) * 100 : 0);
            els.range.style.setProperty('--from', `${pct(s.from)}%`);
            els.range.style.setProperty('--to', `${pct(s.to)}%`);
            els.from.setAttribute('aria-valuetext', `From ${s.from}`);
            els.to.setAttribute('aria-valuetext', `To ${s.to}`);

            els.year.textContent = s.from === s.to ? s.to : `${s.from} – ${s.to}`;
            const n = view.visible.length;
            els.count.textContent = `${n} ${n === 1 ? 'country' : 'countries'}`;

            els.back.disabled = s.to <= s.from;
            els.forward.disabled = s.to >= max;
            els.play.disabled = min === max;
            els.play.classList.toggle('is-playing', s.playing);
            els.play.setAttribute('aria-label', s.playing ? 'Pause' : 'Play timeline');
            els.play.title = els.play.getAttribute('aria-label');
            syncPlayback(s);
        },
    };
}
