/* ===================================================
   materials.js
   =================================================== */

let allMaterials = [];
let editingId    = null;
let catTree      = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadMaterials();
  document.getElementById('searchInput')
    .addEventListener('input', () => applyFilter());
});

/* ── 자재 목록 ── */
async function loadMaterials() {
  const tbody = document.getElementById('materialsTableBody');
  if (tbody) tbody.innerHTML =
    `<tr><td colspan="9" style="text-align:center;padding:40px;color:#888;">
      <i class="fas fa-spinner fa-spin"></i> 불러오는 중...</td></tr>`;
  try {
    allMaterials = await MaterialAPI.getAll();
    await populateFilterCategory();
    applyFilter();
  } catch (e) {
    if (tbody) tbody.innerHTML =
      `<tr><td colspan="9" style="text-align:center;padding:40px;color:red;">
        <i class="fas fa-exclamation-circle"></i> 오류: ${e.message}</td></tr>`;
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
    o.value = c; o.textContent = c; sel.appendChild(o);
  });
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
  if (cat) list = list.filter(m => (m.category||'').includes(cat));
  if (st)  list = list.filter(m => getStockStatus(m) === st);
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
      `<tr><td colspan="9" style="text-align:center;padding:40px;color:#888;">
        <i class="fas fa-inbox"></i> 등록된 자재가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(m => {
    const st = getStockStatus(m);
    const badgeMap = {
      ok:       '<span style="background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">정상</span>',
      low:      '<span style="background:#fef9c3;color:#ca8a04;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">부족</span>',
      critical: '<span style="background:#fee2e2;color:#dc2626;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">재고없음</span>'
    };
    return `<tr>
      <td><strong>${esc(m.name)}</strong></td>
      <td>${esc(m.model   ||'-')}</td>
      <td>${esc(m.series  ||'-')}</td>
      <td>${esc(m.version ||'-')}</td>
      <td>${esc(m.category||'-')}</td>
      <td>${esc(m.manager ||'-')}</td>
      <td style="text-align:center;">
        <strong>${m.current_stock??0}</strong>
        <small style="color:#888;"> ${esc(m.unit||'EA')}</small>
      </td>
      <td>${badgeMap[st] || badgeMap.ok}</td>
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

/* ── 카테고리 3단계 로드 ── */
async function loadCatTree() {
  try {
    catTree = await CategoryAPI.getTree();

    // 전체 트리 가나다 정렬
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
      o.value = l1.id; o.textContent = l1.name;
      l1Sel.appendChild(o);
    });
    document.getElementById('catL2').innerHTML = '<option value="">중분류</option>';
    document.getElementById('catL2').disabled = true;
    document.getElementById('catL3').innerHTML = '<option value="">소분류</option>';
    document.getElementById('catL3').disabled = true;
    document.getElementById('matCategory').value = '';
  } catch(_) {}
}

function onCatL1Change() {
  const l1Id  = document.getElementById('catL1').value;
  const l2Sel = document.getElementById('catL2');
  const l3Sel = document.getElementById('catL3');

  l2Sel.innerHTML = '<option value="">중분류 선택</option>';
  l3Sel.innerHTML = '<option value="">소분류</option>';
  l3Sel.disabled  = true;
  document.getElementById('matCategory').value = '';

  if (!l1Id) { l2Sel.disabled = true; return; }

  const l1Node = catTree.find(x => x.id === l1Id);
  if (!l1Node?.children?.length) {
    l2Sel.disabled = true;
    document.getElementById('matCategory').value = l1Node?.name || '';
    return;
  }

  // 가나다 정렬 후 추가
  const sortedL2 = [...l1Node.children].sort((a, b) =>
    a.name.localeCompare(b.name, 'ko'));

  l2Sel.disabled = false;
  sortedL2.forEach(l2 => {
    const o = document.createElement('option');
    o.value = l2.id; o.textContent = l2.name;
    l2Sel.appendChild(o);
  });
}

function onCatL2Change() {
  const l1Id  = document.getElementById('catL1').value;
  const l2Id  = document.getElementById('catL2').value;
  const l3Sel = document.getElementById('catL3');

  l3Sel.innerHTML = '<option value="">소분류 선택</option>';
  document.getElementById('matCategory').value = '';

  if (!l2Id) { l3Sel.disabled = true; return; }

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
    o.value = l3.id; o.textContent = l3.name;
    l3Sel.appendChild(o);
  });
}

function onCatL3Change() {
  const l1Id = document.getElementById('catL1').value;
  const l2Id = document.getElementById('catL2').value;
  const l3Id = document.getElementById('catL3').value;
  if (!l3Id) { document.getElementById('matCategory').value = ''; return; }
  const l1Node = catTree.find(x => x.id === l1Id);
  const l2Node = l1Node?.children?.find(x => x.id === l2Id);
  const l3Node = l2Node?.children?.find(x => x.id === l3Id);
  document.getElementById('matCategory').value = l3Node?.name || '';
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

/* ── 수정 시 카테고리 복원 ── */
function restoreCategory(catName) {
  if (!catName || !catTree.length) return;
  for (const l1 of catTree) {
    if (l1.name === catName) {
      document.getElementById('catL1').value = l1.id;
      onCatL1Change();
      document.getElementById('matCategory').value = catName;
      return;
    }
    for (const l2 of (l1.children||[])) {
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
      for (const l3 of (l2.children||[])) {
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
  document.getElementById('matCategory').value = '';

  await loadCatTree();
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

/* ── 모달 닫기 ── */
function closeModal() {
  document.getElementById('materialModal').classList.remove('open');
  editingId = null;
}

/* ── 바코드 자동생성 ── */
function genBarcode() {
  const model   = document.getElementById('matModel').value.trim();
  const series  = document.getElementById('matSeries').value.trim();
  const version = document.getElementById('matVersion').value.trim();
  const mfg     = document.getElementById('matMfgDate').value || '';

  // 제조일자에서 월일만 추출 (예: 2024-03-15 → 0315)
  const mmdd    = mfg.length >= 10 ? mfg.slice(5,7) + mfg.slice(8,10) : '';

  document.getElementById('matBarcode').value =
    [model || 'MAT', series, version, mmdd]
      .filter(Boolean)
      .join(''); // ← 여기 변경!
}

/* ── 저장 ── */
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
  const barcode = document.getElementById('matBarcode').value.trim();

  // code 자동 생성
  // 예: MAT-PLC-S7-250402
  const code = [
    model || 'MAT',
    series || 'GEN',
    version || 'V1',
    new Date().toISOString().slice(2, 10).replace(/-/g, '')
  ].join('-');

  const mat = {
    id: id,
    code: code, // 🔥 반드시 포함
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

  // 수정일 때는 기존 code 유지
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
    <style>body{text-align:center;font-family:sans-serif;padding:24px;}
    p{margin:6px 0;font-size:14px;}</style></head>
    <body><p><strong>${name}</strong></p>${svg}<p>${val}</p>
    <script>window.onload=()=>{window.print();window.close();}<\/script>
    </body></html>`);
  w.document.close();
}
