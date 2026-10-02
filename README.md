# ScratchMap — my travel map

A personal map of the countries I have visited and when, published at
<https://scratchmap.runkaru.ee>.

* Static site, no backend, no build step, no external services — all libraries
  and map shapes are in `vendor/`.
* Filter by year range and continent, play the timeline year by year, click or
  tap a country (or a list entry) to zoom to it and see its visits.
* Light and dark themes (follows the system setting by default).
* The current view is kept in the URL, e.g. `?from=2020&continent=Europe&country=ITA`,
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

Optional points of interest (cities, parks…) go in `cities.js`.

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
| `js/model.js` | Pure logic: filters → visible countries and statistics |
| `js/store.js` | UI state (filters, timeline, selection) and URL syncing |
| `js/map.js` | D3 world map: zoom, selection, small-country dots, tooltip |
| `js/controls.js`, `js/sidebar.js`, `js/details.js` | Filters/timeline, stats/list, country card |
| `vendor/` | D3 v7, topojson-client, world-atlas 1:50m country shapes |
| `tools/build-meta.mjs` | Regenerates `data/countries-meta.js` |

## Credits

Originally based on [visited_places](https://github.com/pfalcon/visited_places) by
Paul Sokolovsky (MIT). Uses [D3](https://d3js.org/) and
[topojson-client](https://github.com/topojson/topojson-client) (ISC),
[world-atlas](https://github.com/topojson/world-atlas) shapes from Natural Earth
(public domain), and country data from
[world-countries](https://github.com/mledoze/countries) (ODbL).
