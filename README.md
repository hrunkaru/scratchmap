# ScratchMap — my travel map

A personal map of the countries I have visited and when, published at
<https://scratchmap.runkaru.ee>.

* Static site, no backend, no build step, no external services — all libraries
  and map shapes are in `vendor/`.
* Full-screen map with a two-handle year range, continent filter and a timeline
  that plays your travels year by year (play/pause, step, 0.5×–2× speed).
* Click or tap a country (or a list entry) to zoom to it and see its visits.
* Side panel with two tabs, which can be hidden on desktop and becomes a
  swipe-up sheet on phones:
  * **Overview** — headline numbers, highlights (first trip, most visited, busiest
    year, longest streak, newest country), a chart of new vs. return visits per
    year, a running total of countries, progress per continent and a
    year-by-year table.
  * **Countries** — searchable list of the countries in the current view.
* Every number and chart follows the year range and continent filter.
* Keyboard: <kbd>Space</kbd> play/pause, <kbd>←</kbd>/<kbd>→</kbd> step a year,
  <kbd>Esc</kbd> close the country card.
* Light and dark themes (follows the system setting by default).
* The current view is kept in the URL, e.g. `?from=2020&to=2024&continent=Europe&country=ITA`,
  so it can be bookmarked or shared.

## Adding a trip

Edit `countries.js`. Every country and territory has a line; add the year to its list:

```js
FRA: {years: [2025, 2026]},          // France
```

* One entry per year (visiting twice in the same year still counts once).
* The home country is marked with `home: true` and is always shown.
* Mistakes such as unknown codes, duplicate years or non-numeric years are
  shown in a yellow box at the top of the sidebar (and in the browser console).
* Country codes are ISO 3166-1 alpha-3; the comment at the end of each line
  gives the name, so searching the file for the country name finds its line.

Optional points of interest (cities, parks…) go in `cities.js`.

### Checking your changes

Every push to GitHub runs the **Check** workflow (`.github/workflows/check.yml`):
it validates `countries.js`/`cities.js` and runs the tests. A red ✗ on the commit
means something needs fixing — the log names the country and the problem.

With [Node.js](https://nodejs.org/) 20+ installed you can run the same checks
locally (nothing to install):

```sh
npm run check   # validate the data files, print a summary
npm test        # data checks + tests for filters and statistics
```

Editing directly on github.com works too; the workflow result appears on the
commit a minute later.

## Previewing locally

Browsers do not run JavaScript modules from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Project layout

| Path | What it is |
| --- | --- |
| `countries.js` | My visits — the only file normally edited |
| `cities.js` | Optional points of interest |
| `data/countries-meta.js` | Names, continents, UN membership and positions for every country (generated) |
| `js/data.js` | Reads and validates the data files |
| `js/model.js` | Pure logic: filters → visible countries, statistics and insights |
| `js/store.js` | UI state (filters, timeline, selection) and URL syncing |
| `js/map.js` | D3 world map: zoom, selection, small-country dots, tooltip |
| `js/controls.js`, `js/details.js` | Filters/timeline, country card |
| `js/overview.js`, `js/sidebar.js`, `js/tabs.js` | Overview tab (stats, charts), country list, tab switching |
| `js/layout.js` | Collapsible side panel (desktop) and bottom sheet (phone) |
| `vendor/` | D3 v7, topojson-client, world-atlas 1:50m country shapes |
| `tools/build-meta.mjs` | Regenerates `data/countries-meta.js` |
| `tools/check-data.mjs`, `test/` | Data validation and tests (`npm run check`, `npm test`) |

## Publishing

The site is served by GitHub Pages straight from the repository (custom domain
in `CNAME`; `.nojekyll` makes Pages serve the files as they are). There is no
build step: merge to the published branch and the change is live.

## Credits

Originally based on [visited_places](https://github.com/pfalcon/visited_places) by
Paul Sokolovsky (MIT). Uses [D3](https://d3js.org/) and
[topojson-client](https://github.com/topojson/topojson-client) (ISC),
[world-atlas](https://github.com/topojson/world-atlas) shapes from Natural Earth
(public domain), and country data from
[world-countries](https://github.com/mledoze/countries) (ODbL).
