let _allInv = [];
let _manufacturerMap = {};
let _selectedManufacturer = '';
let _selectedMainCategory = '';
let _headerSortState = {
  key: '',
  order: 'asc'
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadManufacturerMap();
  await loadInventory();

  document.getElementById('searchInput')?.addEventListener('input', renderInventory);
  document.getElementById('filterStatus')?.addEventListener('change', renderInventory);
  document.getElementById('sortBy')?.addEventListener('change', renderInventory);
  document.getElementById('sortOrder')?.addEventListener('change', renderInventory);

  updateHeaderSortIcons();
});

async function loadManufacturerMap() {
  try {
    const tree = await CategoryAPI.getTree();
    _manufacturerMap = {};

    (tree || [])
      .sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'ko'))
      .forEach(l1 => {
        const maker = (l1.name || '').trim();
        if (!maker) return;

        _manufacturerMap[maker] = maker;

        (l1.children || []).forEach(l2 => {
          const l2Name = (l2.name || '').trim();
          if (l2Name) _manufacturerMap[l2Name] = maker;

          (l2.children || []).forEach(l3 => {
            const l3Name = (l3.name || '').trim();
            if (l3Name) _manufacturerMap[l3Name] = maker;
          });
        });
      });
  } catch (e) {
    console.error('제조사 매핑 로드 오류:', e);
    _manufacturerMap = {};
  }
}

async function loadInventory() {
  const tbody = document.getElementById('inventoryBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fas fa-spinner fa-spin"></i></td></tr>';
  }

  try {
    _allInv = await MaterialAPI.getAll();
    renderManufacturerTabs();
    renderMainCategoryTabs();
    renderInventory();
  } catch (e) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">오류: ${e.message}</td></tr>`;
    }
  }
}

function getManufacturerName(material) {
  const category = (material?.category || '').trim();
  if (!category) return '미분류';

  if (_manufacturerMap[category]) return _manufacturerMap[category];

  const tokens = category
    .split(/[>\-|/]/)
    .map(v => v.trim())
    .filter(Boolean);

  for (const token of tokens) {
    if (_manufacturerMap[token]) return _manufacturerMap[token];
  }

  return tokens[0] || '미분류';
}

function normalizeCategoryTokens(category) {
  return String(category || '')
    .split(/[>\-|/]/)
    .map(v => v.trim())
    .filter(Boolean);
}

function getMainCategoryName(material) {
  const tokens = normalizeCategoryTokens(material?.category || '');
  if (!tokens.length) return '미분류';

  const maker = getManufacturerName(material);
  const makerIndex = tokens.findIndex(token => token === maker);

  if (makerIndex >= 0 && tokens[makerIndex + 1]) {
    return tokens[makerIndex + 1];
  }

  if (tokens[1]) return tokens[1];
  if (tokens[0]) return tokens[0];

  return '미분류';
}

function renderManufacturerTabs() {
  const wrap = document.getElementById('manufacturerTabs');
  if (!wrap) return;

  const makers = [...new Set(_allInv.map(getManufacturerName).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), 'ko'));

  wrap.innerHTML = `
    <button
      type="button"
      class="maker-tab ${_selectedManufacturer === '' ? 'active' : ''}"
      onclick="setManufacturerFilter('')"
    >전체</button>
    ${makers.map(maker => `
      <button
        type="button"
        class="maker-tab ${_selectedManufacturer === maker ? 'active' : ''}"
        onclick="setManufacturerFilter('${escapeForSingleQuote(maker)}')"
      >${esc(maker)}</button>
    `).join('')}
  `;
}

function renderMainCategoryTabs() {
  const wrap = document.getElementById('mainCategoryTabs');
  if (!wrap) return;

  let source = [..._allInv];
  if (_selectedManufacturer) {
    source = source.filter(m => getManufacturerName(m) === _selectedManufacturer);
  }

  const mains = [...new Set(source.map(getMainCategoryName).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), 'ko'));

  wrap.innerHTML = `
    <button
      type="button"
      class="subcat-tab ${_selectedMainCategory === '' ? 'active' : ''}"
      onclick="setMainCategoryFilter('')"
    >전체</button>
    ${mains.map(name => `
      <button
        type="button"
        class="subcat-tab ${_selectedMainCategory === name ? 'active' : ''}"
        onclick="setMainCategoryFilter('${escapeForSingleQuote(name)}')"
      >${esc(name)}</button>
    `).join('')}
  `;
}

function setManufacturerFilter(maker) {
  _selectedManufacturer = maker || '';
  _selectedMainCategory = '';
  renderManufacturerTabs();
  renderMainCategoryTabs();
  renderInventory();
}

function setMainCategoryFilter(name) {
  _selectedMainCategory = name || '';
  renderMainCategoryTabs();
  renderInventory();
}

function setHeaderSort(key) {
  if (_headerSortState.key === key) {
    _headerSortState.order = _headerSortState.order === 'asc' ? 'desc' : 'asc';
  } else {
    _headerSortState.key = key;
    _headerSortState.order = 'asc';
  }

  const sortByEl = document.getElementById('sortBy');
  const sortOrderEl = document.getElementById('sortOrder');

  if (sortByEl) {
    sortByEl.value = key;
  }

  if (sortOrderEl) {
    sortOrderEl.value = _headerSortState.order;
  }

  updateHeaderSortIcons();
  renderInventory();
}

function getHeaderSortIconHTML(key) {
  if (_headerSortState.key !== key) {
    return '<i class="fas fa-sort sort-icon"></i>';
  }

  return _headerSortState.order === 'asc'
    ? '<i class="fas fa-sort-up sort-icon active"></i>'
    : '<i class="fas fa-sort-down sort-icon active"></i>';
}

function updateHeaderSortIcons() {
  const keys = ['name', 'category', 'status', 'updated'];

  keys.forEach(key => {
    const el = document.getElementById(`sortIcon-${key}`);
    if (el) el.innerHTML = getHeaderSortIconHTML(key);
  });
}

function getStatusRank(material) {
  const st = getStockStatus(material);
  if (st === 'critical') return 0;
  if (st === 'low') return 1;
  return 2;
}

function escapeForSingleQuote(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function renderInventory() {
  const keyword = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('filterStatus')?.value || '';
  const sortBySelect = document.getElementById('sortBy')?.value || 'name';
  const sortOrderSelect = document.getElementById('sortOrder')?.value || 'asc';
  const tbody = document.getElementById('inventoryBody');
  if (!tbody) return;

  const activeSortKey = _headerSortState.key || sortBySelect;
  const activeSortOrder = _headerSortState.key ? _headerSortState.order : sortOrderSelect;

  updateHeaderSortIcons();

  let list = _allInv.filter(m => {
    const matchKeyword = !keyword ||
      (m.name || '').toLowerCase().includes(keyword) ||
      (m.code || '').toLowerCase().includes(keyword) ||
      (m.category || '').toLowerCase().includes(keyword) ||
      (m.location || '').toLowerCase().includes(keyword);

    const matchStatus = !statusFilter || getStockStatus(m) === statusFilter;
    const matchManufacturer = !_selectedManufacturer || getManufacturerName(m) === _selectedManufacturer;
    const matchMainCategory = !_selectedMainCategory || getMainCategoryName(m) === _selectedMainCategory;

    return matchKeyword && matchStatus && matchManufacturer && matchMainCategory;
  });

  list.sort((a, b) => {
    let result = 0;

    switch (activeSortKey) {
      case 'code':
        result = String(a.code || '').localeCompare(String(b.code || ''), 'ko');
        break;

      case 'category':
        result = String(a.category || '').localeCompare(String(b.category || ''), 'ko');
        break;

      case 'stock':
        result = Number(a.current_stock || 0) - Number(b.current_stock || 0);
        break;

      case 'min_stock':
        result = Number(a.min_stock || 0) - Number(b.min_stock || 0);
        break;

      case 'status':
        result = getStatusRank(a) - getStatusRank(b);
        break;

      case 'updated':
        result =
          new Date(a.updated_at || a.created_at || 0).getTime() -
          new Date(b.updated_at || b.created_at || 0).getTime();
        break;

      case 'name':
      default:
        result = String(a.name || '').localeCompare(String(b.name || ''), 'ko');
        break;
    }

    if (result === 0) {
      result = String(a.name || '').localeCompare(String(b.name || ''), 'ko');
    }
    if (result === 0) {
      result = String(a.code || '').localeCompare(String(b.code || ''), 'ko');
    }

    return activeSortOrder === 'desc' ? -result : result;
  });

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:40px;color:#aaa">자재가 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(m => {
    const st = getStockStatus(m);
    const pct = m.min_stock > 0
      ? Math.min(100, Math.round((Number(m.current_stock || 0) / Number(m.min_stock || 0)) * 100))
      : 100;

    const barColor =
      st === 'ok'
        ? 'var(--success)'
        : st === 'low'
          ? 'var(--warning)'
          : 'var(--danger)';

    return `
      <tr>
        <td>
          <code style="font-size:.75rem;background:#f0f2f5;padding:2px 6px;border-radius:4px">
            ${esc(m.code || '-')}
          </code>
        </td>
        <td><strong>${esc(m.name || '-')}</strong></td>
        <td>
          <div style="display:flex;flex-direction:column;gap:4px">
            <span style="font-size:.82rem;color:#444">${esc(m.category || '-')}</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <span style="font-size:.72rem;background:#eef6ff;color:#1565c0;padding:2px 8px;border-radius:999px">
                제조사 ${esc(getManufacturerName(m))}
              </span>
              <span style="font-size:.72rem;background:#f5f5f5;color:#666;padding:2px 8px;border-radius:999px">
                대분류 ${esc(getMainCategoryName(m))}
              </span>
            </div>
          </div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <strong>${m.current_stock ?? 0}</strong>
            <span style="font-size:.75rem;color:#888">${esc(m.unit || 'EA')}</span>
            <div style="flex:1;min-width:60px;background:#e9ecef;border-radius:4px;height:6px">
              <div style="width:${pct}%;background:${barColor};height:6px;border-radius:4px;transition:width .3s"></div>
            </div>
          </div>
        </td>
        <td>${m.min_stock ?? 0} ${esc(m.unit || 'EA')}</td>
        <td>${statusBadgeHTML(st)}</td>
        <td style="font-size:.78rem;color:#888">${fmtDate(m.updated_at || m.created_at)}</td>
      </tr>
    `;
  }).join('');
}