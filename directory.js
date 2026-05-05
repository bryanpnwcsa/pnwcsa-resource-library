/* PNWCSA F2F Directory — members-only people directory with reviews. */

const LISTINGS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQp_lYe9SV489ucdEE7tAf8FwgAVw6KuMz_yIOf2zFlAFfUpeBW8MjPipu74zM24bgYV9Ik3VIyv2Bj/pub?gid=840758404&single=true&output=csv";
const FEEDBACK_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQp_lYe9SV489ucdEE7tAf8FwgAVw6KuMz_yIOf2zFlAFfUpeBW8MjPipu74zM24bgYV9Ik3VIyv2Bj/pub?gid=1460795&single=true&output=csv";

const REQUIRE_APPROVAL = true;

const state = {
  listings: [],
  search: "",
  activeCategories: new Set(),
  activeRegions: new Set(),
  sortKey: "Person's name",
  sortDir: 1,
  expanded: new Set(),
};

const isTrue = (v) => String(v ?? "").trim().toUpperCase() === "TRUE";

function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true, header: true, skipEmptyLines: true,
      complete: (res) => resolve(res.data), error: reject,
    });
  });
}

function approvedFilter(rows) {
  if (!REQUIRE_APPROVAL) return rows.filter(r => !isTrue(r.Retracted));
  return rows.filter(r => isTrue(r.Approved) && !isTrue(r.Retracted));
}

function joinFeedback(listings, feedback) {
  const byId = new Map();
  for (const f of feedback) {
    const key = (f.PersonID || "").trim();
    if (!key) continue;
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key).push(f);
  }
  return listings.map(l => ({
    ...l,
    _reviews: byId.get((l.PersonID || "").trim()) || [],
  }));
}

function splitMulti(s) {
  return String(s || "").split(/[,;]/).map(x => x.trim()).filter(Boolean);
}

function distinctValues(rows, field) {
  const set = new Set();
  for (const r of rows) splitMulti(r[field]).forEach(v => set.add(v));
  return [...set].sort((a, b) => a.localeCompare(b));
}

function applyFilters(rows) {
  const q = state.search.trim().toLowerCase();
  return rows.filter(r => {
    if (state.activeCategories.size > 0) {
      if (!splitMulti(r.Category).some(c => state.activeCategories.has(c))) return false;
    }
    if (state.activeRegions.size > 0) {
      if (!splitMulti(r.Region).some(c => state.activeRegions.has(c))) return false;
    }
    if (q) {
      const hay = [r["Person's name"], r.Organization, r.Category, r["Focus/Specialty"], r.Region, r.Address]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function applySort(rows) {
  const key = state.sortKey, dir = state.sortDir;
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

function ensureProtocol(u) {
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : "https://" + u;
}

function recBadge(rec) {
  const v = String(rec || "").trim().toLowerCase();
  if (v.startsWith("yes, with")) return `<span class="rec rec-mixed">Yes, with reservations</span>`;
  if (v === "yes") return `<span class="rec rec-yes">Recommended</span>`;
  if (v === "no") return `<span class="rec rec-no">Not recommended</span>`;
  return "";
}

function pillList(value) {
  return splitMulti(value).map(v => `<span class="cat-pill">${escapeHTML(v)}</span>`).join(" ");
}

function renderReview(f) {
  const showName = String(f["How would you like to be identified?"] || "").toLowerCase().includes("name")
    && (f["Your display name (only if attributing)"] || "").trim();
  const attr = showName ? escapeHTML(f["Your display name (only if attributing)"]) : "Anonymous farmer";
  const ctx = [f["Region (optional)"], f["Farm experience (optional)"], f["Employee status (optional)"]]
    .filter(Boolean).map(escapeHTML).join(" · ");

  return `<div class="review">
    <div class="review-head">
      ${recBadge(f["Would you recommend this professional to another farmer?"])}
      <span class="review-meta">
        ${f["What service did you use this professional for?"] ? escapeHTML(f["What service did you use this professional for?"]) : ""}
        ${f["When did you most recently work with them?"] ? ` · ${escapeHTML(f["When did you most recently work with them?"])}` : ""}
      </span>
    </div>
    ${f["Tell us about your experience"] ? `<div class="review-body">${escapeHTML(f["Tell us about your experience"])}</div>` : ""}
    <div class="review-attr">— ${attr}${ctx ? ` <span class="review-ctx">(${ctx})</span>` : ""}</div>
  </div>`;
}

function renderRow(r) {
  const id = (r.PersonID || r["Person's name"] || "").trim();
  const reviews = r._reviews || [];
  const expanded = state.expanded.has(id);

  const contactBits = [];
  if (r.Website) contactBits.push(`<a href="${escapeHTML(ensureProtocol(r.Website))}" target="_blank" rel="noopener">Website</a>`);
  if (r.Phone)   contactBits.push(`<a href="tel:${escapeHTML(r.Phone.replace(/[^0-9+]/g,''))}">${escapeHTML(r.Phone)}</a>`);
  if (r.Email)   contactBits.push(`<a href="mailto:${escapeHTML(r.Email)}">${escapeHTML(r.Email)}</a>`);
  const address = r.Address ? `<div class="addr">${escapeHTML(r.Address)}</div>` : "";

  const reviewToggle = reviews.length > 0
    ? `<button class="tips-toggle" data-toggle="${escapeHTML(id)}">${expanded ? "▾" : "▸"} ${reviews.length} review${reviews.length === 1 ? "" : "s"}</button>`
    : `<span class="no-reviews">No reviews yet</span>`;

  let html = `<tr data-id="${escapeHTML(id)}">
    <td data-label="Name" class="resource-name">
      ${escapeHTML(r["Person's name"] || "")}
      ${reviewToggle}
    </td>
    <td data-label="Organization">${escapeHTML(r.Organization || "")}</td>
    <td data-label="Category">${pillList(r.Category)}</td>
    <td data-label="Focus">${pillList(r["Focus/Specialty"])}</td>
    <td data-label="Region">${pillList(r.Region)}</td>
    <td data-label="Contact" class="contact-cell">
      ${contactBits.length ? `<div>${contactBits.join(" · ")}</div>` : ""}
      ${address}
    </td>
  </tr>`;

  if (expanded && reviews.length > 0) {
    html += `<tr class="tips-row"><td colspan="6">${reviews.map(renderReview).join("")}</td></tr>`;
  }
  return html;
}

function render() {
  const rows = applySort(applyFilters(state.listings));
  const arrow = (k) => state.sortKey === k ? `<span class="arrow">${state.sortDir === 1 ? "▲" : "▼"}</span>` : "";

  const html = `
    <table>
      <thead>
        <tr>
          <th data-sort="Person's name">Name ${arrow("Person's name")}</th>
          <th data-sort="Organization">Organization ${arrow("Organization")}</th>
          <th data-sort="Category">Category ${arrow("Category")}</th>
          <th data-sort="Focus/Specialty">Focus ${arrow("Focus/Specialty")}</th>
          <th data-sort="Region">Region ${arrow("Region")}</th>
          <th>Contact</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? rows.map(renderRow).join("") : `<tr><td colspan="6" class="empty">No people match your filters.</td></tr>`}
      </tbody>
    </table>
  `;
  document.getElementById("table-container").innerHTML = html;
  document.getElementById("count").textContent = `${rows.length} ${rows.length === 1 ? "person" : "people"}`;
  postHeight();
}

function renderFilterGroup(containerId, field, activeSet) {
  const values = distinctValues(state.listings, field);
  document.getElementById(containerId).innerHTML = values.map(v => {
    const active = activeSet.has(v) ? " active" : "";
    return `<button class="chip${active}" data-value="${escapeHTML(v)}">${escapeHTML(v)}</button>`;
  }).join("");
}

function renderChips() {
  renderFilterGroup("chips-category", "Category", state.activeCategories);
  renderFilterGroup("chips-region", "Region", state.activeRegions);
}

function postHeight() {
  if (window.parent !== window) {
    window.parent.postMessage({ type: "pnwcsa-resize", height: document.documentElement.scrollHeight }, "*");
  }
}

function attachHandlers() {
  document.getElementById("search").addEventListener("input", (e) => {
    state.search = e.target.value; render();
  });

  const wireGroup = (containerId, activeSet) => {
    document.getElementById(containerId).addEventListener("click", (e) => {
      const btn = e.target.closest(".chip"); if (!btn) return;
      const v = btn.dataset.value;
      if (activeSet.has(v)) activeSet.delete(v);
      else activeSet.add(v);
      renderChips(); render();
    });
  };
  wireGroup("chips-category", state.activeCategories);
  wireGroup("chips-region", state.activeRegions);

  document.getElementById("table-container").addEventListener("click", (e) => {
    const sortHeader = e.target.closest("th[data-sort]");
    if (sortHeader) {
      const k = sortHeader.dataset.sort;
      if (state.sortKey === k) state.sortDir *= -1;
      else { state.sortKey = k; state.sortDir = 1; }
      render(); return;
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
  container.innerHTML = `<div class="empty">Loading directory…</div>`;
  try {
    const [listings, feedback] = await Promise.all([loadCSV(LISTINGS_CSV), loadCSV(FEEDBACK_CSV)]);
    state.listings = joinFeedback(approvedFilter(listings), approvedFilter(feedback));
    renderChips(); render(); attachHandlers();
    window.addEventListener("resize", postHeight);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error">Could not load directory. Please try refreshing.</div>`;
  }
}

document.addEventListener("DOMContentLoaded", init);
