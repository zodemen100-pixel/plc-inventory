/* ===================================================
   materials.js
   =================================================== */

let allMaterials = [];
let filteredMaterials = [];
let selectedMaterialIds = new Set();
let editingId = null;
let catTree = [];
let manufacturerMap = {};
let selectedManufacturer = '';
let headerSortState = {
  key: '',
  order: 'asc'
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadManufacturerMap();
  await loadMaterials();

  document.getElementById('searchInput')?.addEventListener('input', applyFilter);
  document.getElementById('filterCategory')?.addEventListener('change', applyFilter);
  document.getElementById('filterStatus')?.addEventListener('change', applyFilter);
  document.getElementById('sortBy')?.addEventListener('change', applyFilter);
  document.getElementById('sortOrder')?.addEventListener('change', applyFilter);
});

/* ─────────────────────────────────────────
   제조사 매핑 / 버튼
───────────────────────────────────────── */
async function loadManufacturerMap() {
  try {
    const tree = await CategoryAPI.getTree();
    manufacturerMap = {};

    (tree || [])
      .sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'ko'))
      .forEach(l1 => {
        const maker = (l1.name || '').trim();
        if (!maker) return;

        manufacturerMap[maker] = maker;

        (l1.children || []).forEach(l2 => {
          const l2Name = (l2.name || '').trim();
          if (l2Name) manufacturerMap[l2Name] = maker;

          (l2.children || []).forEach(l3 => {
            const l3Name = (l3.name || '').trim();
            if (l3Name) manufacturerMap[l3Name] = maker;
          });
        });
      });
  } catch (e) {
    manufacturerMap = {};
  }
}

function getManufacturerName(material) {
  const category = (material?.category || '').trim();
  if (!category) return '미분류';

  if (manufacturerMap[category]) return manufacturerMap[category];

  const tokens = category
    .split(/[>\-|/]/)
    .map(v => v.trim())
    .filter(Boolean);

  for (const token of tokens) {
    if (manufacturerMap[token]) return manufacturerMap[token];
  }

  return '미분류';
}

function renderManufacturerTabs() {
  const wrap = document.getElementById('manufacturerTabs');
  if (!wrap) return;

  const makers = [...new Set(allMaterials.map(getManufacturerName).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko'));

  wrap.innerHTML = `
    <button
      type="button"
      class="maker-tab ${selectedManufacturer === '' ? 'active' : ''}"
      onclick="setManufacturerFilter('')"
    >전체</button>
    ${makers.map(maker => `
      <button
        type="button"
        class="maker-tab ${selectedManufacturer === maker ? 'active' : ''}"
        onclick="setManufacturerFilter('${esc(maker)}')"
      >${esc(maker)}</button>
    `).join('')}
  `;
}

function setManufacturerFilter(maker) {
  selectedManufacturer = maker || '';
  renderManufacturerTabs();
  applyFilter();
}
function setHeaderSort(key) {
  if (headerSortState.key === key) {
    headerSortState.order = headerSortState.order === 'asc' ? 'desc' : 'asc';
  } else {
    headerSortState.key = key;
    headerSortState.order = 'asc';
  }

  const sortByEl = document.getElementById('sortBy');
  const sortOrderEl = document.getElementById('sortOrder');

  if (sortByEl) {
    if (key === 'status') {
      sortByEl.value = 'name';
    } else {
      sortByEl.value = key;
    }
  }

  if (sortOrderEl) {
    sortOrderEl.value = headerSortState.order;
  }

  applyFilter();
}

function getHeaderSortIcon(key) {
  if (headerSortState.key !== key) {
    return '<i class="fas fa-sort" style="font-size:12px;color:#9aa4b2;"></i>';
  }

  return headerSortState.order === 'asc'
    ? '<i class="fas fa-sort-up" style="font-size:12px;color:#1565c0;"></i>'
    : '<i class="fas fa-sort-down" style="font-size:12px;color:#1565c0;"></i>';
}

function getStatusRank(material) {
  const st = getStockStatus(material);
  if (st === 'critical') return 0;
  if (st === 'low') return 1;
  return 2;
}
/* ─────────────────────────────────────────
   자재 목록
───────────────────────────────────────── */
async function loadMaterials() {
  const tbody = document.getElementById('materialsTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;padding:40px;color:#888;">
          <i class="fas fa-spinner fa-spin"></i> 불러오는 중...
        </td>
      </tr>`;
  }

  try {
    allMaterials = await MaterialAPI.getAll();
    renderManufacturerTabs();
    await populateFilterCategory();
    applyFilter();
  } catch (e) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center;padding:40px;color:red;">
            <i class="fas fa-exclamation-circle"></i> 오류: ${e.message}
          </td>
        </tr>`;
    }
  }
}

/* ── 카테고리 필터 옵션 (알파벳/가나다 정렬) ── */
async function populateFilterCategory() {
  const sel = document.getElementById('filterCategory');
  if (!sel) return;

  const cats = [...new Set(allMaterials.map(m => m.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko'));

  sel.innerHTML = '<option value="">전체 카테고리</option>';
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    sel.appendChild(o);
  });
}

/* ─────────────────────────────────────────
   필터
───────────────────────────────────────── */
function applyFilter() {
  const kw = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const cat = document.getElementById('filterCategory')?.value || '';
  const st = document.getElementById('filterStatus')?.value || '';
  const sortBySelect = document.getElementById('sortBy')?.value || 'name';
  const sortOrderSelect = document.getElementById('sortOrder')?.value || 'asc';

  const activeSortKey = headerSortState.key || sortBySelect;
  const activeSortOrder = headerSortState.key ? headerSortState.order : sortOrderSelect;

  let list = [...allMaterials];

  if (selectedManufacturer) {
    list = list.filter(m => getManufacturerName(m) === selectedManufacturer);
  }

  if (kw) {
    list = list.filter(m =>
      (m.name || '').toLowerCase().includes(kw) ||
      (m.model || '').toLowerCase().includes(kw) ||
      (m.series || '').toLowerCase().includes(kw) ||
      (m.version || '').toLowerCase().includes(kw) ||
      (m.code || '').toLowerCase().includes(kw) ||
      (m.manager || '').toLowerCase().includes(kw)
    );
  }

  if (cat) list = list.filter(m => (m.category || '').includes(cat));
  if (st) list = list.filter(m => getStockStatus(m) === st);

  list.sort((a, b) => {
    let av = '';
    let bv = '';
    let result = 0;

    switch (activeSortKey) {
      case 'code':
        av = a.code || '';
        bv = b.code || '';
        result = String(av).localeCompare(String(bv), 'ko');
        break;

      case 'category':
        av = a.category || '';
        bv = b.category || '';
        result = String(av).localeCompare(String(bv), 'ko');
        break;

      case 'manager':
        av = a.manager || '';
        bv = b.manager || '';
        result = String(av).localeCompare(String(bv), 'ko');
        break;

      case 'stock':
        av = Number(a.current_stock || 0);
        bv = Number(b.current_stock || 0);
        result = av - bv;
        break;

      case 'updated':
        av = new Date(a.updated_at || a.created_at || 0).getTime();
        bv = new Date(b.updated_at || b.created_at || 0).getTime();
        result = av - bv;
        break;

      case 'status':
        av = getStatusRank(a);
        bv = getStatusRank(b);
        result = av - bv;
        break;

      case 'name':
      default:
        av = a.name || '';
        bv = b.name || '';
        result = String(av).localeCompare(String(bv), 'ko');
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

  filteredMaterials = list;
  renderTable(list);
}

/* ─────────────────────────────────────────
   테이블 렌더
───────────────────────────────────────── */
function renderTable(list) {
  const tbody = document.getElementById('materialsTableBody');
  const countEl = document.getElementById('totalCount');
  if (!tbody) return;

    const theadRow = document.querySelector('.table thead tr');
  if (theadRow) {
    theadRow.innerHTML = `
      <th style="width:44px;text-align:center">
        <input type="checkbox" id="checkAllMaterials" onchange="toggleSelectAll(this.checked)">
      </th>
      <th style="cursor:pointer;user-select:none" onclick="setHeaderSort('name')">
        <span style="display:inline-flex;align-items:center;gap:6px">
          자재명 ${getHeaderSortIcon('name')}
        </span>
      </th>
      <th>모델</th>
      <th>시리즈</th>
      <th>버전</th>
      <th style="cursor:pointer;user-select:none" onclick="setHeaderSort('category')">
        <span style="display:inline-flex;align-items:center;gap:6px">
          카테고리 ${getHeaderSortIcon('category')}
        </span>
      </th>
      <th>담당자</th>
      <th>재고</th>
      <th style="cursor:pointer;user-select:none" onclick="setHeaderSort('status')">
        <span style="display:inline-flex;align-items:center;gap:6px">
          상태 ${getHeaderSortIcon('status')}
        </span>
      </th>
      <th>작업</th>
    `;
  }

  if (countEl) countEl.textContent = `${list.length}건`;

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;padding:40px;color:#888;">
          <i class="fas fa-inbox"></i> 등록된 자재가 없습니다.
        </td>
      </tr>`;
    syncHeaderCheckbox();
    updateBulkActionBar();
    return;
  }

  tbody.innerHTML = list.map(m => {
    const st = getStockStatus(m);
    const checked = selectedMaterialIds.has(m.id) ? 'checked' : '';
    const badgeMap = {
      ok: '<span style="background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">정상</span>',
      low: '<span style="background:#fef9c3;color:#ca8a04;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">부족</span>',
      critical: '<span style="background:#fee2e2;color:#dc2626;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">재고없음</span>'
    };

    return `
      <tr>
        <td style="text-align:center">
          <input type="checkbox" ${checked} onchange="toggleMaterialSelection('${m.id}', this.checked)">
        </td>
        <td>
          <strong>${esc(m.name)}</strong>
          ${m.code ? `<div style="font-size:11px;color:#888;margin-top:3px">${esc(m.code)}</div>` : ''}
        </td>
        <td>${esc(m.model || '-')}</td>
        <td>${esc(m.series || '-')}</td>
        <td>${esc(m.version || '-')}</td>
        <td>${esc(m.category || '-')}</td>
        <td>${esc(m.manager || '-')}</td>
        <td style="text-align:center;">
          <strong>${m.current_stock ?? 0}</strong>
          <small style="color:#888;"> ${esc(m.unit || 'EA')}</small>
        </td>
        <td>${badgeMap[st] || badgeMap.ok}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline" onclick="showBarcode('${m.id}')" title="바코드">
              <i class="fas fa-barcode"></i>
            </button>
            <button class="btn btn-sm btn-primary" onclick="openModal('${m.id}')" title="수정">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteMaterial('${m.id}')" title="삭제">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  syncHeaderCheckbox();
  updateBulkActionBar();
}

function toggleMaterialSelection(id, checked) {
  if (checked) selectedMaterialIds.add(id);
  else selectedMaterialIds.delete(id);

  updateBulkActionBar();
  syncHeaderCheckbox();
}

function toggleSelectAll(checked) {
  filteredMaterials.forEach(m => {
    if (checked) selectedMaterialIds.add(m.id);
    else selectedMaterialIds.delete(m.id);
  });

  renderTable(filteredMaterials);
  updateBulkActionBar();
  syncHeaderCheckbox();
}

function clearSelection() {
  selectedMaterialIds.clear();
  renderTable(filteredMaterials);
  updateBulkActionBar();
  syncHeaderCheckbox();
}

function syncHeaderCheckbox() {
  const el = document.getElementById('checkAllMaterials');
  if (!el) return;

  if (!filteredMaterials.length) {
    el.checked = false;
    el.indeterminate = false;
    return;
  }

  const selectedInView = filteredMaterials.filter(m => selectedMaterialIds.has(m.id)).length;
  el.checked = selectedInView > 0 && selectedInView === filteredMaterials.length;
  el.indeterminate = selectedInView > 0 && selectedInView < filteredMaterials.length;
}

function updateBulkActionBar() {
  const bar = document.getElementById('bulkActionBar');
  const count = document.getElementById('selectedCount');
  if (!bar || !count) return;

  count.textContent = selectedMaterialIds.size;
  bar.style.display = selectedMaterialIds.size ? 'flex' : 'none';
}

async function loadBulkManagerOptions() {
  const sel = document.getElementById('bulkManager');
  if (!sel) return;

  try {
    const handlers = await HandlerAPI.getAll();
    sel.innerHTML = '<option value="">-- 선택 --</option>' +
      handlers.map(h => `<option value="${esc(h.name)}">${esc(h.name)}</option>`).join('');
  } catch (_) {}
}

function openBulkEditModal() {
  if (!selectedMaterialIds.size) {
    return showToast('수정할 자재를 먼저 선택하세요.', 'warning');
  }

  ['Series', 'Version', 'Category', 'Manager', 'Location', 'MinStock', 'Description'].forEach(key => {
    const check = document.getElementById(`bulkUse${key}`);
    if (check) check.checked = false;
  });

  document.getElementById('bulkSeries').value = '';
  document.getElementById('bulkVersion').value = '';
  document.getElementById('bulkCategory').value = '';
  document.getElementById('bulkManager').value = '';
  document.getElementById('bulkLocation').value = '';
  document.getElementById('bulkMinStock').value = '';
  document.getElementById('bulkDescription').value = '';

  openOverlay('bulkEditModal');
}

function closeBulkEditModal() {
  closeOverlay('bulkEditModal');
}

async function applyBulkEdit() {
  const ids = [...selectedMaterialIds];
  if (!ids.length) return showToast('선택된 자재가 없습니다.', 'warning');

  const useSeries = document.getElementById('bulkUseSeries').checked;
  const useVersion = document.getElementById('bulkUseVersion').checked;
  const useCategory = document.getElementById('bulkUseCategory').checked;
  const useManager = document.getElementById('bulkUseManager').checked;
  const useLocation = document.getElementById('bulkUseLocation').checked;
  const useMinStock = document.getElementById('bulkUseMinStock').checked;
  const useDescription = document.getElementById('bulkUseDescription').checked;

  if (![useSeries, useVersion, useCategory, useManager, useLocation, useMinStock, useDescription].some(Boolean)) {
    return showToast('수정할 항목을 하나 이상 체크하세요.', 'warning');
  }

  const values = {
    series: document.getElementById('bulkSeries').value.trim(),
    version: document.getElementById('bulkVersion').value.trim(),
    category: document.getElementById('bulkCategory').value.trim(),
    manager: document.getElementById('bulkManager').value,
    location: document.getElementById('bulkLocation').value.trim(),
    min_stock: parseInt(document.getElementById('bulkMinStock').value, 10) || 0,
    description: document.getElementById('bulkDescription').value.trim()
  };

  try {
    showToast(`${ids.length}건 수정 중...`, 'info');

    for (const id of ids) {
      const old = allMaterials.find(m => m.id === id);
      if (!old) continue;

      const payload = {
        ...old,
        series: useSeries ? values.series : old.series,
        version: useVersion ? values.version : old.version,
        category: useCategory ? values.category : old.category,
        manager: useManager ? values.manager : old.manager,
        location: useLocation ? values.location : old.location,
        min_stock: useMinStock ? values.min_stock : old.min_stock,
        description: useDescription ? values.description : old.description
      };

      await MaterialAPI.save(payload);
    }

    closeBulkEditModal();
    selectedMaterialIds.clear();
    await loadMaterials();
    showToast('선택 자재가 일괄 수정되었습니다.', 'success');
  } catch (e) {
    showToast('일괄 수정 실패: ' + e.message, 'error');
  }
}

/* ─────────────────────────────────────────
   카테고리 3단계 로드
───────────────────────────────────────── */
async function loadCatTree() {
  try {
    catTree = await CategoryAPI.getTree();

    catTree.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    catTree.forEach(l1 => {
      if (l1.children) {
        l1.children.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        l1.children.forEach(l2 => {
          if (l2.children) {
            l2.children.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
          }
        });
      }
    });

    const l1Sel = document.getElementById('catL1');
    if (!l1Sel) return;

    l1Sel.innerHTML = '<option value="">대분류 선택</option>';
    catTree.forEach(l1 => {
      const o = document.createElement('option');
      o.value = l1.id;
      o.textContent = l1.name;
      l1Sel.appendChild(o);
    });

    document.getElementById('catL2').innerHTML = '<option value="">중분류</option>';
    document.getElementById('catL2').disabled = true;
    document.getElementById('catL3').innerHTML = '<option value="">소분류</option>';
    document.getElementById('catL3').disabled = true;
    document.getElementById('matCategory').value = '';
  } catch (_) {}
}

function onCatL1Change() {
  const l1Id = document.getElementById('catL1').value;
  const l2Sel = document.getElementById('catL2');
  const l3Sel = document.getElementById('catL3');

  l2Sel.innerHTML = '<option value="">중분류 선택</option>';
  l3Sel.innerHTML = '<option value="">소분류</option>';
  l3Sel.disabled = true;
  document.getElementById('matCategory').value = '';

  if (!l1Id) {
    l2Sel.disabled = true;
    return;
  }

  const l1Node = catTree.find(x => x.id === l1Id);
  if (!l1Node?.children?.length) {
    l2Sel.disabled = true;
    document.getElementById('matCategory').value = l1Node?.name || '';
    return;
  }

  const sortedL2 = [...l1Node.children].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  l2Sel.disabled = false;
  sortedL2.forEach(l2 => {
    const o = document.createElement('option');
    o.value = l2.id;
    o.textContent = l2.name;
    l2Sel.appendChild(o);
  });
}

function onCatL2Change() {
  const l1Id = document.getElementById('catL1').value;
  const l2Id = document.getElementById('catL2').value;
  const l3Sel = document.getElementById('catL3');

  l3Sel.innerHTML = '<option value="">소분류 선택</option>';
  document.getElementById('matCategory').value = '';

  if (!l2Id) {
    l3Sel.disabled = true;
    return;
  }

  const l1Node = catTree.find(x => x.id === l1Id);
  const l2Node = l1Node?.children?.find(x => x.id === l2Id);

  if (!l2Node?.children?.length) {
    l3Sel.disabled = true;
    document.getElementById('matCategory').value = l2Node?.name || '';
    return;
  }

  l3Sel.disabled = false;
  l2Node.children.forEach(l3 => {
    const o = document.createElement('option');
    o.value = l3.id;
    o.textContent = l3.name;
    l3Sel.appendChild(o);
  });
}

function onCatL3Change() {
  const l1Id = document.getElementById('catL1').value;
  const l2Id = document.getElementById('catL2').value;
  const l3Id = document.getElementById('catL3').value;

  if (!l3Id) {
    document.getElementById('matCategory').value = '';
    return;
  }

  const l1Node = catTree.find(x => x.id === l1Id);
  const l2Node = l1Node?.children?.find(x => x.id === l2Id);
  const l3Node = l2Node?.children?.find(x => x.id === l3Id);

  document.getElementById('matCategory').value = l3Node?.name || '';
}

/* ─────────────────────────────────────────
   담당자 옵션
───────────────────────────────────────── */
async function loadHandlerOptions() {
  try {
    const sel = document.getElementById('matManager');
    if (!sel) return;

    const list = await HandlerAPI.getAll();
    sel.innerHTML = '<option value="">-- 선택 --</option>';

    list.filter(h => h.active !== false).forEach(h => {
      const o = document.createElement('option');
      o.value = h.name;
      o.textContent = h.name + (h.department ? ` (${h.department})` : '');
      sel.appendChild(o);
    });
  } catch (_) {}
}

/* ─────────────────────────────────────────
   수정 시 카테고리 복원
───────────────────────────────────────── */
function restoreCategory(catName) {
  if (!catName || !catTree.length) return;

  for (const l1 of catTree) {
    if (l1.name === catName) {
      document.getElementById('catL1').value = l1.id;
      onCatL1Change();
      document.getElementById('matCategory').value = catName;
      return;
    }

    for (const l2 of (l1.children || [])) {
      if (l2.name === catName) {
        document.getElementById('catL1').value = l1.id;
        onCatL1Change();

        setTimeout(() => {
          document.getElementById('catL2').value = l2.id;
          onCatL2Change();
          document.getElementById('matCategory').value = catName;
        }, 50);
        return;
      }

      for (const l3 of (l2.children || [])) {
        if (l3.name === catName) {
          document.getElementById('catL1').value = l1.id;
          onCatL1Change();

          setTimeout(() => {
            document.getElementById('catL2').value = l2.id;
            onCatL2Change();

            setTimeout(() => {
              document.getElementById('catL3').value = l3.id;
              onCatL3Change();
            }, 50);
          }, 50);
          return;
        }
      }
    }
  }
}

/* ─────────────────────────────────────────
   모달 열기
───────────────────────────────────────── */
async function openModal(id = null) {
  editingId = id;

  document.getElementById('matId').value = '';
  document.getElementById('matName').value = '';
  document.getElementById('matModel').value = '';
  document.getElementById('matSeries').value = '';
  document.getElementById('matVersion').value = '';
  document.getElementById('matMfgDate').value = '';
  document.getElementById('matStock').value = 0;
  document.getElementById('matMinStock').value = 0;
  document.getElementById('matUnit').value = 'EA';
  document.getElementById('matBarcode').value = '';
  document.getElementById('matNote').value = '';
  document.getElementById('matCategory').value = '';

  await loadCatTree();
  await loadHandlerOptions();

  if (id) {
    document.getElementById('modalTitle').innerHTML =
      '<i class="fas fa-edit"></i> 자재 수정';

    const m = allMaterials.find(x => x.id === id);
    if (m) {
      document.getElementById('matId').value = m.id || '';
      document.getElementById('matName').value = m.name || '';
      document.getElementById('matModel').value = m.model || '';
      document.getElementById('matSeries').value = m.series || '';
      document.getElementById('matVersion').value = m.version || '';
      document.getElementById('matMfgDate').value = m.manufacture_date || '';
      document.getElementById('matStock').value = m.current_stock ?? 0;
      document.getElementById('matMinStock').value = m.min_stock ?? 0;
      document.getElementById('matUnit').value = m.unit || 'EA';
      document.getElementById('matBarcode').value = m.barcode || '';
      document.getElementById('matNote').value = m.description || '';

      setTimeout(() => {
        restoreCategory(m.category);
        const ms = document.getElementById('matManager');
        if (ms) ms.value = m.manager || '';
      }, 200);
    }
  } else {
    document.getElementById('modalTitle').innerHTML =
      '<i class="fas fa-plus-circle"></i> 자재 등록';
  }

  document.getElementById('materialModal').classList.add('open');
}

/* ─────────────────────────────────────────
   모달 닫기
───────────────────────────────────────── */
function closeModal() {
  document.getElementById('materialModal').classList.remove('open');
  editingId = null;
}

/* ─────────────────────────────────────────
   바코드 자동생성
───────────────────────────────────────── */
function genBarcode() {
  const model = document.getElementById('matModel').value.trim();
  const series = document.getElementById('matSeries').value.trim();
  const version = document.getElementById('matVersion').value.trim();
  const mfg = document.getElementById('matMfgDate').value || '';
  const mmdd = mfg.length >= 10 ? mfg.slice(5, 7) + mfg.slice(8, 10) : '';

  document.getElementById('matBarcode').value =
    [model || 'MAT', series, version, mmdd]
      .filter(Boolean)
      .join('');
}

/* ─────────────────────────────────────────
   저장
───────────────────────────────────────── */
async function saveMaterial() {
  const name = document.getElementById('matName').value.trim();
  if (!name) {
    showToast('자재명을 입력해주세요.', 'warning');
    return;
  }

  const id = document.getElementById('matId').value || uuid();
  const model = document.getElementById('matModel').value.trim();
  const series = document.getElementById('matSeries').value.trim();
  const version = document.getElementById('matVersion').value.trim();
  const mfg = document.getElementById('matMfgDate').value || '';
  const barcode = document.getElementById('matBarcode').value.trim() || null;

  const code = [
    model || 'MAT',
    series || 'GEN',
    version || 'V1',
    new Date().toISOString().slice(2, 10).replace(/-/g, '')
  ].join('-');

  const mat = {
    id: id,
    code: code,
    name: name,
    model: model,
    series: series,
    version: version,
    manufacture_date: mfg || null,
    category: document.getElementById('matCategory').value,
    current_stock: parseInt(document.getElementById('matStock').value) || 0,
    min_stock: parseInt(document.getElementById('matMinStock').value) || 0,
    unit: document.getElementById('matUnit').value.trim() || 'EA',
    manager: document.getElementById('matManager').value,
    barcode: barcode,
    description: document.getElementById('matNote').value.trim(),
    status: 'active'
  };

  if (document.getElementById('matId').value) {
    const old = allMaterials.find(x => x.id === document.getElementById('matId').value);
    if (old?.code) mat.code = old.code;
  }

  try {
    await MaterialAPI.save(mat);
    showToast(editingId ? '수정되었습니다.' : '등록되었습니다.', 'success');
    closeModal();
    await loadMaterials();
  } catch (e) {
    console.error(e);
    showToast('저장 실패: ' + e.message, 'error');
  }
}

/* ─────────────────────────────────────────
   삭제
───────────────────────────────────────── */
async function deleteMaterial(id) {
  if (!confirm('이 자재를 삭제하시겠습니까?')) return;

  try {
    await MaterialAPI.delete(id);
    showToast('삭제되었습니다.', 'success');
    await loadMaterials();
  } catch (e) {
    showToast('삭제 실패: ' + e.message, 'error');
  }
}

/* ─────────────────────────────────────────
   바코드 미리보기
───────────────────────────────────────── */
function showBarcode(id) {
  const m = allMaterials.find(x => x.id === id);
  if (!m?.barcode) {
    showToast('등록된 바코드가 없습니다.', 'warning');
    return;
  }

  document.getElementById('bcMatName').textContent = m.name;
  document.getElementById('bcValue').textContent = m.barcode;

  try {
    JsBarcode('#bcSvg', m.barcode, {
      format: 'CODE128',
      width: 2,
      height: 65,
      displayValue: true,
      fontSize: 13
    });
  } catch (_) {}

  document.getElementById('barcodeModal').classList.add('open');
}

function closeBarcode() {
  document.getElementById('barcodeModal').classList.remove('open');
}

function printBarcode() {
  const svg = document.getElementById('bcSvg').outerHTML;
  const name = document.getElementById('bcMatName').textContent;
  const val = document.getElementById('bcValue').textContent;
  const w = window.open('', '_blank', 'width=420,height=320');

  w.document.write(`<!DOCTYPE html><html><head><title>바코드 인쇄</title>
    <style>body{text-align:center;font-family:sans-serif;padding:24px;}
    p{margin:6px 0;font-size:14px;}</style></head>
    <body><p><strong>${name}</strong></p>${svg}<p>${val}</p>
    <script>window.onload=()=>{window.print();window.close();}<\/script>
    </body></html>`);
  w.document.close();
}