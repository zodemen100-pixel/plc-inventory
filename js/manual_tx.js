/* =====================================================
   manual_tx.js - 입출고 수동 등록
   카테고리 + 검색 필터 개선판
===================================================== */

let _manualTxList = [];
let _manualMaterials = [];

function openManualTxModal() {
  const existing = document.getElementById('manualTxModal');
  if (existing) existing.remove();

  _manualTxList = [];

  const modal = document.createElement('div');
  modal.id = 'manualTxModal';
  modal.className = 'modal-overlay open';
  modal.style.zIndex = '3000';
  modal.innerHTML = `
    <div class="modal" style="max-width:760px">
      <div class="modal-header">
        <h3><i class="fas fa-edit"></i> 입출고 수동 등록</h3>
        <button class="modal-close" onclick="document.getElementById('manualTxModal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <!-- 담당자 -->
        <div class="form-group">
          <label>담당자 <span class="required">*</span></label>
          <select id="manualHandler" class="form-control">
            <option value="">-- 담당자 선택 --</option>
          </select>
        </div>

        <!-- 자재 추가 폼 -->
        <div style="background:#f8f9fa;border-radius:10px;padding:14px;margin-bottom:14px">
          <div style="font-size:.9rem;font-weight:700;margin-bottom:12px;color:#1a1a2e">
            <i class="fas fa-plus-circle" style="color:var(--success)"></i> 자재 추가
          </div>

          <div class="form-row">
            <div class="form-group" style="margin-bottom:8px">
              <label style="font-size:.78rem">카테고리</label>
              <select id="manualCategory" class="form-control" onchange="filterManualMaterials()">
                <option value="">-- 전체 카테고리 --</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:8px">
              <label style="font-size:.78rem">자재 검색</label>
              <input
                type="text"
                id="manualSearch"
                class="form-control"
                placeholder="자재명 / 모델 / 코드 검색"
                oninput="filterManualMaterials()"
              >
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="margin-bottom:8px">
              <label style="font-size:.78rem">자재 선택 <span class="required">*</span></label>
              <select id="manualMatSel" class="form-control" onchange="onManualMatChange()">
                <option value="">-- 자재 선택 --</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:8px">
              <label style="font-size:.78rem">구분 <span class="required">*</span></label>
              <select id="manualType" class="form-control">
                <option value="in">입고</option>
                <option value="out">출고</option>
              </select>
            </div>
          </div>

          <div id="manualSelectedInfo"
               style="display:none;margin-bottom:10px;padding:10px;border:1px solid #e9ecef;border-radius:8px;background:#fff">
          </div>

          <div class="form-row">
            <div class="form-group" style="margin-bottom:8px">
              <label style="font-size:.78rem">수량 <span class="required">*</span></label>
              <input type="number" id="manualQty" class="form-control" value="1" min="1">
            </div>
            <div class="form-group" style="margin-bottom:8px">
              <label style="font-size:.78rem">현재 재고</label>
              <input type="text" id="manualCurStock" class="form-control" disabled
                style="background:#f5f5f5;color:#888">
            </div>
          </div>

          <div class="form-group" style="margin-bottom:10px">
            <label style="font-size:.78rem">비고</label>
            <input type="text" id="manualNote" class="form-control" placeholder="메모 (선택)">
          </div>

          <button class="btn btn-success btn-sm" onclick="addManualTxItem()" style="width:100%">
            <i class="fas fa-plus"></i> 목록에 추가
          </button>
        </div>

        <!-- 추가된 목록 -->
        <div>
          <div style="font-size:.85rem;font-weight:700;margin-bottom:8px;color:#1a1a2e">
            <i class="fas fa-list"></i> 처리 목록
            <span id="manualTxCount" style="background:#e9ecef;padding:2px 8px;border-radius:10px;font-size:.75rem;margin-left:6px">0개</span>
          </div>
          <div id="manualTxListWrap" style="min-height:60px;border:1px solid #e9ecef;border-radius:8px;padding:8px">
            <div style="text-align:center;padding:20px;color:#aaa;font-size:.82rem">
              위에서 자재를 추가하세요
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-outline" onclick="document.getElementById('manualTxModal').remove()">취소</button>
        <button class="btn btn-primary" onclick="submitManualTx()">
          <i class="fas fa-save"></i> 일괄 처리
        </button>
      </div>
    </div>`;

  let _mbg = false;
  modal.addEventListener('mousedown', e => { _mbg = e.target === modal; });
  modal.addEventListener('click', e => {
    if (e.target === modal && _mbg) modal.remove();
    _mbg = false;
  });

  document.body.appendChild(modal);

  Promise.all([HandlerAPI.getAll(), MaterialAPI.getAll()]).then(([handlers, materials]) => {
    const hSel = document.getElementById('manualHandler');
    if (hSel) {
      hSel.innerHTML =
        '<option value="">-- 담당자 선택 --</option>' +
        handlers.map(h =>
          `<option value="${esc(h.name)}">${esc(h.name)}${h.department ? ' (' + esc(h.department) + ')' : ''}</option>`
        ).join('');
    }

    _manualMaterials = materials || [];

    const catSel = document.getElementById('manualCategory');
    if (catSel) {
      const categories = [...new Set(_manualMaterials.map(m => (m.category || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'ko'));

      catSel.innerHTML =
        '<option value="">-- 전체 카테고리 --</option>' +
        categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    }

    filterManualMaterials();

    const last = localStorage.getItem('lastHandler');
    if (last && hSel) hSel.value = last;
  });
}

function filterManualMaterials() {
  const cat = (document.getElementById('manualCategory')?.value || '').trim();
  const kw = (document.getElementById('manualSearch')?.value || '').trim().toLowerCase();
  const mSel = document.getElementById('manualMatSel');
  if (!mSel) return;

  let list = [..._manualMaterials];

  if (cat) {
    list = list.filter(m => (m.category || '').trim() === cat);
  }

  if (kw) {
    list = list.filter(m =>
      (m.name || '').toLowerCase().includes(kw) ||
      (m.model || '').toLowerCase().includes(kw) ||
      (m.code || '').toLowerCase().includes(kw) ||
      (m.series || '').toLowerCase().includes(kw) ||
      (m.version || '').toLowerCase().includes(kw)
    );
  }

  mSel.innerHTML =
  '<option value="">-- 자재 선택 --</option>' +
  list.map(m => {
    const manufactureYm = m.manufacture_date
      ? String(m.manufacture_date).slice(0, 7).replace('-', '.')
      : '-';

    return `
      <option value="${m.id}">
        ${esc(m.name)}
        ${m.model ? ' / ' + esc(m.model) : ' / -'}
        / ${esc(m.series || '-')}
        / ${esc(m.version || '-')}
        / ${esc(manufactureYm)}
      </option>
    `;
  }).join('');

  document.getElementById('manualCurStock').value = '';
  const info = document.getElementById('manualSelectedInfo');
  if (info) {
    info.style.display = 'none';
    info.innerHTML = '';
  }
}

function onManualMatChange() {
  const id = document.getElementById('manualMatSel')?.value;
  const mat = _manualMaterials.find(m => m.id === id);

  const stockEl = document.getElementById('manualCurStock');
  if (stockEl) {
    stockEl.value = mat ? `${mat.current_stock} ${mat.unit || 'EA'}` : '';
  }

  const info = document.getElementById('manualSelectedInfo');
  if (!info) return;

  if (!mat) {
    info.style.display = 'none';
    info.innerHTML = '';
    return;
  }

  const lowStyle = getStockStatus(mat) !== 'ok'
    ? 'color:var(--danger);font-weight:700;'
    : 'color:#333;font-weight:600;';

  info.style.display = 'block';
  info.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;font-size:.82rem">
      <div><strong>자재명:</strong> ${esc(mat.name || '-')}</div>
      <div><strong>자재코드:</strong> ${esc(mat.code || '-')}</div>
      <div><strong>모델:</strong> ${esc(mat.model || '-')}</div>
      <div><strong>카테고리:</strong> ${esc(mat.category || '-')}</div>
      <div><strong>담당자:</strong> ${esc(mat.manager || '-')}</div>
      <div><strong>현재 재고:</strong> <span style="${lowStyle}">${mat.current_stock} ${esc(mat.unit || 'EA')}</span></div>
    </div>
  `;
}

function addManualTxItem() {
  const matId = document.getElementById('manualMatSel')?.value;
  const type = document.getElementById('manualType')?.value;
  const qty = parseInt(document.getElementById('manualQty')?.value, 10) || 0;
  const note = document.getElementById('manualNote')?.value.trim() || '';

  if (!matId) return showToast('자재를 선택하세요', 'warning');
  if (qty <= 0) return showToast('수량을 입력하세요', 'warning');

  const mat = _manualMaterials.find(m => m.id === matId);
  if (!mat) return showToast('자재를 찾을 수 없습니다', 'error');

  if (type === 'out' && mat.current_stock < qty) {
    return showToast(`재고 부족! 현재 재고: ${mat.current_stock}`, 'error');
  }

  _manualTxList.push({ mat, type, qty, note });
  renderManualTxList();

  document.getElementById('manualMatSel').value = '';
  document.getElementById('manualQty').value = '1';
  document.getElementById('manualNote').value = '';
  document.getElementById('manualCurStock').value = '';

  const info = document.getElementById('manualSelectedInfo');
  if (info) {
    info.style.display = 'none';
    info.innerHTML = '';
  }
}

function renderManualTxList() {
  const wrap = document.getElementById('manualTxListWrap');
  const countEl = document.getElementById('manualTxCount');
  if (!wrap) return;

  if (countEl) countEl.textContent = `${_manualTxList.length}개`;

  if (!_manualTxList.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa;font-size:.82rem">위에서 자재를 추가하세요</div>';
    return;
  }

  wrap.innerHTML = _manualTxList.map((item, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid #e9ecef;border-radius:8px;margin-bottom:8px;background:#fff">
      <div style="flex:1">
        <div style="font-size:.84rem;font-weight:700;color:#1a1a2e">
          [${item.type === 'in' ? '입고' : '출고'}] ${esc(item.mat.name)}
        </div>
        <div style="font-size:.75rem;color:#666;margin-top:2px">
          ${esc(item.mat.category || '-')} · ${esc(item.mat.model || '-')} · 수량: ${item.qty}
        </div>
        <div style="font-size:.74rem;color:#888;margin-top:2px">
          비고: ${esc(item.note || '-')}
        </div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removeManualTxItem(${i})" style="flex-shrink:0">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
}

function removeManualTxItem(i) {
  _manualTxList.splice(i, 1);
  renderManualTxList();
}

async function submitManualTx() {
  const handler = document.getElementById('manualHandler')?.value;
  if (!handler) return showToast('담당자를 선택하세요', 'warning');
  if (!_manualTxList.length) return showToast('처리할 항목이 없습니다', 'warning');

  const outList = _manualTxList.filter(item => item.type === 'out');

  if (outList.length) {
    const confirmMsg = outList.map(item => {
      const afterStock = Math.max(0, item.mat.current_stock - item.qty);
      return `- ${item.mat.name} / 현재 ${item.mat.current_stock}${item.mat.unit || 'EA'} → 처리 후 ${afterStock}${item.mat.unit || 'EA'} / 출고 ${item.qty}${item.mat.unit || 'EA'}`;
    }).join('\n');

    const ok = confirm(
      `[출고 최종 확인]\n\n담당자: ${handler}\n출고 항목: ${outList.length}건\n\n${confirmMsg}\n\n계속 진행할까요?`
    );

    if (!ok) return;
  }

  try {
    localStorage.setItem('lastHandler', handler);
    showToast(`${_manualTxList.length}건 처리 중.`, 'info');

    for (const item of _manualTxList) {
      const newStock = item.type === 'in'
        ? item.mat.current_stock + item.qty
        : Math.max(0, item.mat.current_stock - item.qty);

      await MaterialAPI.updateStock(item.mat.id, newStock);
      await TransactionAPI.add({
        material_id: item.mat.id,
        material_name: item.mat.name,
        type: item.type,
        quantity: item.qty,
        handler,
        note: item.note
      });

      item.mat.current_stock = newStock;
    }

    showToast(`${_manualTxList.length}건 처리 완료!`, 'success');
    document.getElementById('manualTxModal')?.remove();

    if (typeof loadDashboard === 'function') await loadDashboard();
    if (typeof loadTransactions === 'function') await loadTransactions();
    if (typeof loadMaterials === 'function') await loadMaterials();
  } catch (e) {
    showToast('처리 실패: ' + e.message, 'error');
  }
}