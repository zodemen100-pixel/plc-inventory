/* =====================================================
   excel.js - 엑셀 내보내기 / 가져오기
===================================================== */

// ── 자재 목록 엑셀 내보내기 ──
async function exportMaterialsExcel() {
  try {
    showToast('엑셀 파일 생성 중...', 'info');
    const materials = await MaterialAPI.getAll();
    if (!materials.length) return showToast('내보낼 자재가 없습니다', 'warning');

    const rows = [
      ['자재코드', '자재명', '모델명', '버전', '카테고리', '위치', '현재재고', '최소재고', '단위', '바코드', '제조일자', '담당자', '비고', '등록일']
    ];
    materials.forEach(m => {
      rows.push([
        m.code || '', m.name || '', m.model || '', m.version || '',
        m.category || '', m.location || '',
        m.current_stock ?? 0, m.min_stock ?? 0, m.unit || 'EA',
        m.barcode || '', m.manufacture_date || '',
        m.manager || '', m.description || '',
        m.created_at ? new Date(m.created_at).toLocaleDateString('ko-KR') : ''
      ]);
    });

    downloadCSV(rows, `자재목록_${todayStr()}.csv`);
    showToast('엑셀 내보내기 완료!', 'success');
  } catch (e) {
    showToast('내보내기 실패: ' + e.message, 'error');
  }
}

// ── 입출고 이력 엑셀 내보내기 ──
async function exportTransactionsExcel() {
  try {
    showToast('엑셀 파일 생성 중...', 'info');
    const txList = await TransactionAPI.getAll(9999);
    if (!txList.length) return showToast('내보낼 이력이 없습니다', 'warning');

    const rows = [
      ['일시', '자재명', '구분', '수량', '담당자', '비고']
    ];
    txList.forEach(t => {
      rows.push([
        t.transaction_date ? new Date(t.transaction_date).toLocaleString('ko-KR') : '',
        t.material_name || '',
        t.type === 'in' ? '입고' : '출고',
        t.quantity || 0,
        t.handler || '',
        t.note || ''
      ]);
    });

    downloadCSV(rows, `입출고이력_${todayStr()}.csv`);
    showToast('엑셀 내보내기 완료!', 'success');
  } catch (e) {
    showToast('내보내기 실패: ' + e.message, 'error');
  }
}

// ── CSV 다운로드 헬퍼 ──
function downloadCSV(rows, filename) {
  const BOM = '\uFEFF';
  const csv = BOM + rows.map(r =>
    r.map(v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('\n') || s.includes('"')
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── 자재 엑셀 가져오기 ──
function importMaterialsExcel() {
  const existing = document.getElementById('importModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'importModal';
  modal.className = 'modal-overlay active';
  modal.style.zIndex = '3000';
  modal.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h3><i class="fas fa-file-upload"></i> 자재 일괄 가져오기</h3>
        <button class="modal-close" onclick="document.getElementById('importModal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <div style="background:#f0f8ff;border:1px solid #90caf9;border-radius:8px;padding:12px;margin-bottom:16px;font-size:.82rem;color:#1565c0">
          <i class="fas fa-info-circle"></i>
          CSV 파일 형식: <strong>자재코드, 자재명, 모델명, 버전, 카테고리, 위치, 현재재고, 최소재고, 단위, 바코드, 제조일자, 담당자, 비고</strong>
        </div>
        <div style="margin-bottom:12px">
          <button class="btn btn-outline btn-sm" onclick="downloadTemplate()">
            <i class="fas fa-download"></i> 양식 다운로드
          </button>
        </div>
        <div class="form-group">
          <label>CSV 파일 선택</label>
          <input type="file" id="importFile" accept=".csv" class="form-control">
        </div>
        <div id="importPreview" style="margin-top:12px"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="document.getElementById('importModal').remove()">취소</button>
        <button class="btn btn-success" onclick="doImport()">
          <i class="fas fa-upload"></i> 가져오기
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.getElementById('importFile').addEventListener('change', previewImport);
}

function downloadTemplate() {
  const rows = [
    ['자재코드', '자재명', '모델명', '버전', '카테고리', '위치', '현재재고', '최소재고', '단위', '바코드', '제조일자', '담당자', '비고'],
    ['AB-001', '서보 드라이버', '1756-IB32', 'v2.1', 'AB > DIGITAL INPUT', 'A-1-1', '10', '3', 'EA', '', '2024-01-15', '홍길동', '']
  ];
  downloadCSV(rows, '자재등록_양식.csv');
}

let _importData = [];

function previewImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const text = ev.target.result.replace(/^\uFEFF/, '');
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    _importData = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (!cols[1]?.trim()) continue;
      _importData.push({
        id: uuid(),
        code: cols[0]?.trim() || '',
        name: cols[1]?.trim() || '',
        model: cols[2]?.trim() || '',
        version: cols[3]?.trim() || '',
        category: cols[4]?.trim() || '미분류',
        location: cols[5]?.trim() || '',
        current_stock: parseInt(cols[6]) || 0,
        min_stock: parseInt(cols[7]) || 1,
        unit: cols[8]?.trim() || 'EA',
        barcode: cols[9]?.trim() || '',
        manufacture_date: cols[10]?.trim() || null,
        manager: cols[11]?.trim() || '',
        description: cols[12]?.trim() || '',
        status: 'active'
      });
    }

    const preview = document.getElementById('importPreview');
    if (!_importData.length) {
      preview.innerHTML = '<p style="color:red">읽을 수 있는 데이터가 없습니다.</p>';
      return;
    }
    preview.innerHTML = `
      <div style="background:#f0fff4;border:1px solid #a5d6a7;border-radius:8px;padding:10px;font-size:.82rem">
        <i class="fas fa-check-circle" style="color:var(--success)"></i>
        <strong>${_importData.length}개</strong> 자재를 가져올 준비가 되었습니다.
        <div style="margin-top:8px;max-height:120px;overflow-y:auto">
          ${_importData.slice(0, 5).map(m => `<div style="padding:2px 0;color:#444">· ${m.name} (${m.model || '-'})</div>`).join('')}
          ${_importData.length > 5 ? `<div style="color:#888">... 외 ${_importData.length - 5}개</div>` : ''}
        </div>
      </div>`;
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; continue; }
    if (line[i] === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += line[i];
  }
  result.push(cur);
  return result;
}

async function doImport() {
  if (!_importData.length) return showToast('가져올 데이터가 없습니다', 'warning');
  try {
    showToast(`${_importData.length}개 자재 저장 중...`, 'info');
    for (const mat of _importData) {
      await MaterialAPI.save(mat);
    }
    showToast(`${_importData.length}개 자재가 등록되었습니다!`, 'success');
    document.getElementById('importModal')?.remove();
    if (typeof loadMaterials === 'function') await loadMaterials();
    if (typeof loadDashboard === 'function') await loadDashboard();
  } catch (e) {
    showToast('가져오기 실패: ' + e.message, 'error');
  }
}
