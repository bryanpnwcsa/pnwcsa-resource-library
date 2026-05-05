# PNWCSA Resource Library — iframe build

Two static HTML pages that render the curated resource library from a published Google Sheet. Embed via iframe on pnwcsa.org.

- `index.html` — public version (no farmer tips)
- `with-tips.html` — members-only version (shows F2F tips)
- `library.js` — fetch + parse + render
- `library.css` — pnwcsa.org-aligned styling

## Data source

Source of truth: Google Sheet `1P1QzY0r__pJIoIzlAt_tjGPMIK4LMfpN8Qi0MSgObgc`, two tabs (resources, tips), each published as CSV via **File → Share → Publish to web**. URLs are pinned at the top of `library.js`.

### Required columns

**Resources tab:** `Resource name`, `Website`, `Category`, `Description`, `Notes`, `ResourceID`, `Approved`, `Retracted`

**Tips tab:** `ResourceID`, `How would you like to be identified?`, `Your display name (only if attributing)`, `Your tip`, `Approved`, `Retracted`

Tips join to resources by `ResourceID` — populate this column on both tabs.

## Moderation

`library.js` filters to rows where `Approved = TRUE` and `Retracted` is not `TRUE`. While building out the sheet, set `REQUIRE_APPROVAL = false` at the top of `library.js` to preview unapproved rows.

## Local preview

```
cd pnwcsa-resource-library
python -m http.server 8000
# open http://localhost:8000/index.html and /with-tips.html
```

## Deploy (GitHub Pages)

1. Push this folder to a new public repo (e.g. `pnwcsa/resource-library`).
2. Repo Settings → Pages → Source: `main` branch, `/` root.
3. Note the URLs (e.g. `https://pnwcsa.github.io/resource-library/index.html`).

## Embed in Wix

1. **Public Farmer Resources page** → add an HTML/iframe element → URL = `index.html` deploy URL.
2. **Members-only page** (restrict to logged-in farmer members in Wix permissions) → iframe → URL = `with-tips.html` deploy URL.
3. (Optional) Auto-resize: in Velo, listen for the `pnwcsa-resize` postMessage and set the iframe height. The page already emits `window.parent.postMessage({type: "pnwcsa-resize", height}, "*")` after every render.
