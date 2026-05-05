/* PNWCSA Resource Library renderer.
   Two pages share this file; index.html sets SHOW_TIPS = false,
   with-tips.html sets SHOW_TIPS = true. */

const RESOURCES_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQp_lYe9SV489ucdEE7tAf8FwgAVw6KuMz_yIOf2zFlAFfUpeBW8MjPipu74zM24bgYV9Ik3VIyv2Bj/pub?gid=1234420744&single=true&output=csv";
const TIPS_CSV      = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQp_lYe9SV489ucdEE7tAf8FwgAVw6KuMz_yIOf2zFlAFfUpeBW8MjPipu74zM24bgYV9Ik3VIyv2Bj/pub?gid=1049912398&single=true&output=csv";

// Rows must have Approved=TRUE and Retracted!=TRUE to appear.
// Set to false for previewing unapproved data while building out the sheet.
const REQUIRE_APPROVAL = true;

const state = {
  resources: [],
  tips: [],
  search: "",
  activeCategories: new Set(),
  sortKey: "Resource name",
  sortDir: 1, // 1 asc, -1 desc
  expanded: new Set(),
};

const isTrue = (v) => String(v ?? "").trim().toUpperCase() === "TRUE";

function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: reject,
    });
  });
}

function approvedFilter(rows) {
  if (!REQUIRE_APPROVAL) return rows.filter(r => !isTrue(r.Retracted));
  return rows.filter(r => isTrue(r.Approved) && !isTrue(r.Retracted));
}

function joinTips(resources, tips) {
  const byId = new Map();
  for (const t of tips) {
    const key = (t.ResourceID || "").trim();
    if (!key) continue;
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key).push(t);
  }
  return resources.map(r => ({
    ...r,
    _tips: byId.get((r.ResourceID || "").trim()) || [],
  }));
}

function distinctCategories(rows) {
  const set = new Set();
  for (const r of rows) {
    const c = (r.Category || "").trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function applyFilters(rows) {
  const q = state.search.trim().toLowerCase();
  return rows.filter(r => {
    if (state.activeCategories.size > 0) {
      if (!state.activeCategories.has((r.Category || "").trim())) return false;
    }
    if (q) {
      const hay = [r["Resource name"], r.Description, r.Notes, r["Why useful"], r.Category]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function applySort(rows) {
  const key = state.sortKey;
  const dir = state.sortDir;
  return [...rows].sort((a, b) => {
    const av = (a[key] || "").toString().toLowerCase();
    const bv = (b[key] || "").toString().toLowerCase();
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[c]));
}

function shortUrl(u) {
  if (!u) return "";
  try {
    const h = new URL(u).hostname.replace(/^www\./, "");
    return h;
  } catch { return u; }
}

function renderRow(r) {
  const id = (r.ResourceID || r["Resource name"] || "").trim();
  const tips = r._tips || [];
  const hasTips = window.SHOW_TIPS && tips.length > 0;
  const expanded = state.expanded.has(id);

  const nameCell = r.Website
    ? `<a href="${escapeHTML(r.Website)}" target="_blank" rel="noopener">${escapeHTML(r["Resource name"])}</a>`
    : escapeHTML(r["Resource name"]);

  const desc = r.Description ? `<div>${escapeHTML(r.Description)}</div>` : "";
  const notes = r.Notes ? `<div class="notes">${escapeHTML(r.Notes)}</div>` : "";

  const tipsToggle = window.SHOW_TIPS
    ? `<button class="tips-toggle" data-toggle="${escapeHTML(id)}">
         ${tips.length > 0 ? (expanded ? "▾" : "▸") + ` Farmer tips (${tips.length})` : "No farmer tips yet"}
       </button>`
    : "";

  let html = `<tr data-id="${escapeHTML(id)}">
    <td data-label="Resource" class="resource-name">${nameCell}${tipsToggle}</td>
    <td data-label="Website" class="website-cell">${r.Website ? `<a href="${escapeHTML(r.Website)}" target="_blank" rel="noopener">${escapeHTML(shortUrl(r.Website))}</a>` : ""}</td>
    <td data-label="Category">${r.Category ? `<span class="cat-pill">${escapeHTML(r.Category)}</span>` : ""}</td>
    <td data-label="Description">${desc}${notes}</td>
  </tr>`;

  if (hasTips && expanded) {
    const tipsHTML = tips.map(t => {
      const showName = String(t["How would you like to be identified?"] || "").toLowerCase().includes("name")
        && (t["Your display name (only if attributing)"] || "").trim();
      const attr = showName ? escapeHTML(t["Your display name (only if attributing)"]) : "Anonymous farmer";
      return `<div class="tip">
        <div>${escapeHTML(t["Your tip"] || "")}</div>
        <div class="tip-attr">— ${attr}</div>
      </div>`;
    }).join("");
    html += `<tr class="tips-row"><td colspan="4">${tipsHTML}</td></tr>`;
  }

  return html;
}

function render() {
  const rows = applySort(applyFilters(state.resources));

  const arrow = (k) => state.sortKey === k ? `<span class="arrow">${state.sortDir === 1 ? "▲" : "▼"}</span>` : "";

  const html = `
    <table>
      <thead>
        <tr>
          <th data-sort="Resource name">Resource ${arrow("Resource name")}</th>
          <th data-sort="Website">Website ${arrow("Website")}</th>
          <th data-sort="Category">Category ${arrow("Category")}</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? rows.map(renderRow).join("") : `<tr><td colspan="4" class="empty">No resources match your filters.</td></tr>`}
      </tbody>
    </table>
  `;
  document.getElementById("table-container").innerHTML = html;
  document.getElementById("count").textContent = `${rows.length} resource${rows.length === 1 ? "" : "s"}`;

  postHeight();
}

function renderChips() {
  const cats = distinctCategories(state.resources);
  const html = cats.map(c => {
    const active = state.activeCategories.has(c) ? " active" : "";
    return `<button class="chip${active}" data-cat="${escapeHTML(c)}">${escapeHTML(c)}</button>`;
  }).join("");
  document.getElementById("chips").innerHTML = html;
}

function postHeight() {
  // Tell the parent Wix page how tall the iframe needs to be.
  const h = document.documentElement.scrollHeight;
  if (window.parent !== window) {
    window.parent.postMessage({ type: "pnwcsa-resize", height: h }, "*");
  }
}

function attachHandlers() {
  document.getElementById("search").addEventListener("input", (e) => {
    state.search = e.target.value;
    render();
  });

  document.getElementById("chips").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const cat = btn.dataset.cat;
    if (state.activeCategories.has(cat)) state.activeCategories.delete(cat);
    else state.activeCategories.add(cat);
    renderChips();
    render();
  });

  document.getElementById("table-container").addEventListener("click", (e) => {
    const sortHeader = e.target.closest("th[data-sort]");
    if (sortHeader) {
      const k = sortHeader.dataset.sort;
      if (state.sortKey === k) state.sortDir *= -1;
      else { state.sortKey = k; state.sortDir = 1; }
      render();
      return;
    }
    const toggle = e.target.closest(".tips-toggle");
    if (toggle) {
      const id = toggle.dataset.toggle;
      if (state.expanded.has(id)) state.expanded.delete(id);
      else state.expanded.add(id);
      render();
    }
  });
}

async function init() {
  const container = document.getElementById("table-container");
  container.innerHTML = `<div class="empty">Loading resources…</div>`;
  try {
    const [resources, tips] = await Promise.all([
      loadCSV(RESOURCES_CSV),
      window.SHOW_TIPS ? loadCSV(TIPS_CSV) : Promise.resolve([]),
    ]);
    state.resources = joinTips(approvedFilter(resources), approvedFilter(tips));
    state.tips = tips;
    renderChips();
    render();
    attachHandlers();
    window.addEventListener("resize", postHeight);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error">Could not load resources. Please try refreshing.</div>`;
  }
}

document.addEventListener("DOMContentLoaded", init);
