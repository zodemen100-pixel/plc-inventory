/* ================================================
   scan.js
   ================================================ */

let _scanMode        = 'in';
let _currentMaterial = null;
let _html5QrCode     = null;
let _scanning        = false;
let _scanHistory     = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadHandlers();

  // 시분초 시계
  function tickClock() {
    const el = document.getElementById('liveTime');
    if (!el) return;
    const now = new Date();
    el.textContent =
      String(now.getHours()).padStart(2,'0') + ':' +
      String(now.getMinutes()).padStart(2,'0') + ':' +
      String(now.getSeconds()).padStart(2,'0');
  }
  tickClock();
  setInterval(tickClock, 1000);

  document.getElementById('barcodeInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') processBarcode();
  });
});

/* ── 담당자 로드 ── */
async function loadHandlers() {
  const sel = document.getElementById('handlerSelect');
  if (!sel) return;
  try {
    const handlers = await HandlerAPI.getAll();
    sel.innerHTML = '<option value="">-- 담당자 선택 (필수) --</option>' +
      handlers.map(h =>
        `<option value="${esc(h.name)}">${esc(h.name)}${h.department ? ' (' + esc(h.department) + ')' : ''}</option>`
      ).join('');
    const last = localStorage.getItem('lastHandler');
    if (last) sel.value = last;
  } catch(e) { console.error('담당자 로드 오류:', e); }
}

/* ── 모드 전환 ── */
function setMode(mode) {
  _scanMode = mode;
  document.getElementById('btnModeIn')?.classList.toggle('active',  mode === 'in');
  document.getElementById('btnModeOut')?.classList.toggle('active', mode === 'out');
  const input = document.getElementById('barcodeInput');
  if (input) {
    input.className   = `scan-big-input mode-${mode}`;
    input.placeholder = mode === 'in' ? '입고할 바코드를 스캔하세요...' : '출고할 바코드를 스캔하세요...';
  }
  _currentMaterial = null;
  const rc = document.getElementById('resultCard');
  if (rc) rc.style.display = 'none';
}

/* ── 바코드 처리 ── */
async function processBarcode() {
  const bc      = document.getElementById('barcodeInput')?.value.trim();
  const handler = document.getElementById('handlerSelect')?.value;
  if (!bc)      return showToast('바코드를 입력하세요', 'warning');
  if (!handler) return showToast('담당자를 먼저 선택하세요', 'warning');

  try {
    const mat = await MaterialAPI.getByBarcode(bc);
    if (!mat) { showResultCard(null, bc); return; }
    _currentMaterial = mat;
    showResultCard(mat, bc);
  } catch(e) {
    showToast('조회 오류: ' + e.message, 'error');
  }
}

/* ── 결과 카드 표시 ── */
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
        <div class="result-sub">${esc(mat.model||'')} ${mat.version ? 'v'+esc(mat.version) : ''}</div>
      </div>
      ${statusBadgeHTML(st)}
    </div>
    <div class="result-details">
      <div class="detail-item"><div class="label">현재 재고</div><div class="value">${mat.current_stock} ${esc(mat.unit||'EA')}</div></div>
      <div class="detail-item"><div class="label">시리즈</div><div class="value">${esc(mat.series||'-')}</div></div>
      <div class="detail-item"><div class="label">카테고리</div><div class="value" style="font-size:.78rem">${esc(mat.category||'-')}</div></div>
      <div class="detail-item"><div class="label">담당자</div><div class="value">${esc(mat.manager||'-')}</div></div>
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
    <button class="btn btn-${_scanMode === 'in' ? 'success' : 'warning'} btn-lg"
            style="width:100%" onclick="submitTransaction()">
      <i class="fas fa-${_scanMode === 'in' ? 'arrow-circle-down' : 'arrow-circle-up'}"></i>
      ${_scanMode === 'in' ? '입고 처리' : '출고 처리'}
    </button>`;
}

/* ── 수량 조절 ── */
function changeQty(delta) {
  const input = document.getElementById('qtyInput');
  if (!input) return;
  input.value = Math.max(1, (parseInt(input.value) || 1) + delta);
}

/* ── 입출고 처리 ── */
async function submitTransaction() {
  if (!_currentMaterial) return showToast('자재를 먼저 스캔하세요', 'warning');
  const handler = document.getElementById('handlerSelect')?.value;
  if (!handler)  return showToast('담당자를 선택하세요', 'warning');
  const qty  = parseInt(document.getElementById('qtyInput')?.value) || 1;
  const note = document.getElementById('txNote')?.value.trim() || '';

  if (_scanMode === 'out' && _currentMaterial.current_stock < qty)
    return showToast(`재고 부족! 현재 재고: ${_currentMaterial.current_stock}`, 'error');

  try {
    localStorage.setItem('lastHandler', handler);
    const newStock = _scanMode === 'in'
      ? _currentMaterial.current_stock + qty
      : _currentMaterial.current_stock - qty;

    await MaterialAPI.updateStock(_currentMaterial.id, newStock);
    await TransactionAPI.add({
      material_id  : _currentMaterial.id,
      material_name: _currentMaterial.name,
      type         : _scanMode,
      quantity     : qty,
      handler,
      note
    });

    _scanHistory.unshift({ type:_scanMode, name:_currentMaterial.name, qty, handler, time:new Date() });
    renderScanHistory();
    showToast(`${_scanMode === 'in' ? '입고' : '출고'} 처리 완료!`, 'success');
    resetScan();
  } catch(e) {
    showToast('처리 실패: ' + e.message, 'error');
  }
}

/* ── 스캔 이력 렌더 ── */
function renderScanHistory() {
  const wrap = document.getElementById('scanHistory');
  if (!wrap) return;
  if (!_scanHistory.length) {
    wrap.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>스캔 이력이 없습니다</p></div>';
    return;
  }
  wrap.innerHTML = _scanHistory.slice(0,20).map(h => `
    <div class="scan-history-item">
      <div class="scan-history-badge ${h.type}">
        <i class="fas fa-${h.type === 'in' ? 'arrow-down' : 'arrow-up'}"></i>
      </div>
      <div class="scan-history-info">
        <h4>${esc(h.name)}</h4>
        <p>${esc(h.handler)} · ${h.time.toLocaleTimeString('ko-KR')}</p>
      </div>
      <div class="scan-history-qty ${h.type}">${h.type === 'in' ? '+' : '-'}${h.qty}</div>
    </div>`).join('');
}

/* ── 스캔 초기화 ── */
function resetScan() {
  _currentMaterial = null;
  const input = document.getElementById('barcodeInput');
  if (input) { input.value = ''; input.focus(); }
  const rc = document.getElementById('resultCard');
  if (rc) rc.style.display = 'none';
}

/* ── 카메라 시작 ── */
async function startCamera() {
  const wrapper = document.getElementById('cameraWrapper');
  if (!wrapper) return;
  wrapper.classList.add('active');

  if (_html5QrCode) {
    try { await _html5QrCode.stop(); } catch(_) {}
    _html5QrCode = null;
  }
  document.getElementById('qr-reader').innerHTML = '';
  _html5QrCode = new Html5Qrcode('qr-reader');

  const onScan = async (decoded) => {
    if (_scanning) return;
    _scanning = true;
    document.getElementById('barcodeInput').value = decoded;
    await processBarcode();
    await stopCamera();
    setTimeout(() => { _scanning = false; }, 1500);
  };

  try {
    await _html5QrCode.start(
      { facingMode: 'environment' },
      { fps:10, qrbox:{ width:250, height:150 } },
      onScan, () => {}
    );
  } catch(_) {
    try {
      await _html5QrCode.start(
        { facingMode: 'user' },
        { fps:10, qrbox:{ width:250, height:150 } },
        onScan, () => {}
      );
    } catch(e2) {
      showToast('카메라 오류: ' + e2.message, 'error');
      wrapper.classList.remove('active');
    }
  }
}

/* ── 카메라 중지 ── */
async function stopCamera() {
  const wrapper = document.getElementById('cameraWrapper');
  if (wrapper) wrapper.classList.remove('active');
  if (_html5QrCode) {
    try { await _html5QrCode.stop(); await _html5QrCode.clear(); } catch(_) {}
    _html5QrCode = null;
  }
}

/* ================================================
   미등록 자재 빠른 등록 모달
   ================================================ */

function openRegisterModal(bc) {
  // 기존 모달 제거
  document.getElementById('quickRegModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'quickRegModal';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:3000;align-items:center;justify-content:center;padding:16px;';

  modal.innerHTML = `
    <div class="modal" style="max-width:520px;border-radius:16px;overflow:hidden;width:100%;">

      <div class="modal-header" style="background:linear-gradient(135deg,#1e3a5f,#2d6a9f);color:#fff;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;">
        <h3 style="margin:0;font-size:16px;display:flex;align-items:center;gap:8px;">
          <i class="fas fa-plus-circle"></i> 새 자재 등록
        </h3>
        <button onclick="closeRegisterModal()"
          style="background:rgba(255,255,255,.2);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div style="max-height:65vh;overflow-y:auto;">

        <div style="padding:16px 20px;border-bottom:1px solid #eee;background:#f0f8ff;">
          <div style="font-size:11px;font-weight:700;color:#1565c0;letter-spacing:1px;margin-bottom:8px;">
            <i class="fas fa-barcode"></i> 스캔된 바코드
          </div>
          <code style="font-size:14px;font-weight:600;color:#1e3a5f;">${esc(bc)}</code>
        </div>

        <div style="padding:16px 20px;border-bottom:1px solid #eee;">
          <div style="font-size:11px;font-weight:700;color:#2d6a9f;letter-spacing:1px;margin-bottom:12px;">
            <i class="fas fa-info-circle"></i> 기본 정보
          </div>

          <div style="margin-bottom:12px;">
  <label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:4px;">
    자재명 <span style="color:#e53e3e;">*</span>
  </label>
  <input type="text" id="qrMatName" class="form-control" placeholder="자재명 입력"/>
</div>

<div style="margin-bottom:12px;">
  <label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:4px;">
    카테고리 <span style="color:#e53e3e;">*</span>
  </label>
  <div style="margin-bottom:12px;">
  <label>카테고리 (대분류)</label>
  <select id="qrMatCategoryMain" class="form-control">
    <option value="">-- 대분류 선택 --</option>
  </select>
</div>

<div style="margin-bottom:12px;">
  <label>카테고리 (중분류)</label>
  <select id="qrMatCategorySub" class="form-control">
    <option value="">-- 중분류 선택 --</option>
  </select>
</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:4px;">모델</label>
              <input type="text" id="qrMatModel" class="form-control" placeholder="예) CPU 1214C"/>
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:4px;">시리즈</label>
              <input type="text" id="qrMatSeries" class="form-control" placeholder="예) S7-1200"/>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:4px;">버전</label>
              <input type="text" id="qrMatVersion" class="form-control" placeholder="예) V4.5"/>
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:4px;">제조일자</label>
              <input type="date" id="qrMatMfgDate" class="form-control"/>
            </div>
          </div>
        </div>

        <div style="padding:16px 20px;border-bottom:1px solid #eee;background:#f8f9fc;">
          <div style="font-size:11px;font-weight:700;color:#2d6a9f;letter-spacing:1px;margin-bottom:12px;">
            <i class="fas fa-cubes"></i> 재고 정보
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:4px;">현재 재고</label>
              <input type="number" id="qrMatStock" class="form-control" value="0" min="0"/>
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:4px;">최소 재고</label>
              <input type="number" id="qrMatMinStock" class="form-control" value="1" min="0"/>
            </div>
            <div>
              <label style="display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:4px;">단위</label>
              <input type="text" id="qrMatUnit" class="form-control" value="EA"/>
            </div>
          </div>
        </div>

        <div style="padding:16px 20px;border-bottom:1px solid #eee;">
          <div style="font-size:11px;font-weight:700;color:#2d6a9f;letter-spacing:1px;margin-bottom:12px;">
            <i class="fas fa-user"></i> 담당자
          </div>
          <select id="qrMatManager" class="form-control">
            <option value="">-- 선택 --</option>
          </select>
        </div>

        <div style="padding:16px 20px;">
          <div style="font-size:11px;font-weight:700;color:#2d6a9f;letter-spacing:1px;margin-bottom:12px;">
            <i class="fas fa-sticky-note"></i> 비고
          </div>
          <textarea id="qrMatNote" class="form-control" rows="2" placeholder="추가 메모"></textarea>
        </div>

      </div>

      <div style="padding:14px 20px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:10px;background:#fff;">
        <button class="btn btn-outline" onclick="closeRegisterModal()">
          <i class="fas fa-times"></i> 취소
        </button>
        <button class="btn btn-primary" onclick="saveQuickRegister('${esc(bc)}')">
          <i class="fas fa-save"></i> 등록 및 ${_scanMode === 'in' ? '입고' : '출고'} 처리
        </button>
      </div>

    </div>`;

  document.body.appendChild(modal);

  // 담당자 드롭다운 채우기
  HandlerAPI.getAll().then(list => {
    const sel = document.getElementById('qrMatManager');
    if (!sel) return;
    list.filter(h => h.active !== false).forEach(h => {
      const o = document.createElement('option');
      o.value = h.name;
      o.textContent = h.name + (h.department ? ` (${h.department})` : '');
      sel.appendChild(o);
    });

    const curHandler = document.getElementById('handlerSelect')?.value;
    if (curHandler) sel.value = curHandler;
  }).catch(() => {});

  // 카테고리 드롭다운 채우기
  loadCategoryOptions();

  // 오버레이 클릭 닫기
  let _mbg = false;
  modal.addEventListener('mousedown', e => { _mbg = e.target === modal; });
  modal.addEventListener('click', e => {
    if (e.target === modal && _mbg) closeRegisterModal();
    _mbg = false;
  });

  setTimeout(() => document.getElementById('qrMatName')?.focus(), 100);
}
async function loadCategoryOptions() {
  try {
    const cats = await CategoryAPI.getAll();
    const sel = document.getElementById('qrMatCategory');
    if (!sel) return;

    sel.innerHTML =
      '<option value="">-- 카테고리 선택 --</option>' +
      cats.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  } catch (e) {
    console.error('카테고리 로드 실패', e);
  }
}
function closeRegisterModal() {
  document.getElementById('quickRegModal')?.remove();
}

async function saveQuickRegister(bc) {
  const name = document.getElementById('qrMatName')?.value.trim();
  if (!name) {
    showToast('자재명을 입력하세요', 'warning');
    return;
  }

  const handler = document.getElementById('handlerSelect')?.value;
  if (!handler) {
    showToast('담당자를 선택하세요', 'warning');
    return;
  }

  const category = document.getElementById('qrMatCategory')?.value;
  if (!category) {
    showToast('카테고리를 선택하세요', 'warning');
    return;
  }

  const model   = document.getElementById('qrMatModel')?.value.trim() || '';
  const series  = document.getElementById('qrMatSeries')?.value.trim() || '';
  const version = document.getElementById('qrMatVersion')?.value.trim() || '';
  const mfg     = document.getElementById('qrMatMfgDate')?.value || null;

  const codeBase = (model || series || 'MAT').replace(/\s+/g, '').toUpperCase();
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randPart = Math.floor(Math.random() * 900 + 100);
  const code = `${codeBase}-${datePart}-${randPart}`;

  const mat = {
    id              : uuid(),
    code            : code,
    name            : name,
    model           : model,
    series          : series,
    version         : version,
    manufacture_date: mfg,
    barcode         : bc,
    current_stock   : parseInt(document.getElementById('qrMatStock')?.value, 10) || 0,
    min_stock       : parseInt(document.getElementById('qrMatMinStock')?.value, 10) || 1,
    unit            : document.getElementById('qrMatUnit')?.value.trim() || 'EA',
    manager         : document.getElementById('qrMatManager')?.value || handler,
    description     : document.getElementById('qrMatNote')?.value.trim() || '',
    category        : category,
    status          : 'active'
  };

  try {
    const saved = await MaterialAPI.save(mat);
    showToast(`"${saved.name}" 등록 완료!`, 'success');
    closeRegisterModal();
    _currentMaterial = saved;
    showResultCard(saved, bc);
  } catch (e) {
    console.error(e);
    showToast('등록 실패: ' + e.message, 'error');
  }
}
async function loadMainCategories() {
  const cats = await CategoryAPI.getAll();

  const mainSet = [...new Set(cats.map(c => c.main))];

  const sel = document.getElementById('qrMatCategoryMain');

  sel.innerHTML =
    '<option value="">-- 대분류 선택 --</option>' +
    mainSet.map(m => `<option value="${m}">${m}</option>`).join('');
}

async function loadSubCategories(main) {
  const cats = await CategoryAPI.getAll();

  const subList = cats
    .filter(c => c.main === main)
    .map(c => c.sub);

  const sel = document.getElementById('qrMatCategorySub');

  sel.innerHTML =
    '<option value="">-- 중분류 선택 --</option>' +
    subList.map(s => `<option value="${s}">${s}</option>`).join('');
}