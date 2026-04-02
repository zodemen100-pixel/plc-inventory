/* ===================================================
   materials.js
   =================================================== */

let allMaterials = [];
let editingId    = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadMaterials();
  document.getElementById('searchInput')
    .addEventListener('input', () => applyFilter());
});

/* ── 자재 목록 ── */
async function loadMaterials() {
  const tbody = document.getElementById('materialsTableBody');
  if (tbody) tbody.innerHTML =
    `<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> 불러오는 중...</td></tr>`;
  try {
    allMaterials = await MaterialAPI.getAll();
    await populateFilterCategory();
    applyFilter();
  } catch (e) {
    if (tbody) tbody.innerHTML =
      `<tr><td colspan="9" class="text-center" style="color:red;"><i class="fas fa-exclamation-circle"></i> 오류: ${e.message}</td></tr>`;
  }
}

/* ── 필터 ── */
function applyFilter() {
  const kw  = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const cat = document.getElementById('filterCategory')?.value || '';
  const st  = document.getElementById('filterStatus')?.value  || '';

  let list = allMaterials;
  if (kw)  list = list.filter(m =>
    (m.name||'').toLowerCase().includes(kw) ||
    (m.model||'').toLowerCase().includes(kw) ||
    (m.series||'').toLowerCase().includes(kw) ||
    (m.version||'').toLowerCase().includes(kw));
  if (cat) list = list.filter(m => (m.category||'') === cat);
  if (st)  list = list.filter(m => getStockStatus(m).key === st);
  renderTable(list);
}

/* ── 테이블 렌더 ── */
function renderTable(list) {
  const tbody   = document.getElementById('materialsTableBody');
  const countEl = document.getElementById('totalCount');
  if (!tbody) return;
  if (countEl) countEl.textContent = `${list.length}건`;

  if (!list.length) {
    tbody.innerHTML =
      `<tr><td colspan="9" class="text-center text-muted"><i class="fas fa-inbox"></i> 등록된 자재가 없습니다.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(m => {
    const s = getStockStatus(m);
    return `<tr>
      <td><strong>${esc(m.name)}</strong></td>
      <td>${esc(m.model   ||'-')}</td>
      <td>${esc(m.series  ||'-')}</td>
      <td>${esc(m.version ||'-')}</td>
      <td>${esc(m.category||'-')}</td>
      <td>${esc(m.manager ||'-')}</td>
      <td class="text-center"><strong>${m.current_stock??0}</strong>
        <small style="color:#888;"> ${esc(m.unit||'EA')}</small></td>
      <td>${statusBadgeHTML(s)}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline" onclick="showBarcode('${m.id}')" title="바코드">
            <i class="fas fa-barcode"></i></button>
          <button class="btn btn-sm btn-primary" onclick="openModal('${m.id}')" title="수정">
            <i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteMaterial('${m.id}')" title="삭제">
            <i class="fas fa-trash"></i></button>
        </div>
      </td></tr>`;
  }).join('');
}

/* ── 카테고리 필터 옵션 ── */
async function populateFilterCategory() {
  const sel = document.getElementById('filterCategory');
  if (!sel) return;
  const cats = [...new Set(allMaterials.map(m => m.category).filter(Boolean))];
  sel.innerHTML = '<option value="">전체 카테고리</option>';
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c; sel.appendChild(o);
  });
}

/* ── 모달 카테고리 ── */
async function loadCategoryOptions() {
  try {
    const sel = document.getElementById('matCategory');
    if (!sel) return;
    const tree = await CategoryAPI.getTree();
    sel.innerHTML = '<option value="">-- 선택 --</option>';
    tree.forEach(l1 => {
      (l1.children||[]).forEach(l2 => {
        (l2.children||[]).forEach(l3 => {
          const o = document.createElement('option');
          o.value = l3.name;
          o.textContent = `${l1.name} > ${l2.name} > ${l3.name}`;
          sel.appendChild(o);
        });
        if (!(l2.children?.length)) {
          const o = document.createElement('option');
          o.value = l2.name;
          o.textContent = `${l1.name} > ${l2.name}`;
          sel.appendChild(o);
        }
      });
      if (!(l1.children?.length)) {
        const o = document.createElement('option');
        o.value = l1.name; o.textContent = l1.name; sel.appendChild(o);
      }
    });
  } catch(_) {}
}

/* ── 담당자 옵션 ── */
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
  } catch(_) {}
}

/* ── 모달 열기 ── */
async function openModal(id = null) {
  editingId = id;

  // 폼 초기화
  document.getElementById('matId').value       = '';
  document.getElementById('matName').value     = '';
  document.getElementById('matModel').value    = '';
  document.getElementById('matSeries').value   = '';
  document.getElementById('matVersion').value  = '';
  document.getElementById('matMfgDate').value  = '';
  document.getElementById('matStock').value    = 0;
  document.getElementById('matMinStock').value = 0;
  document.getElementById('matUnit').value     = 'EA';
  document.getElementById('matBarcode').value  = '';
  document.getElementById('matNote').value     = '';

  await loadCategoryOptions();
  await loadHandlerOptions();

  if (id) {
    document.getElementById('modalTitle').innerHTML =
      '<i class="fas fa-edit"></i> 자재 수정';
    const m = allMaterials.find(x => x.id === id);
    if (m) {
      document.getElementById('matId').value       = m.id || '';
      document.getElementById('matName').value     = m.name || '';
      document.getElementById('matModel').value    = m.model || '';
      document.getElementById('matSeries').value   = m.series || '';
      document.getElementById('matVersion').value  = m.version || '';
      document.getElementById('matMfgDate').value  = m.manufacture_date || '';
      document.getElementById('matStock').value    = m.current_stock ?? 0;
      document.getElementById('matMinStock').value = m.min_stock ?? 0;
      document.getElementById('matUnit').value     = m.unit || 'EA';
      document.getElementById('matBarcode').value  = m.barcode || '';
      document.getElementById('matNote').value     = m.description || '';
      setTimeout(() => {
        const cs = document.getElementById('matCategory');
        if (cs) cs.value = m.category || '';
        const ms = document.getElementById('matManager');
        if (ms) ms.value = m.manager || '';
      }, 150);
    }
  } else {
    document.getElementById('modalTitle').innerHTML =
      '<i class="fas fa-plus-circle"></i> 자재 등록';
  }

  document.getElementById('materialModal').classList.add('open');
}

/* ── 모달 닫기 ── */
function closeModal() {
  document.getElementById('materialModal').classList.remove('open');
  editingId = null;
}

/* ── 오버레이 클릭 닫기 ── */
function handleOverlayClick(e, id) {
  if (e.target.id === id)
    document.getElementById(id).classList.remove('open');
}

/* ── 바코드 자동생성 ── */
function genBarcode() {
  const model   = document.getElementById('matModel').value.trim();
  const series  = document.getElementById('matSeries').value.trim();
  const version = document.getElementById('matVersion').value.trim();
  const dateStr = (document.getElementById('matMfgDate').value||'').replace(/-/g,'').slice(2);
  const rand    = String(Math.floor(Math.random()*90)+10);
  document.getElementById('matBarcode').value =
    [model||'MAT', series, version, dateStr, rand].filter(Boolean).join('-');
}

/* ── 저장 ── */
async function saveMaterial() {
  const name = document.getElementById('matName').value.trim();
  if (!name) { showToast('자재명을 입력해주세요.', 'warning'); return; }

  const mat = {
    id              : document.getElementById('matId').value || undefined,
    name            : name,
    model           : document.getElementById('matModel').value.trim(),
    series          : document.getElementById('matSeries').value.trim(),
    version         : document.getElementById('matVersion').value.trim(),
    manufacture_date: document.getElementById('matMfgDate').value || null,
    category        : document.getElementById('matCategory').value,
    current_stock   : parseInt(document.getElementById('matStock').value)    || 0,
    min_stock       : parseInt(document.getElementById('matMinStock').value)  || 0,
    unit            : document.getElementById('matUnit').value.trim()         || 'EA',
    manager         : document.getElementById('matManager').value,
    barcode         : document.getElementById('matBarcode').value.trim(),
    description     : document.getElementById('matNote').value.trim(),
    status          : 'active'
  };

  try {
    await MaterialAPI.save(mat);
    showToast(editingId ? '수정되었습니다.' : '등록되었습니다.', 'success');
    closeModal();
    await loadMaterials();
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  }
}

/* ── 삭제 ── */
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

/* ── 바코드 미리보기 ── */
function showBarcode(id) {
  const m = allMaterials.find(x => x.id === id);
  if (!m?.barcode) { showToast('등록된 바코드가 없습니다.', 'warning'); return; }
  document.getElementById('bcMatName').textContent = m.name;
  document.getElementById('bcValue').textContent   = m.barcode;
  try {
    JsBarcode('#bcSvg', m.barcode, {
      format:'CODE128', width:2, height:65, displayValue:true, fontSize:13
    });
  } catch(_) {}
  document.getElementById('barcodeModal').classList.add('open');
}

function closeBarcode() {
  document.getElementById('barcodeModal').classList.remove('open');
}

function printBarcode() {
  const svg  = document.getElementById('bcSvg').outerHTML;
  const name = document.getElementById('bcMatName').textContent;
  const val  = document.getElementById('bcValue').textContent;
  const w    = window.open('','_blank','width=420,height=320');
  w.document.write(`<!DOCTYPE html><html><head><title>바코드 인쇄</title>
    <style>body{text-align:center;font-family:sans-serif;padding:24px;}p{margin:6px 0;font-size:14px;}</style></head>
    <body><p><strong>${name}</strong></p>${svg}<p>${val}</p>
    <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
  w.document.close();
}
