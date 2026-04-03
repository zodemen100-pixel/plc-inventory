/* =====================================================
   label.js - 바코드 / QR 라벨 출력
===================================================== */

let _labelMaterials = [];
let _labelSelected = new Set();

// ── 라벨 출력 모달 열기 ──
async function openLabelModal(singleId = null) {
  const existing = document.getElementById('labelModal');
  if (existing) existing.remove();

  try {
    _labelMaterials = await MaterialAPI.getAll();
    _labelSelected = new Set();
    if (singleId) _labelSelected.add(singleId);
  } catch (e) {
    return showToast('자재 로드 실패', 'error');
  }

  const modal = document.createElement('div');
  modal.id = 'labelModal';
  modal.className = 'modal-overlay open';
  modal.style.zIndex = '3000';
  modal.innerHTML = `
    <div class="modal" style="max-width:780px;max-height:92vh">
      <div class="modal-header">
        <h3><i class="fas fa-print"></i> 바코드 라벨 출력</h3>
        <button class="modal-close" onclick="document.getElementById('labelModal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body" style="padding:16px">
        <!-- 설정 -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;padding:12px;background:#f8f9fa;border-radius:10px;align-items:center">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:.82rem;font-weight:600;white-space:nowrap">라벨 크기:</label>
            <select id="labelSize" class="filter-select" style="font-size:.82rem" onchange="renderLabelPreview()">
              <option value="small">소형 (62×29mm)</option>
              <option value="medium" selected>중형 (90×29mm)</option>
              <option value="large">대형 (100×50mm)</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:.82rem;font-weight:600;white-space:nowrap">바코드 유형:</label>
            <select id="labelType" class="filter-select" style="font-size:.82rem" onchange="renderLabelPreview()">
              <option value="barcode">바코드 (CODE128)</option>
              <option value="qr">QR코드</option>
              <option value="both">바코드 + QR</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:.82rem;font-weight:600;white-space:nowrap">매수:</label>
            <input type="number" id="labelCopies" value="1" min="1" max="10"
              style="width:60px;padding:6px;border:1.5px solid #dee2e6;border-radius:6px;font-size:.82rem"
              onchange="renderLabelPreview()">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <!-- 자재 선택 -->
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:.85rem;font-weight:600">자재 선택</span>
              <div style="display:flex;gap:6px">
                <button class="btn btn-outline btn-sm" onclick="selectAllLabels()">전체선택</button>
                <button class="btn btn-outline btn-sm" onclick="clearLabelSelection()">선택해제</button>
              </div>
            </div>
            <div style="max-height:320px;overflow-y:auto;border:1px solid #e9ecef;border-radius:8px">
              ${_labelMaterials.map(m => `
                <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #f0f2f5;cursor:pointer;transition:background .15s"
                  onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background=''">
                  <input type="checkbox" value="${m.id}" ${_labelSelected.has(m.id) ? 'checked' : ''}
                    onchange="toggleLabelSelect('${m.id}',this.checked)"
                    style="width:16px;height:16px;cursor:pointer">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div>
                    <div style="font-size:.72rem;color:#888">${esc(m.model || '-')} · ${esc(m.barcode || '바코드없음')}</div>
                  </div>
                </label>
              `).join('')}
            </div>
            <div style="margin-top:8px;font-size:.78rem;color:#888" id="labelSelectCount">
              선택: ${_labelSelected.size}개
            </div>
          </div>

          <!-- 미리보기 -->
          <div>
            <div style="font-size:.85rem;font-weight:600;margin-bottom:8px">미리보기</div>
            <div id="labelPreviewWrap" style="max-height:360px;overflow-y:auto;border:1px solid #e9ecef;border-radius:8px;padding:10px;background:#fff">
              <div class="empty-state"><i class="fas fa-tag"></i><p>자재를 선택하세요</p></div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="document.getElementById('labelModal').remove()">닫기</button>
        <button class="btn btn-primary" onclick="printLabels()">
          <i class="fas fa-print"></i> 인쇄하기
        </button>
      </div>
    </div>`;

  let _mbg = false;
  modal.addEventListener('mousedown', e => { _mbg = e.target === modal; });
  modal.addEventListener('click', e => { if (e.target === modal && _mbg) modal.remove(); _mbg = false; });
  document.body.appendChild(modal);

  if (singleId) renderLabelPreview();
}

function toggleLabelSelect(id, checked) {
  if (checked) _labelSelected.add(id);
  else _labelSelected.delete(id);
  document.getElementById('labelSelectCount').textContent = `선택: ${_labelSelected.size}개`;
  renderLabelPreview();
}

function selectAllLabels() {
  _labelMaterials.forEach(m => {
    _labelSelected.add(m.id);
    const cb = document.querySelector(`input[value="${m.id}"]`);
    if (cb) cb.checked = true;
  });
  document.getElementById('labelSelectCount').textContent = `선택: ${_labelSelected.size}개`;
  renderLabelPreview();
}

function clearLabelSelection() {
  _labelSelected.clear();
  document.querySelectorAll('#labelModal input[type=checkbox]').forEach(cb => cb.checked = false);
  document.getElementById('labelSelectCount').textContent = '선택: 0개';
  renderLabelPreview();
}

function renderLabelPreview() {
  const wrap = document.getElementById('labelPreviewWrap');
  if (!wrap) return;
  const selected = _labelMaterials.filter(m => _labelSelected.has(m.id));
  const copies = parseInt(document.getElementById('labelCopies')?.value) || 1;
  const type = document.getElementById('labelType')?.value || 'barcode';
  const size = document.getElementById('labelSize')?.value || 'medium';

  if (!selected.length) {
    wrap.innerHTML = '<div class="empty-state"><i class="fas fa-tag"></i><p>자재를 선택하세요</p></div>';
    return;
  }

  const sizeMap = {
    small: { w: '120px', h: '60px', fs: '9px' },
    medium: { w: '180px', h: '70px', fs: '10px' },
    large: { w: '200px', h: '100px', fs: '11px' }
  };
  const s = sizeMap[size];

  wrap.innerHTML = '';
  selected.forEach(m => {
    for (let i = 0; i < copies; i++) {
      const item = document.createElement('div');
      item.style.cssText = `width:${s.w};border:1px solid #ddd;border-radius:6px;padding:6px;margin:4px;display:inline-block;vertical-align:top;text-align:center;background:#fff`;
      item.innerHTML = `
        <div style="font-size:${s.fs};font-weight:700;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name)}</div>
        ${m.model ? `<div style="font-size:${parseInt(s.fs)-1}px;color:#666;margin-bottom:3px">${esc(m.model)}</div>` : ''}
        ${m.barcode ? `
          ${(type === 'barcode' || type === 'both') ? `<svg class="bc-svg" data-bc="${esc(m.barcode)}" style="max-width:100%"></svg>` : ''}
          ${(type === 'qr' || type === 'both') ? `<div class="qr-div" data-bc="${esc(m.barcode)}" style="display:inline-block;margin:2px"></div>` : ''}
          <div style="font-size:${parseInt(s.fs)-1}px;color:#555;margin-top:2px">${esc(m.barcode)}</div>
        ` : '<div style="font-size:9px;color:#aaa">바코드 없음</div>'}
        ${m.location ? `<div style="font-size:${parseInt(s.fs)-1}px;color:#888">📍${esc(m.location)}</div>` : ''}`;
      wrap.appendChild(item);
    }
  });

  // 바코드 렌더링
  setTimeout(() => {
    wrap.querySelectorAll('.bc-svg').forEach(svg => {
      try {
        JsBarcode(svg, svg.dataset.bc, {
          format: 'CODE128', width: 2, height: 40,
          displayValue: false, margin: 4
        });
      } catch (e) {}
    });
    // QR코드 렌더링
    wrap.querySelectorAll('.qr-div').forEach(div => {
      div.innerHTML = '';
      try {
        new QRCode(div, {
          text: div.dataset.bc,
          width: 60, height: 60,
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (e) {
        div.innerHTML = `<div style="font-size:9px;color:red">QR오류</div>`;
      }
    });
  }, 100);
}

function printLabels() {
  const selected = _labelMaterials.filter(m => _labelSelected.has(m.id));
  if (!selected.length) return showToast('인쇄할 자재를 선택하세요', 'warning');

  const copies = parseInt(document.getElementById('labelCopies')?.value) || 1;
  const type = document.getElementById('labelType')?.value || 'barcode';
  const size = document.getElementById('labelSize')?.value || 'medium';

  const sizeMap = {
    small: { w: '62mm', h: '29mm', fs: '8pt' },
    medium: { w: '90mm', h: '29mm', fs: '9pt' },
    large: { w: '100mm', h: '50mm', fs: '10pt' }
  };
  const s = sizeMap[size];

  const win = window.open('', '_blank');
  let items = '';
  selected.forEach(m => {
    for (let i = 0; i < copies; i++) {
      items += `
        <div class="label-item">
          <div class="mat-name">${esc(m.name)}</div>
          ${m.model ? `<div class="mat-model">${esc(m.model)}${m.version ? ' v' + esc(m.version) : ''}</div>` : ''}
          ${m.barcode ? `
            <div class="code-wrap">
              ${(type === 'barcode' || type === 'both') ? `<svg id="bc_${m.id}_${i}"></svg>` : ''}
              ${(type === 'qr' || type === 'both') ? `<div id="qr_${m.id}_${i}" class="qr-wrap"></div>` : ''}
            </div>
            <div class="bc-text">${esc(m.barcode)}</div>
          ` : ''}
          ${m.location ? `<div class="mat-loc">📍 ${esc(m.location)}</div>` : ''}
        </div>`;
    }
  });

  win.document.write(`
    <!DOCTYPE html><html lang="ko"><head>
    <meta charset="UTF-8">
    <title>바코드 라벨 출력</title>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Noto Sans KR', sans-serif; background: #fff; }
      .label-grid { display: flex; flex-wrap: wrap; gap: 4mm; padding: 8mm; }
      .label-item {
        width: ${s.w}; height: ${s.h};
        border: 0.5mm solid #333; border-radius: 2mm;
        padding: 2mm; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        page-break-inside: avoid; overflow: hidden;
        text-align: center;
      }
      .mat-name { font-size: ${s.fs}; font-weight: 700; margin-bottom: 1mm; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mat-model { font-size: calc(${s.fs} - 1pt); color: #555; margin-bottom: 1mm; }
      .code-wrap { display: flex; align-items: center; justify-content: center; gap: 2mm; }
      .qr-wrap img { width: 20mm !important; height: 20mm !important; }
      .bc-text { font-size: 7pt; color: #444; margin-top: 1mm; font-family: monospace; letter-spacing: .05em; }
      .mat-loc { font-size: 7pt; color: #666; margin-top: 1mm; }
      svg { max-width: 100%; }
      @media print {
        body { margin: 0; }
        .no-print { display: none; }
        @page { margin: 5mm; }
      }
      .print-btn { position: fixed; top: 10px; right: 10px; padding: 10px 20px; background: #2196F3; color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 600; z-index: 999; }
    </style>
    </head><body>
    <button class="print-btn no-print" onclick="window.print()">🖨️ 인쇄</button>
    <div class="label-grid">${items}</div>
    <script>
      window.onload = function() {
        document.querySelectorAll('[id^="bc_"]').forEach(svg => {
          const parts = svg.id.split('_');
          const bc = svg.getAttribute('data-bc') || svg.parentElement.parentElement.querySelector('.bc-text')?.textContent;
          const bcEl = svg.closest('.label-item')?.querySelector('.bc-text');
          if (!bcEl) return;
          try {
            JsBarcode(svg, bcEl.textContent.trim(), {
              format: 'CODE128', width: 2, height: 30,
              displayValue: false, margin: 2
            });
          } catch(e) {}
        });
        document.querySelectorAll('[id^="qr_"]').forEach(div => {
          const bcEl = div.closest('.label-item')?.querySelector('.bc-text');
          if (!bcEl) return;
          try {
            new QRCode(div, {
              text: bcEl.textContent.trim(),
              width: 60, height: 60,
              correctLevel: QRCode.CorrectLevel.M
            });
          } catch(e) {}
        });
      };
    <\/script>
    </body></html>`);
  win.document.close();
}
