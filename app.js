const MANIFEST_URL = 'assets/assets_manifest.json';

const preview = document.getElementById('pfp-preview');
const randomBtn = document.getElementById('generate-btn');
const gallery = document.getElementById('gallery');
const pfpNumber = document.getElementById('pfp-number');
const countEl = document.getElementById('count');
const attrsGrid = document.getElementById('attrs-grid');
const filterControls = document.getElementById('filter-controls');
const clearFiltersBtn = document.getElementById('clear-filters');
const themeToggleBtn = document.getElementById('theme-toggle');

const firstBtn = document.getElementById('first-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const lastBtn = document.getElementById('last-btn');

const THEME_KEY = 'nsidirectory.theme';
const PAGE_SIZE = 42;

let assets = [];
let indexes = [];
let currentIndexPos = 0;
let currentPage = 1;
let currentAsset = null;
let activeFilters = {
  artist: '',
  rarity: '',
  mime: '',
  index: '',
};

function applyTheme(mode) {
  const dark = mode === 'dark';
  document.body.classList.toggle('dark', dark);
  if (themeToggleBtn) themeToggleBtn.textContent = `Dark Mode: ${dark ? 'On' : 'Off'}`;
}

function humanMime(asset) {
  return asset.mime || asset.content_type || 'unknown';
}

function artistValue(asset) {
  let v = String(asset.artist || asset.Artist || 'Unknown').trim();
  const wrapped = v.match(/^[a-z_]+:\s*"(.*)"\s*,?$/i);
  if (wrapped) v = wrapped[1].trim();
  v = v.replace(/^Artist\s*:\s*/i, '').trim();
  return v || 'Unknown';
}

function rarityValue(asset) {
  const raw = asset.rarity_score ?? asset.rarity ?? asset.Rarity ?? asset.score ?? asset.Score;
  return raw ?? 'Unknown';
}

function issuanceValue(asset) {
  return asset.issuance ?? asset.Issuance ?? 'Unknown';
}

function socialValue(asset) {
  return asset.social_handle ?? asset.social ?? asset['Social Handle'] ?? 'Unknown';
}

function scoreValue(asset) {
  return asset.score ?? asset.Score ?? 'Unknown';
}

function filteredAssets() {
  return assets.filter((a) => {
    if (activeFilters.artist && artistValue(a) !== activeFilters.artist) return false;
    if (activeFilters.rarity && String(rarityValue(a)) !== activeFilters.rarity) return false;
    if (activeFilters.mime && humanMime(a) !== activeFilters.mime) return false;
    if (activeFilters.index && a.index !== activeFilters.index) return false;
    return true;
  });
}

function hasActiveFilters() {
  return Object.values(activeFilters).some(Boolean);
}

function currentIndexAssets() {
  const indexKey = indexes[currentIndexPos];
  return filteredAssets().filter((a) => a.index === indexKey);
}

function pagedFilteredAssets() {
  const all = filteredAssets();
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  return { all, totalPages, page: all.slice(start, start + PAGE_SIZE) };
}

function buildAttributeRows() {
  attrsGrid.innerHTML = '';
  const rows = [
    ['Asset #', 'asset'],
    ['Stamp #', 'stamp_number'],
    ['Artist', 'artist'],
    ['Social Handle', 'social_handle'],
    ['Issuance', 'issuance'],
    ['Score', 'score'],
    ['Rarity Score', 'rarity_score'],
    ['MIME Type', 'mime'],
    ['Index', 'index'],
  ];

  for (const [label, key] of rows) {
    const labelEl = document.createElement('span');
    labelEl.textContent = `${label}:`;

    const valueEl = document.createElement('span');
    valueEl.dataset.key = key;
    valueEl.textContent = '-';

    attrsGrid.append(labelEl, valueEl);
  }
}

function setAttr(key, value) {
  const cell = document.querySelector(`[data-key="${key}"]`);
  if (!cell) return;
  cell.textContent = value ?? '-';
  cell.classList.remove('active');
  requestAnimationFrame(() => cell.classList.add('active'));
  setTimeout(() => cell.classList.remove('active'), 420);
}

function updateAttributes(asset) {
  if (!asset) return;
  setAttr('asset', asset.asset || 'Unknown');
  setAttr('stamp_number', asset.stamp_number || asset.preview_id_used || 'Unknown');
  setAttr('artist', artistValue(asset));
  setAttr('social_handle', socialValue(asset));
  setAttr('issuance', issuanceValue(asset));
  setAttr('score', scoreValue(asset));
  setAttr('rarity_score', rarityValue(asset));
  setAttr('mime', humanMime(asset));
  setAttr('index', asset.index || 'Unknown');
}

function isRenderableImageFile(asset) {
  const file = String(asset.file || '').toLowerCase();
  return ['.png', '.gif', '.jpg', '.jpeg', '.webp', '.svg', '.avif'].some((ext) => file.endsWith(ext));
}

function isHtmlMime(asset) {
  return String(humanMime(asset)).toLowerCase().includes('html');
}

function createAssetElement(asset, className = 'library-tile') {
  const localSrc = `assets/${asset.file}`;

  if (isHtmlMime(asset)) {
    const frame = document.createElement('iframe');
    frame.className = className === 'library-tile' ? 'library-tile-frame' : className;
    frame.loading = className === 'library-tile' ? 'lazy' : 'eager';
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('title', `${asset.title} (${asset.asset})`);
    frame.setAttribute('scrolling', 'no');

    const fallbackSrc = `https://api.stamped.ninja/assets/${asset.asset}.png`;
    const preferFallback = Number(asset.bytes || 0) > 0 && Number(asset.bytes) < 12000;
    const primarySrc = preferFallback ? fallbackSrc : (asset.preview_url || localSrc);
    const escapedPrimary = primarySrc.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const escapedFallback = fallbackSrc.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#111}img{width:100%;height:100%;object-fit:contain;display:block}</style></head><body><img src="${escapedPrimary}" alt="${asset.asset}" onerror="if(this.dataset.fallback!=='1'){this.dataset.fallback='1';this.src='${escapedFallback}';}"></body></html>`;

    return frame;
  }

  if (!isRenderableImageFile(asset)) {
    const mime = humanMime(asset);
    const placeholder = document.createElement('div');
    placeholder.className = className;
    placeholder.textContent = `Preview unavailable (${mime})`;
    placeholder.style.fontSize = '10px';
    placeholder.style.padding = '6px';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    return placeholder;
  }

  const img = document.createElement('img');
  img.className = className;
  img.src = localSrc;
  img.alt = `${asset.title} (${asset.asset})`;
  return img;
}

function setMainPreview(asset) {
  preview.innerHTML = '';
  preview.append(createAssetElement(asset, 'preview-asset'));
}

function optionValues(getter) {
  return [...new Set(assets.map(getter).map((v) => String(v ?? 'Unknown')))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function makeSelectRow({ label, key, values }) {
  const row = document.createElement('div');
  row.className = 'filter-row';

  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.htmlFor = `filter-${key}`;

  const select = document.createElement('select');
  select.id = `filter-${key}`;
  select.dataset.key = key;

  const anyOpt = document.createElement('option');
  anyOpt.value = '';
  anyOpt.textContent = 'Any';
  select.appendChild(anyOpt);

  for (const value of values) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }

  select.addEventListener('change', async (e) => {
    const k = e.target.dataset.key;
    activeFilters[k] = e.target.value || '';

    currentPage = 1;
    const allowedIndexes = [...new Set(filteredAssets().map((a) => a.index))].sort();
    if (!allowedIndexes.length) {
      await renderGalleryPage();
      return;
    }

    if (!allowedIndexes.includes(indexes[currentIndexPos])) {
      currentIndexPos = indexes.indexOf(allowedIndexes[0]);
    }

    await renderGalleryPage();
  });

  row.append(labelEl, select);
  return row;
}

function buildFilterControls() {
  filterControls.innerHTML = '';
  filterControls.append(
    makeSelectRow({ label: 'Artist', key: 'artist', values: optionValues((a) => artistValue(a)) }),
    makeSelectRow({ label: 'Rarity', key: 'rarity', values: optionValues((a) => rarityValue(a)) }),
    makeSelectRow({ label: 'Mime Type', key: 'mime', values: optionValues((a) => humanMime(a)) }),
    makeSelectRow({ label: 'Indexes', key: 'index', values: indexes })
  );
}

function assetTooltip(asset) {
  return [
    `Asset: ${asset.asset}`,
    `Title: ${asset.title}`,
    `Artist: ${artistValue(asset)}`,
    `Rarity: ${rarityValue(asset)}`,
    `Mime: ${humanMime(asset)}`,
    `Index: ${asset.index}`,
  ].join('<br>');
}

async function selectAsset(asset, selectedNode = null) {
  currentAsset = asset;
  pfpNumber.textContent = asset.title || `${asset.index} · ${asset.asset}`;
  updateAttributes(asset);
  setMainPreview(asset);

  document.querySelectorAll('.gallery-item.selected').forEach((el) => el.classList.remove('selected'));
  if (selectedNode) selectedNode.classList.add('selected');
}

async function renderGalleryPage() {
  gallery.innerHTML = '';

  const allowedIndexes = [...new Set(filteredAssets().map((a) => a.index))].sort();
  const filteredMode = hasActiveFilters();

  let pageAssets = [];
  let totalPages = 1;

  if (filteredMode) {
    const paged = pagedFilteredAssets();
    pageAssets = paged.page;
    totalPages = paged.totalPages;
  } else {
    pageAssets = currentIndexAssets();
  }

  countEl.textContent = pageAssets.length.toLocaleString();

  for (const asset of pageAssets) {
    const item = document.createElement('div');
    item.className = 'gallery-item';

    const tile = createAssetElement(asset, 'library-tile');
    tile.setAttribute('role', 'img');

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.innerHTML = assetTooltip(asset);

    item.addEventListener('click', async () => {
      await selectAsset(asset, item);
    });

    item.append(tile, tooltip);
    gallery.append(item);
  }

  if (filteredMode) {
    const navigablePages = totalPages > 1;
    firstBtn.disabled = !navigablePages || currentPage === 1;
    prevBtn.disabled = !navigablePages || currentPage === 1;
    nextBtn.disabled = !navigablePages || currentPage >= totalPages;
    lastBtn.disabled = !navigablePages || currentPage >= totalPages;
  } else {
    const navigable = allowedIndexes.length > 0;
    firstBtn.disabled = !navigable || indexes[currentIndexPos] === allowedIndexes[0];
    prevBtn.disabled = !navigable || indexes[currentIndexPos] === allowedIndexes[0];
    nextBtn.disabled = !navigable || indexes[currentIndexPos] === allowedIndexes[allowedIndexes.length - 1];
    lastBtn.disabled = !navigable || indexes[currentIndexPos] === allowedIndexes[allowedIndexes.length - 1];
  }

  if (!currentAsset && pageAssets[0]) {
    await selectAsset(pageAssets[0]);
  }
}

async function pickRandomAsset() {
  const candidates = filteredAssets();
  if (!candidates.length) return;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];

  if (hasActiveFilters()) {
    const idx = candidates.findIndex((a) => a.asset === picked.asset);
    currentPage = Math.floor(Math.max(0, idx) / PAGE_SIZE) + 1;
  } else {
    const newPos = indexes.indexOf(picked.index);
    if (newPos >= 0) currentIndexPos = newPos;
  }

  await renderGalleryPage();

  const tileNode = [...document.querySelectorAll('.gallery-item')].find((node) =>
    node.querySelector('.tooltip')?.innerHTML.includes(picked.asset)
  );
  await selectAsset(picked, tileNode || null);
}

function stepIndex(direction) {
  const allowed = [...new Set(filteredAssets().map((a) => a.index))].sort();
  if (!allowed.length) return;
  const current = indexes[currentIndexPos];
  const pos = allowed.indexOf(current);
  const safePos = pos === -1 ? 0 : pos;
  const nextAllowedPos = Math.max(0, Math.min(allowed.length - 1, safePos + direction));
  const nextIndexKey = allowed[nextAllowedPos];
  const absolutePos = indexes.indexOf(nextIndexKey);
  if (absolutePos >= 0) currentIndexPos = absolutePos;
}

async function loadManifest() {
  let manifest = null;

  if (window.NSI_ASSETS_MANIFEST) {
    manifest = window.NSI_ASSETS_MANIFEST;
  } else {
    try {
      const res = await fetch(MANIFEST_URL);
      manifest = await res.json();
    } catch {
      // file:// fallback can fail fetch; require preloaded JS manifest.
    }
  }

  if (!manifest?.assets?.length) {
    throw new Error('Assets manifest unavailable. Ensure assets/assets_manifest.js is loaded.');
  }

  assets = manifest.assets || [];
  indexes = [...new Set(assets.map((a) => a.index))].sort();
}

randomBtn.addEventListener('click', pickRandomAsset);

firstBtn.addEventListener('click', async () => {
  if (hasActiveFilters()) {
    currentPage = 1;
    currentAsset = null;
    await renderGalleryPage();
    return;
  }

  const allowed = [...new Set(filteredAssets().map((a) => a.index))].sort();
  if (!allowed.length) return;
  currentIndexPos = indexes.indexOf(allowed[0]);
  currentAsset = null;
  await renderGalleryPage();
});

prevBtn.addEventListener('click', async () => {
  if (hasActiveFilters()) {
    currentPage = Math.max(1, currentPage - 1);
  } else {
    stepIndex(-1);
  }
  currentAsset = null;
  await renderGalleryPage();
});

nextBtn.addEventListener('click', async () => {
  if (hasActiveFilters()) {
    const totalPages = Math.max(1, Math.ceil(filteredAssets().length / PAGE_SIZE));
    currentPage = Math.min(totalPages, currentPage + 1);
  } else {
    stepIndex(1);
  }
  currentAsset = null;
  await renderGalleryPage();
});

lastBtn.addEventListener('click', async () => {
  if (hasActiveFilters()) {
    currentPage = Math.max(1, Math.ceil(filteredAssets().length / PAGE_SIZE));
    currentAsset = null;
    await renderGalleryPage();
    return;
  }

  const allowed = [...new Set(filteredAssets().map((a) => a.index))].sort();
  if (!allowed.length) return;
  currentIndexPos = indexes.indexOf(allowed[allowed.length - 1]);
  currentAsset = null;
  await renderGalleryPage();
});

clearFiltersBtn?.addEventListener('click', async () => {
  activeFilters = { artist: '', rarity: '', mime: '', index: '' };
  document.querySelectorAll('#filter-controls select').forEach((s) => { s.value = ''; });
  currentIndexPos = 0;
  currentPage = 1;
  currentAsset = null;
  await renderGalleryPage();
});

themeToggleBtn?.addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark');
  const next = isDark ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

(async function init() {
  try {
    applyTheme(localStorage.getItem(THEME_KEY) || 'light');
    await loadManifest();
    buildAttributeRows();
    buildFilterControls();
    await renderGalleryPage();
  } catch (err) {
    console.error('Failed to initialize NSIDirectory browser:', err);
  }
})();
