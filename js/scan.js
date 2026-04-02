let _scanMode = 'in';
let _currentMaterial = null;
let _html5QrCode = null;
let _scanning = false;
let _scanHistory = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadHandlers();
  bindModalOverlayClose([]);

  // 시분초 시계 (id: liveTime)
  function tickClock() {
    const el = document.getElementById('liveTime');
    if (el) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      el.textContent = `${hh}:${mm}:${ss}`;
    }
  }
  tickClock();
  setInterval(tickClock, 1000);

  document.getElementById('barcodeInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') processBarcode();
  });
});

async function loadHandlers() {
  const sel = document.getElementById('handlerSelect');
  if (!sel) return;
  try {
    const handlers = await HandlerAPI.getAll();
    sel.innerHTML = '<option value="">-- 담당자 선택 (필수) --</option>' +
      handlers.map(h => `<option value="${esc(h.name)}">${esc(h.name)}${h.department ? ' (' + esc(h.department) + ')' : ''}</option>`).join('');
    const last = localStorage.getItem('lastHandler');
    if (last) sel.value = last;
  } catch (e) { console.error('담당자 로드 오류:', e); }
}

function setMode(mode) {
  _scanMode = mode;
  document.getElementById('btnModeIn')?.classList.toggle('active', mode === 'in');
  document.getElementById('btnModeOut')?.classList.toggle('active', mode === 'out');
  const input = document.getElementById('barcodeInput');
  if (input) {
    input.className = `scan-big-input mode-${mode}`;
    input.placeholder = mode === 'in' ? '입고할 바코드를 스캔하세요...' : '출고할 바코드를 스캔하세요...';
  }
  _currentMaterial = null;
  document.getElementById('resultCard').style.display = 'none';
}

async function processBarcode() {
  const bc = document.getElementById('barcodeInput')?.value.trim();
  if (!bc) return showToast('바코드를 입력하세요', 'warning');
  const handler = document.getElementById('handlerSelect')?.value;
  if (!handler) return showToast('담당자를 먼저 선택하세요', 'warning');

  try {
    const mat = await MaterialAPI.getByBarcode(bc);
    if (!mat) {
      showResultCard(null, bc);
      return;
    }
    _currentMaterial = mat;
    showResultCard(mat, bc);
  } catch (e) {
    showToast('조회 오류: ' + e.message, 'error');
  }
}

function showResultCard(mat, bc) {
  const card = document.getElementById('resultCard');
  if (!card) return;
  card.style.display = 'block';

  if (!mat) {
    card.className = 'result-card not-found';
    card.innerHTML = `
      <div class="result-header">
        <div class="result-icon error"><i class="fas fa-times"></i></div>
        <div>
          <div class="result-title">자재를 찾을 수 없습니다</div>
          <div class="result-sub">바코드: <code style="background:#f0f2f5;padding:2px 6px;border-radius:4px">${esc(bc)}</code></div>
        </div>
      </div>
      <div style="margin-top:14px;padding:14px;background:#fff8f8;border-radius:10px;border:1px solid #ffcdd2">
        <p style="font-size:.85rem;color:#666;margin-bottom:12px">
          <i class="fas fa-info-circle" style="color:#f44336"></i>
          이 바코드로 등록된 자재가 없습니다. 새로 등록하시겠습니까?
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-success btn-sm" onclick="openRegisterModal('${esc(bc)}')">
            <i class="fas fa-plus"></i> 새 자재로 등록
          </button>
          <button class="btn btn-outline btn-sm" onclick="resetScan()">
            <i class="fas fa-redo"></i> 다시 스캔
          </button>
        </div>
      </div>`;
    return;
  }

  const st = getStockStatus(mat);
  card.className = `result-card found-${_scanMode}`;
  card.innerHTML = `
    <div class="result-header">
      <div class="result-icon ${_scanMode}">
        <i class="fas fa-${_scanMode === 'in' ? 'arrow-circle-down' : 'arrow-circle-up'}"></i>
      </div>
      <div>
        <div class="result-title">${esc(mat.name)}</div>
        <div class="result-sub">${esc(mat.model || '')} ${mat.version ? 'v' + esc(mat.version) : ''}</div>
      </div>
      ${statusBadgeHTML(st)}
    </div>
    <div class="result-details">
      <div class="detail-item"><div class="label">현재 재고</div><div class="value">${mat.current_stock} ${esc(mat.unit || 'EA')}</div></div>
      <div class="detail-item"><div class="label">위치</div><div class="value">${esc(mat.location || '-')}</div></div>
      <div class="detail-item"><div class="label">카테고리</div><div class="value" style="font-size:.78rem">${esc(mat.category || '-')}</div></div>
      <div class="detail-item"><div class="label">담당자</div><div class="value">${esc(mat.manager || '-')}</div></div>
    </div>
    <div class="qty-area">
      <label>${_scanMode === 'in' ? '입고' : '출고'} 수량</label>
      <div class="qty-controls">
        <button class="qty-btn" onclick="changeQty(-1)">−</button>
        <input type="number" id="qtyInput" class="qty-input" value="1" min="1">
        <button class="qty-btn" onclick="changeQty(1)">+</button>
      </div>
    </div>
    <div class="form-group">
      <label style="font-size:.82rem;font-weight:600">비고</label>
      <input type="text" id="txNote" class="form-control" placeholder="메모 (선택)">
    </div>
    <button class="btn btn-${_scanMode === 'in' ? 'success' : 'warning'} btn-lg" style="width:100%" onclick="submitTransaction()">
      <i class="fas fa-${_scanMode === 'in' ? 'arrow-circle-down' : 'arrow-circle-up'}"></i>
      ${_scanMode === 'in' ? '입고 처리' : '출고 처리'}
    </button>`;
}

function changeQty(delta) {
  const input = document.getElementById('qtyInput');
  if (!input) return;
  const val = Math.max(1, (parseInt(input.value) || 1) + delta);
  input.value = val;
}

async function submitTransaction() {
  if (!_currentMaterial) return showToast('자재를 먼저 스캔하세요', 'warning');
  const handler = document.getElementById('handlerSelect')?.value;
  if (!handler) return showToast('담당자를 선택하세요', 'warning');
  const qty = parseInt(document.getElementById('qtyInput')?.value) || 1;
  const note = document.getElementById('txNote')?.value.trim() || '';

  if (_scanMode === 'out' && _currentMaterial.current_stock < qty) {
    return showToast(`재고 부족! 현재 재고: ${_currentMaterial.current_stock}`, 'error');
  }

  try {
    localStorage.setItem('lastHandler', handler);
    const newStock = _scanMode === 'in'
      ? _currentMaterial.current_stock + qty
      : _currentMaterial.current_stock - qty;

    await MaterialAPI.updateStock(_currentMaterial.id, newStock);
    await TransactionAPI.add({
      material_id: _currentMaterial.id,
      material_name: _currentMaterial.name,
      type: _scanMode,
      quantity: qty,
      handler,
      note
    });

    // 이력 추가
    _scanHistory.unshift({
      type: _scanMode,
      name: _currentMaterial.name,
      qty,
      handler,
      time: new Date()
    });
    renderScanHistory();

    showToast(`${_scanMode === 'in' ? '입고' : '출고'} 처리 완료!`, 'success');
    resetScan();
  } catch (e) {
    showToast('처리 실패: ' + e.message, 'error');
  }
}

function renderScanHistory() {
  const wrap = document.getElementById('scanHistory');
  if (!wrap) return;
  if (!_scanHistory.length) {
    wrap.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>스캔 이력이 없습니다</p></div>';
    return;
  }
  wrap.innerHTML = _scanHistory.slice(0, 20).map(h => `
    <div class="scan-history-item">
      <div class="scan-history-badge ${h.type}">
        <i class="fas fa-${h.type === 'in' ? 'arrow-down' : 'arrow-up'}"></i>
      </div>
      <div class="scan-history-info">
        <h4>${esc(h.name)}</h4>
        <p>${esc(h.handler)} · ${h.time.toLocaleTimeString('ko-KR')}</p>
      </div>
      <div class="scan-history-qty ${h.type}">${h.type === 'in' ? '+' : '-'}${h.qty}</div>
    </div>
  `).join('');
}

function resetScan() {
  _currentMaterial = null;
  const input = document.getElementById('barcodeInput');
  if (input) { input.value = ''; input.focus(); }
  document.getElementById('resultCard').style.display = 'none';
}

async function startCamera() {
  const wrapper = document.getElementById('cameraWrapper');
  if (!wrapper) return;
  wrapper.classList.add('active');

  if (_html5QrCode) {
    try { await _html5QrCode.stop(); } catch (e) {}
    _html5QrCode = null;
  }

  document.getElementById('qr-reader').innerHTML = '';
  _html5QrCode = new Html5Qrcode('qr-reader');

  try {
    await _html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      async (decoded) => {
        if (_scanning) return;
        _scanning = true;
        document.getElementById('barcodeInput').value = decoded;
        await processBarcode();
        await stopCamera();
        setTimeout(() => { _scanning = false; }, 1500);
      },
      () => {}
    );
  } catch (e) {
    try {
      await _html5QrCode.start(
        { facingMode: 'user' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        async (decoded) => {
          if (_scanning) return;
          _scanning = true;
          document.getElementById('barcodeInput').value = decoded;
          await processBarcode();
          await stopCamera();
          setTimeout(() => { _scanning = false; }, 1500);
        },
        () => {}
      );
    } catch (e2) {
      showToast('카메라 오류: ' + e2.message, 'error');
      wrapper.classList.remove('active');
    }
  }
}

async function stopCamera() {
  const wrapper = document.getElementById('cameraWrapper');
  if (wrapper) wrapper.classList.remove('active');
  if (_html5QrCode) {
    try { await _html5QrCode.stop(); await _html5QrCode.clear(); } catch (e) {}
    _html5QrCode = null;
  }
}
/* ── 미등록 자재 빠른 등록 모달 ── */
function openRegisterModal(bc) {
  // 기존 모달 있으면 제거
  const existing = document.getElementById('quickRegModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'quickRegModal';
  modal.className = 'modal-overlay active';
  modal.style.zIndex = '3000';
  modal.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h3><i class="fas fa-plus"></i> 빠른 자재 등록</h3>
        <button class="modal-close" onclick="document.getElementById('quickRegModal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <div style="background:#f0f8ff;border:1px solid #90caf9;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:.82rem;color:#1565c0">
          <i class="fas fa-barcode"></i> 스캔된 바코드: <strong>${esc(bc)}</strong>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>자재명 <span class="required">*</span></label>
            <input type="text" id="qrMatName" class="form-control" placeholder="자재명 입력">
          </div>
          <div class="form-group">
            <label>모델명</label>
            <input type="text" id="qrMatModel" class="form-control" placeholder="모델명 입력">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>현재 재고</label>
            <input type="number" id="qrMatStock" class="form-control" value="0" min="0">
          </div>
          <div class="form-group">
            <label>최소 재고</label>
            <input type="number" id="qrMatMinStock" class="form-control" value="1" min="0">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>위치</label>
            <input type="text" id="qrMatLocation" class="form-control" placeholder="예: A-1-1">
          </div>
          <div class="form-group">
            <label>담당자</label>
            <input type="text" id="qrMatManager" class="form-control" placeholder="담당자명">
          </div>
        </div>
        <div class="form-group">
          <label>비고</label>
          <input type="text" id="qrMatNote" class="form-control" placeholder="메모 (선택)">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="document.getElementById('quickRegModal').remove()">취소</button>
        <button class="btn btn-success" onclick="saveQuickRegister('${esc(bc)}')">
          <i class="fas fa-save"></i> 등록 및 ${_scanMode === 'in' ? '입고' : '출고'} 처리
        </button>
      </div>
    </div>`;

  // 모달 드래그 닫힘 방지
  let _mbg = false;
  modal.addEventListener('mousedown', e => { _mbg = e.target === modal; });
  modal.addEventListener('click', e => { if (e.target === modal && _mbg) modal.remove(); _mbg = false; });

  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('qrMatName')?.focus(), 100);
}

async function saveQuickRegister(bc) {
  const name = document.getElementById('qrMatName')?.value.trim();
  if (!name) return showToast('자재명을 입력하세요', 'error');

  const handler = document.getElementById('handlerSelect')?.value;
  if (!handler) return showToast('담당자를 선택하세요', 'warning');

  const id = uuid();
  const mat = {
    id,
    code: id.substring(0, 8).toUpperCase(),
    name,
    model: document.getElementById('qrMatModel')?.value.trim() || '',
    barcode: bc,
    current_stock: parseInt(document.getElementById('qrMatStock')?.value) || 0,
    min_stock: parseInt(document.getElementById('qrMatMinStock')?.value) || 1,
    location: document.getElementById('qrMatLocation')?.value.trim() || '',
    manager: document.getElementById('qrMatManager')?.value.trim() || handler,
    description: document.getElementById('qrMatNote')?.value.trim() || '',
    unit: 'EA',
    category: '미분류',
    status: 'active'
  };

  try {
    const saved = await MaterialAPI.save(mat);
    showToast('자재가 등록되었습니다!', 'success');
    document.getElementById('quickRegModal')?.remove();

    // 등록 후 바로 스캔 결과에 표시
    _currentMaterial = saved;
    showResultCard(saved, bc);
  } catch (e) {
    showToast('등록 실패: ' + e.message, 'error');
  }
}
