# Contributing

Thanks for looking. The project is small on purpose: a parser, a renderer and one HTML page.

## Set up

```sh
git clone https://github.com/Arthur031221/ChitWeave
cd ChitWeave
npm ci
npm run build   # writes dist/index.html, the single file the site serves
npm test        # parser, aggregate, layout, picture and command line tests
npx playwright install chromium firefox
npm run test:e2e
```

Node 20 or newer. The only runtime code is in `src/`, and `src/core` has no dependencies.

## Where things live

| Path | What it does |
| --- | --- |
| `src/core/parse.js` | Reads a LINE export and returns counts. |
| `src/core/aggregate.js` | The aggregate format, the date range and the thickness scale. |
| `src/core/layout.js` | Geometry only: where every thread goes. |
| `src/core/svg.js` | Draws the layout as an SVG string. |
| `src/app/` | The page: import, controls, the shuttle, saving. |
| `bin/chitweave.js` | The command line tool. |
| `fixtures/` | Made up exports and the aggregate they come from. Regenerate with `npm run fixtures`. |

## A new export layout

The most useful contribution is a layout the parser refuses. Open an issue with the
first five lines of your export with the names and text replaced, the line numbers the
page reported, and the app and language it came from. Never attach a real chat.
A fix needs a fixture in the same layout, made up, and a test that counts it by hand.

## Rules for a pull request

- Tests pass: `npm test` and `npm run test:e2e`. Commit the rebuilt `dist/index.html`, CI checks it is current.
- Counting changes come with a hand counted test.
- Nothing may leave the page. The policy in `scripts/build.mjs` blocks requests and a test checks it, so do not loosen it.
- Keep `src/core` free of dependencies and of the DOM.
