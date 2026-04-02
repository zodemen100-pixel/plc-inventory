/* ===================================================
   materials.js  –  자재 관리 페이지
   =================================================== */

let allMaterials = [];
let editingId    = null;

/* ── 초기 로드 ── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadMaterials();
  await loadCategoryOptions();
  await loadHandlerOptions();

  document.getElementById('searchInput')
    .addEventListener('input', e => renderTable(filterMaterials(e.target.value)));
});

/* ── 자재 목록 불러오기 ── */
async function loadMaterials() {
  const tbody = document.getElementById('materialsTableBody');
  tbody.innerHTML = `<tr><td colspan="8" class="text-center">
    <i class="fas fa-spinner fa-spin"></i> 불러오는 중...</td></tr>`;
  try {
    allMaterials = await MaterialAPI.getAll();
    renderTable(allMaterials);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">
      <i class="fas fa-exclamation-circle"></i> 오류: ${e.message}</td></tr>`;
  }
}

/* ── 테이블 렌더링 ── */
function renderTable(list) {
  const tbody = document.getElementById('materialsTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">
      <i class="fas fa-inbox"></i> 등록된 자재가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(m => {
    const status = getStockStatus(m);
    return `
      <tr>
        <td><strong>${esc(m.name)}</strong></td>
        <td>${esc(m.model || '-')}</td>
        <td>${esc(m.series || '-')}</td>
        <td>${esc(m.version || '-')}</td>
        <td>${esc(m.category || '-')}</td>
        <td>${m.current_stock ?? 0} ${esc(m.unit || 'EA')}</td>
        <td>${statusBadgeHTML(status)}</td>
        <td>
          <div class="action-btns">
            <button class="btn btn-sm btn-outline" onclick="showBarcode('${m.id}')">
              <i class="fas fa-barcode"></i>
            </button>
            <button class="btn btn-sm btn-primary" onclick="openModal('${m.id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteMaterial('${m.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ── 검색 필터 ── */
function filterMaterials(kw) {
  if (!kw) return allMaterials;
  const q = kw.toLowerCase();
  return allMaterials.filter(m =>
    (m.name   || '').toLowerCase().includes(q) ||
    (m.model  || '').toLowerCase().includes(q) ||
    (m.series || '').toLowerCase().includes(q) ||
    (m.version|| '').toLowerCase().includes(q)
  );
}

/* ── 카테고리 옵션 ── */
async function loadCategoryOptions() {
  try {
    const sel = document.getElementById('matCategory');
    if (!sel) return;
    const tree = await CategoryAPI.getTree();
    sel.innerHTML = '<option value="">-- 선택 --</option>';
    tree.forEach(l1 => {
      const g1 = document.createElement('optgroup');
      g1.label = l1.name;
      (l1.children || []).forEach(l2 => {
        const g2 = document.createElement('optgroup');
        g2.label = '　' + l2.name;
        (l2.children || []).forEach(l3 => {
          const o = document.createElement('option');
          o.value = l3.name;
          o.textContent = '　　' + l3.name;
          g2.appendChild(o);
        });
        if (l2.children?.length) sel.appendChild(g2);
        else {
          const o = document.createElement('option');
          o.value = l2.name;
          o.textContent = '　' + l2.name;
          sel.appendChild(o);
        }
      });
      if (l1.children?.length) sel.appendChild(g1);
    });
  } catch (_) {}
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
  } catch (_) {}
}

/* ── 모달 열기 ── */
async function openModal(id = null) {
  editingId = id;
  document.getElementById('materialForm').reset();
  document.getElementById('matId').value = '';
  document.getElementById('matUnit').value = 'EA';
  document.getElementById('matStock').value = 0;
  document.getElementById('matMinStock').value = 0;

  await loadCategoryOptions();
  await loadHandlerOptions();

  if (id) {
    document.getElementById('modalTitle').innerHTML =
      '<i class="fas fa-edit"></i> 자재 수정';
    const m = allMaterials.find(x => x.id === id);
    if (m) fillForm(m);
  } else {
    document.getElementById('modalTitle').innerHTML =
      '<i class="fas fa-plus-circle"></i> 자재 등록';
  }

  document.getElementById('materialModal').classList.add('open');
}

/* ── 폼 채우기 ── */
function fillForm(m) {
  document.getElementById('matId').value          = m.id || '';
  document.getElementById('matName').value        = m.name || '';
  document.getElementById('matModel').value       = m.model || '';
  document.getElementById('matSeries').value      = m.series || '';
  document.getElementById('matVersion').value     = m.version || '';
  document.getElementById('matMfgDate').value     = m.manufacture_date || '';
  document.getElementById('matStock').value       = m.current_stock ?? 0;
  document.getElementById('matMinStock').value    = m.min_stock ?? 0;
  document.getElementById('matUnit').value        = m.unit || 'EA';
  document.getElementById('matBarcode').value     = m.barcode || '';
  document.getElementById('matNote').value        = m.description || '';

  // 카테고리 / 담당자는 옵션 로딩 후 지연 설정
  setTimeout(() => {
    const catSel = document.getElementById('matCategory');
    if (catSel) catSel.value = m.category || '';
    const mgrSel = document.getElementById('matManager');
    if (mgrSel) mgrSel.value = m.manager || '';
  }, 100);
}

/* ── 모달 닫기 ── */
function closeModal() {
  document.getElementById('materialModal').classList.remove('open');
  editingId = null;
}

/* ── 오버레이 클릭 닫기 ── */
function handleOverlayClick(e, id) {
  if (e.target.id === id) {
    document.getElementById(id).classList.remove('open');
  }
}

/* ── 바코드 자동생성 ── */
function genBarcode() {
  const model   = document.getElementById('matModel').value.trim();
  const series  = document.getElementById('matSeries').value.trim();
  const version = document.getElementById('matVersion').value.trim();
  const dateStr = document.getElementById('matMfgDate').value.replace(/-/g, '').slice(2);
  const rand    = String(Math.floor(Math.random() * 90) + 10);
  const parts   = [model || 'MAT', series, version, dateStr, rand]
                    .filter(Boolean).join('-');
  document.getElementById('matBarcode').value = parts;
}

/* ── 저장 ── */
async function saveMaterial() {
  const name = document.getElementById('matName').value.trim();
  if (!name) { showToast('자재명을 입력해주세요.', 'warning'); return; }

  const mat = {
    id             : document.getElementById('matId').value || undefined,
    name           : name,
    model          : document.getElementById('matModel').value.trim(),
    series         : document.getElementById('matSeries').value.trim(),
    version        : document.getElementById('matVersion').value.trim(),
    manufacture_date: document.getElementById('matMfgDate').value || null,
    category       : document.getElementById('matCategory').value,
    current_stock  : parseInt(document.getElementById('matStock').value) || 0,
    min_stock      : parseInt(document.getElementById('matMinStock').value) || 0,
    unit           : document.getElementById('matUnit').value.trim() || 'EA',
    manager        : document.getElementById('matManager').value,
    barcode        : document.getElementById('matBarcode').value.trim(),
    description    : document.getElementById('matNote').value.trim(),
    status         : 'active'
  };

  try {
    await MaterialAPI.save(mat);
    showToast(editingId ? '자재가 수정되었습니다.' : '자재가 등록되었습니다.', 'success');
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
  if (!m || !m.barcode) { showToast('등록된 바코드가 없습니다.', 'warning'); return; }

  document.getElementById('bcMatName').textContent = m.name;
  document.getElementById('bcValue').textContent   = m.barcode;

  try {
    JsBarcode('#bcSvg', m.barcode, {
      format : 'CODE128',
      width  : 2,
      height : 60,
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
  const svg  = document.getElementById('bcSvg').outerHTML;
  const name = document.getElementById('bcMatName').textContent;
  const val  = document.getElementById('bcValue').textContent;
  const w    = window.open('', '_blank', 'width=400,height=300');
  w.document.write(`<!DOCTYPE html><html><head><title>바코드 인쇄</title>
    <style>body{text-align:center;font-family:sans-serif;padding:20px;}
    p{margin:6px 0;font-size:14px;}</style></head>
    <body><p><strong>${name}</strong></p>${svg}<p>${val}</p>
    <script>window.onload=()=>{window.print();window.close();}<\/script>
    </body></html>`);
  w.document.close();
}
