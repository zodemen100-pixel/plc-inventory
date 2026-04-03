/* =====================================================
   manual_tx.js - 입출고 수동 등록
===================================================== */

let _manualTxList = []; // 일괄 처리 목록

function openManualTxModal() {
  const existing = document.getElementById('manualTxModal');
  if (existing) existing.remove();

  _manualTxList = [];

  const modal = document.createElement('div');
  modal.id = 'manualTxModal';
  modal.className = 'modal-overlay open';
  modal.style.zIndex = '3000';
  modal.innerHTML = `
    <div class="modal" style="max-width:680px">
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
          <div style="font-size:.85rem;font-weight:700;margin-bottom:10px;color:#1a1a2e">
            <i class="fas fa-plus-circle" style="color:var(--success)"></i> 자재 추가
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
  modal.addEventListener('click', e => { if (e.target === modal && _mbg) modal.remove(); _mbg = false; });
  document.body.appendChild(modal);

  // 담당자, 자재 로드
  Promise.all([HandlerAPI.getAll(), MaterialAPI.getAll()]).then(([handlers, materials]) => {
    const hSel = document.getElementById('manualHandler');
    if (hSel) hSel.innerHTML = '<option value="">-- 담당자 선택 --</option>' +
      handlers.map(h => `<option value="${esc(h.name)}">${esc(h.name)}${h.department ? ' (' + esc(h.department) + ')' : ''}</option>`).join('');

    const mSel = document.getElementById('manualMatSel');
    window._manualMaterials = materials;
    if (mSel) mSel.innerHTML = '<option value="">-- 자재 선택 --</option>' +
      materials.map(m => `<option value="${m.id}">${esc(m.name)} (${esc(m.model || '-')})</option>`).join('');

    // 마지막 담당자 복원
    const last = localStorage.getItem('lastHandler');
    if (last && hSel) hSel.value = last;
  });
}

function onManualMatChange() {
  const id = document.getElementById('manualMatSel')?.value;
  const mat = (window._manualMaterials || []).find(m => m.id === id);
  const el = document.getElementById('manualCurStock');
  if (el) el.value = mat ? `${mat.current_stock} ${mat.unit || 'EA'}` : '';
}

function addManualTxItem() {
  const matId = document.getElementById('manualMatSel')?.value;
  const type = document.getElementById('manualType')?.value;
  const qty = parseInt(document.getElementById('manualQty')?.value) || 0;
  const note = document.getElementById('manualNote')?.value.trim() || '';

  if (!matId) return showToast('자재를 선택하세요', 'warning');
  if (qty <= 0) return showToast('수량을 입력하세요', 'warning');

  const mat = (window._manualMaterials || []).find(m => m.id === matId);
  if (!mat) return showToast('자재를 찾을 수 없습니다', 'error');

  if (type === 'out' && mat.current_stock < qty) {
    return showToast(`재고 부족! 현재 재고: ${mat.current_stock}`, 'error');
  }

  _manualTxList.push({ mat, type, qty, note });
  renderManualTxList();

  // 초기화
  document.getElementById('manualMatSel').value = '';
  document.getElementById('manualQty').value = '1';
  document.getElementById('manualNote').value = '';
  document.getElementById('manualCurStock').value = '';
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
    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:${item.type === 'in' ? '#f0fff4' : '#fffde7'};margin-bottom:6px;border:1px solid ${item.type === 'in' ? '#a5d6a7' : '#fff176'}">
      <span class="type-${item.type}" style="flex-shrink:0">${item.type === 'in' ? '입고' : '출고'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:.85rem;font-weight:600">${esc(item.mat.name)}</div>
        <div style="font-size:.75rem;color:#888">${esc(item.mat.model || '-')} · 수량: ${item.qty} · ${item.note || '-'}</div>
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

  try {
    localStorage.setItem('lastHandler', handler);
    showToast(`${_manualTxList.length}건 처리 중...`, 'info');

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
      // 로컬 재고 갱신
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
