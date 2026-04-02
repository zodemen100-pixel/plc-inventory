let _scanMode = 'in';
let _currentMaterial = null;
let _html5QrCode = null;
let _scanning = false;
let _scanHistory = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadHandlers();
  bindModalOverlayClose([]);
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
        <div><div class="result-title">자재를 찾을 수 없습니다</div>
        <div class="result-sub">바코드: ${esc(bc)}</div></div>
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
