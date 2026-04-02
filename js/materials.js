/* =====================================================
   materials.js
===================================================== */
let _allMaterials = [];
let _deleteTargetId = null;

/* ── 초기화 ── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadMaterials();
  await initCategorySelects();
  bindModalOverlayClose(['materialModal', 'deleteModal']);
  document.getElementById('searchInput')?.addEventListener('input', renderTable);
  document.getElementById('filterCategory')?.addEventListener('change', renderTable);
});

/* ── 자재 목록 로드 ── */
async function loadMaterials() {
  const tbody = document.getElementById('materialsBody');
  tbody.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> 로딩중...</td></tr>';
  try {
    _allMaterials = await MaterialAPI.getAll();
    renderTable();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">오류: ${e.message}</td></tr>`;
  }
}

/* ── 테이블 렌더링 ── */
function renderTable() {
  const keyword = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const catFilter = document.getElementById('filterCategory')?.value || '';
  const tbody = document.getElementById('materialsBody');

  let list = _allMaterials.filter(m => {
    const matchKw = !keyword ||
      (m.name || '').toLowerCase().includes(keyword) ||
      (m.model || '').toLowerCase().includes(keyword) ||
      (m.code || '').toLowerCase().includes(keyword);
    const matchCat = !catFilter || (m.category || '').includes(catFilter);
    return matchKw && matchCat;
  });

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding:40px;color:#aaa"><i class="fas fa-box-open" style="font-size:2rem;display:block;margin-bottom:8px"></i>등록된 자재가 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(m => {
    const st = getStockStatus(m);
    return `<tr>
      <td><code style="font-size:.75rem;background:#f0f2f5;padding:2px 6px;border-radius:4px">${esc(m.barcode || m.code || '-')}</code></td>
      <td><strong>${esc(m.name)}</strong>${m.version ? `<br><span style="font-size:.72rem;color:#888">v${esc(m.version)}</span>` : ''}</td>
      <td><span style="font-size:.8rem">${esc(m.model || '-')}</span></td>
      <td><span style="font-size:.75rem;color:#666">${esc(m.category || '-')}</span></td>
      <td>${esc(m.location || '-')}</td>
      <td><strong>${m.current_stock ?? 0}</strong> <span style="font-size:.75rem;color:#888">${esc(m.unit || 'EA')}</span></td>
      <td>${m.min_stock ?? 0} ${esc(m.unit || 'EA')}</td>
      <td>${statusBadgeHTML(st)}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-outline btn-sm" onclick="openEditModal('${m.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${m.id}','${esc(m.name)}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ── 카테고리 셀렉트 초기화 ── */
async function initCategorySelects() {
  try {
    const l1List = await CategoryAPI.getLevel1();
    const sel = document.getElementById('catL1');
    if (!sel) return;
    sel.innerHTML = '<option value="">제조사 선택</option>' +
      l1List.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

    // 필터 셀렉트도 채우기
    const filterSel = document.getElementById('filterCategory');
    if (filterSel) {
      filterSel.innerHTML = '<option value="">전체 카테고리</option>' +
        l1List.map(c => `<option value="${c.name}">${esc(c.name)}</option>`).join('');
    }
  } catch (e) { console.error('카테고리 로드 오류:', e); }
}

async function onCatL1Change() {
  const l1Val = document.getElementById('catL1').value;
  const l2Sel = document.getElementById('catL2');
  const l3Sel = document.getElementById('catL3');
  l2Sel.innerHTML = '<option value="">유형 선택</option>';
  l3Sel.innerHTML = '<option value="">모델 선택</option>';
  l2Sel.disabled = true; l3Sel.disabled = true;
  updateCatPreview();
  if (!l1Val) return;
  const children = await CategoryAPI.getChildren(l1Val);
  l2Sel.innerHTML = '<option value="">유형 선택</option>' +
    children.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  l2Sel.disabled = false;
}

async function onCatL2Change() {
  const l2Val = document.getElementById('catL2').value;
  const l3Sel = document.getElementById('catL3');
  l3Sel.innerHTML = '<option value="">모델 선택</option>';
  l3Sel.disabled = true;
  updateCatPreview();
  if (!l2Val) return;
  const children = await CategoryAPI.getChildren(l2Val);
  l3Sel.innerHTML = '<option value="">모델 선택</option>' +
    children.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  l3Sel.disabled = false;
}

async function updateCatPreview() {
  const preview = document.getElementById('catPreview');
  if (!preview) return;
  const l1id = document.getElementById('catL1')?.value;
  const l2id = document.getElementById('catL2')?.value;
  const l3id = document.getElementById('catL3')?.value;
  const parts = [];
  if (l1id) { const c = await CategoryAPI.getById(l1id); if (c) parts.push(c.name); }
  if (l2id) { const c = await CategoryAPI.getById(l2id); if (c) parts.push(c.name); }
  if (l3id) { const c = await CategoryAPI.getById(l3id); if (c) parts.push(c.name); }
  preview.textContent = parts.length ? '선택: ' + parts.join(' > ') : '';
}

/* ── 모달 열기 ── */
function openAddModal() {
  document.getElementById('matId').value = '';
  document.getElementById('matCode').value = '';
  document.getElementById('matName').value = '';
  document.getElementById('matModel').value = '';
  document.getElementById('matVersion').value = '';
  document.getElementById('matLocation').value = '';
  document.getElementById('matUnit').value = 'EA';
  document.getElementById('matStock').value = '0';
  document.getElementById('matMinStock').value = '1';
  document.getElementById('matMfgDate').value = '';
  document.getElementById('matManager').value = '';
  document.getElementById('matBarcode').value = '';
  document.getElementById('matNote').value = '';
  document.getElementById('barcodePreview').innerHTML = '';
  document.getElementById('catPreview').textContent = '';
  document.getElementById('catL1').value = '';
  document.getElementById('catL2').innerHTML = '<option value="">유형 선택</option>';
  document.getElementById('catL2').disabled = true;
  document.getElementById('catL3').innerHTML = '<option value="">모델 선택</option>';
  document.getElementById('catL3').disabled = true;
  document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus"></i> 자재 등록';
  openOverlay('materialModal');
}

async function openEditModal(id) {
  const m = await MaterialAPI.getById(id);
  if (!m) return showToast('자재를 찾을 수 없습니다', 'error');
  document.getElementById('matId').value = m.id;
  document.getElementById('matCode').value = m.code || '';
  document.getElementById('matName').value = m.name || '';
  document.getElementById('matModel').value = m.model || '';
  document.getElementById('matVersion').value = m.version || '';
  document.getElementById('matLocation').value = m.location || '';
  document.getElementById('matUnit').value = m.unit || 'EA';
  document.getElementById('matStock').value = m.current_stock ?? 0;
  document.getElementById('matMinStock').value = m.min_stock ?? 1;
  document.getElementById('matMfgDate').value = m.manufacture_date || '';
  document.getElementById('matManager').value = m.manager || '';
  document.getElementById('matBarcode').value = m.barcode || '';
  document.getElementById('matNote').value = m.description || '';
  document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> 자재 수정';

  // 카테고리 복원
  if (m.cat_level1) {
    document.getElementById('catL1').value = m.cat_level1;
    await onCatL1Change();
    if (m.cat_level2) {
      document.getElementById('catL2').value = m.cat_level2;
      await onCatL2Change();
      if (m.cat_level3) document.getElementById('catL3').value = m.cat_level3;
    }
  }
  await updateCatPreview();

  // 바코드 미리보기
  if (m.barcode) renderBarcodePreview(m.barcode);
  openOverlay('materialModal');
}

/* ── 바코드 생성 ── */
function generateBarcode() {
  const model = (document.getElementById('matModel').value || 'MAT').replace(/[^a-zA-Z0-9가-힣]/g, '');
  const version = (document.getElementById('matVersion').value || '').replace(/[^a-zA-Z0-9]/g, '');
  const mfgDate = (document.getElementById('matMfgDate').value || '').replace(/-/g, '');
  const sec = new Date().getSeconds().toString().padStart(2, '0');
  const rand = Math.floor(Math.random() * 90 + 10).toString();
  const bc = `${model}${version}${mfgDate}-${sec}${rand}`.toUpperCase().substring(0, 40);
  document.getElementById('matBarcode').value = bc;
  renderBarcodePreview(bc);
}

function renderBarcodePreview(bc) {
  const wrap = document.getElementById('barcodePreview');
  if (!bc) { wrap.innerHTML = ''; return; }
  try {
    wrap.innerHTML = '<svg id="bcSvg"></svg>';
    JsBarcode('#bcSvg', bc, {
      format: 'CODE128', width: 3, height: 80,
      displayValue: true, fontSize: 13, margin: 15,
      lineColor: '#1a1a2e'
    });
  } catch (e) { wrap.innerHTML = `<span style="color:red;font-size:.8rem">바코드 생성 오류: ${e.message}</span>`; }
}

/* ── 자재 저장 ── */
async function saveMaterial() {
  const name = document.getElementById('matName').value.trim();
  if (!name) return showToast('자재명을 입력하세요', 'error');

  const l1id = document.getElementById('catL1').value;
  const l2id = document.getElementById('catL2').value;
  const l3id = document.getElementById('catL3').value;

  const l1 = l1id ? await CategoryAPI.getById(l1id) : null;
  const l2 = l2id ? await CategoryAPI.getById(l2id) : null;
  const l3 = l3id ? await CategoryAPI.getById(l3id) : null;
  const catPath = [l1?.name, l2?.name, l3?.name].filter(Boolean).join(' > ');

  const id = document.getElementById('matId').value || uuid();
  const mat = {
    id,
    code: document.getElementById('matCode').value.trim() || id.substring(0, 8).toUpperCase(),
    name,
    model: document.getElementById('matModel').value.trim(),
    version: document.getElementById('matVersion').value.trim(),
    category: catPath || '미분류',
    cat_level1: l1id || null,
    cat_level2: l2id || null,
    cat_level3: l3id || null,
    location: document.getElementById('matLocation').value.trim(),
    unit: document.getElementById('matUnit').value,
    current_stock: parseInt(document.getElementById('matStock').value) || 0,
    min_stock: parseInt(document.getElementById('matMinStock').value) || 1,
    manufacture_date: document.getElementById('matMfgDate').value || null,
    manager: document.getElementById('matManager').value.trim(),
    barcode: document.getElementById('matBarcode').value.trim(),
    description: document.getElementById('matNote').value.trim(),
    status: 'active'
  };

  try {
    await MaterialAPI.save(mat);
    showToast('저장되었습니다', 'success');
    closeOverlay('materialModal');
    await loadMaterials();
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  }
}

/* ── 삭제 ── */
function openDeleteModal(id, name) {
  _deleteTargetId = id;
  document.getElementById('deleteMsg').textContent = `"${name}" 을(를) 삭제하시겠습니까?`;
  openOverlay('deleteModal');
}

async function confirmDelete() {
  if (!_deleteTargetId) return;
  try {
    await MaterialAPI.delete(_deleteTargetId);
    showToast('삭제되었습니다', 'success');
    closeOverlay('deleteModal');
    await loadMaterials();
  } catch (e) {
    showToast('삭제 실패: ' + e.message, 'error');
  }
}
