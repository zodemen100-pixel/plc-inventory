document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboard();
  document.getElementById('searchInput')?.addEventListener('input', filterDashboardTable);
});

async function loadDashboard() {
  try {
    const [materials, todayTx] = await Promise.all([
      MaterialAPI.getAll(),
      TransactionAPI.getToday()
    ]);

    // 통계
    const el = id => document.getElementById(id);
    if (el('totalMaterials')) el('totalMaterials').textContent = materials.length;
    if (el('todayIn')) el('todayIn').textContent = todayTx.filter(t => t.type === 'in').length;
    if (el('todayOut')) el('todayOut').textContent = todayTx.filter(t => t.type === 'out').length;
    if (el('lowStock')) el('lowStock').textContent = materials.filter(m => getStockStatus(m) !== 'ok').length;

    // 부족재고
    renderLowStock(materials.filter(m => getStockStatus(m) !== 'ok'));

    // 최근 이력
    const recentTx = await TransactionAPI.getAll(10);
    renderRecentTx(recentTx.slice(0, 10));

    // 제조사 매핑 준비
    window._dashManufacturerMap = await buildManufacturerMap();
    window._dashMaterials = materials;

    // 전체 재고 현황
    renderDashTable(materials);

    // TOP 10
    await loadTop10();

  } catch (e) {
    console.error('대시보드 로드 오류:', e);
    showToast('데이터 로드 오류: ' + e.message, 'error');
  }
}

function renderLowStock(list) {
  const wrap = document.getElementById('lowStockList');
  if (!wrap) return;

  if (!list.length) {
    wrap.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--success)"></i><p>재고 부족 자재 없음 🎉</p></div>';
    return;
  }

  wrap.innerHTML = list.map(m => `
    <div class="alert-item">
      <div class="alert-info">
        <h4>${esc(m.name)}</h4>
        <p>${esc(m.category || '-')} · ${esc(m.location || '-')}</p>
      </div>
      <div class="alert-stock">
        <div class="current">${m.current_stock} ${esc(m.unit || 'EA')}</div>
        <div class="min">최소 ${m.min_stock}</div>
      </div>
    </div>
  `).join('');
}

function renderRecentTx(list) {
  const wrap = document.getElementById('recentTransactions');
  if (!wrap) return;

  if (!list.length) {
    wrap.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>입출고 이력이 없습니다</p></div>';
    return;
  }

  wrap.innerHTML = list.map(t => `
    <div class="tx-item">
      <div class="tx-badge ${t.type}">
        <i class="fas fa-${t.type === 'in' ? 'arrow-down' : 'arrow-up'}"></i>
      </div>
      <div class="tx-info">
        <h4>${esc(t.material_name || '-')}</h4>
        <p>${esc(t.handler || '-')} · ${fmtDateTime(t.transaction_date)}</p>
      </div>
      <div class="tx-qty ${t.type}">${t.type === 'in' ? '+' : '-'}${t.quantity}</div>
    </div>
  `).join('');
}

/* ─────────────────────────────
   제조사 매핑
───────────────────────────── */
async function buildManufacturerMap() {
  const tree = await CategoryAPI.getTree();
  const map = {};

  (tree || []).forEach(l1 => {
    const maker = (l1.name || '').trim();
    if (!maker) return;

    // 1단계 제조사 자신
    map[maker] = maker;

    // 2단계 유형
    (l1.children || []).forEach(l2 => {
      const l2Name = (l2.name || '').trim();
      if (l2Name) map[l2Name] = maker;

      // 3단계 모델
      (l2.children || []).forEach(l3 => {
        const l3Name = (l3.name || '').trim();
        if (l3Name) map[l3Name] = maker;
      });
    });
  });

  return map;
}

function getManufacturerName(material) {
  const category = (material?.category || '').trim();
  const map = window._dashManufacturerMap || {};

  if (!category) return '미분류';

  // 카테고리명이 정확히 등록된 항목과 일치할 때
  if (map[category]) return map[category];

  // 혹시 "제조사 > 유형" 같이 저장된 경우를 대비
  const normalized = category.split('>').map(v => v.trim()).filter(Boolean);
  for (const token of normalized) {
    if (map[token]) return map[token];
  }

  // 일부 데이터가 "제조사/유형", "제조사 - 유형" 같은 형식일 수도 있어 보정
  const tokenized = category
    .split(/[>/\-|]/)
    .map(v => v.trim())
    .filter(Boolean);

  for (const token of tokenized) {
    if (map[token]) return map[token];
  }

  return '미분류';
}

/* ─────────────────────────────
   전체 재고 현황 렌더
───────────────────────────── */
function renderDashTable(list) {
  const tbody = document.getElementById('materialsTableBody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:40px;color:#aaa">등록된 자재가 없습니다</td></tr>';
    return;
  }

  const grouped = groupMaterialsByManufacturer(list);
  const manufacturers = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ko'));

  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="padding:0;background:#fff">
        <div style="padding:12px">
          ${manufacturers.map(name => renderManufacturerSection(name, grouped[name])).join('')}
        </div>
      </td>
    </tr>
  `;
}

function groupMaterialsByManufacturer(list) {
  const grouped = {};

  list.forEach(m => {
    const maker = getManufacturerName(m);
    if (!grouped[maker]) grouped[maker] = [];
    grouped[maker].push(m);
  });

  Object.keys(grouped).forEach(key => {
    grouped[key].sort((a, b) => {
      const an = (a.name || '').localeCompare((b.name || ''), 'ko');
      if (an !== 0) return an;
      return (a.code || '').localeCompare((b.code || ''), 'ko');
    });
  });

  return grouped;
}

function renderManufacturerSection(name, items) {
  const sectionId = `maker_${slugify(name)}`;
  const totalStock = items.reduce((sum, m) => sum + Number(m.current_stock || 0), 0);
  const lowCount = items.filter(m => getStockStatus(m) !== 'ok').length;
  const hasKeyword = !!(document.getElementById('searchInput')?.value || '').trim();
  const defaultOpen = hasKeyword ? 'open' : '';

  return `
    <div class="dash-maker-group ${defaultOpen}" style="border:1px solid #e9ecef;border-radius:12px;overflow:hidden;margin-bottom:12px;background:#fff">
      <button
        type="button"
        onclick="toggleDashManufacturer('${sectionId}', this)"
        style="width:100%;border:none;background:#f8f9fa;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer"
      >
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <i class="fas fa-industry" style="color:var(--secondary)"></i>
          <strong style="font-size:.92rem;color:#1a1a2e">${esc(name)}</strong>
          <span class="badge badge-secondary">${items.length}개 자재</span>
          <span style="font-size:.78rem;color:#666">총 재고 ${totalStock}</span>
          ${lowCount > 0 ? `<span class="badge badge-warning">부족 ${lowCount}</span>` : ''}
        </div>
        <i class="fas fa-chevron-down dash-maker-chevron" style="color:#666;transition:transform .2s ease"></i>
      </button>

      <div id="${sectionId}" style="display:${hasKeyword ? 'block' : 'none'};border-top:1px solid #eef1f4;background:#fff">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:.84rem">
            <thead>
              <tr style="background:#fcfcfd">
                <th style="padding:12px 14px;text-align:left;border-bottom:1px solid #eef1f4;color:#666">자재코드</th>
                <th style="padding:12px 14px;text-align:left;border-bottom:1px solid #eef1f4;color:#666">자재명</th>
                <th style="padding:12px 14px;text-align:left;border-bottom:1px solid #eef1f4;color:#666">카테고리</th>
                <th style="padding:12px 14px;text-align:left;border-bottom:1px solid #eef1f4;color:#666">위치</th>
                <th style="padding:12px 14px;text-align:left;border-bottom:1px solid #eef1f4;color:#666">현재 재고</th>
                <th style="padding:12px 14px;text-align:left;border-bottom:1px solid #eef1f4;color:#666">최소 재고</th>
                <th style="padding:12px 14px;text-align:left;border-bottom:1px solid #eef1f4;color:#666">상태</th>
                <th style="padding:12px 14px;text-align:left;border-bottom:1px solid #eef1f4;color:#666">작업</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(m => renderManufacturerRow(m)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderManufacturerRow(m) {
  const st = getStockStatus(m);

  return `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid #f1f3f5">
        <code style="font-size:.75rem;background:#f0f2f5;padding:2px 6px;border-radius:4px">${esc(m.code || '-')}</code>
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid #f1f3f5">
        <strong>${esc(m.name || '-')}</strong>
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid #f1f3f5">
        <span style="font-size:.78rem;color:#666">${esc(m.category || '-')}</span>
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid #f1f3f5">${esc(m.location || '-')}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #f1f3f5">
        <strong>${m.current_stock ?? 0}</strong>
        <span style="font-size:.75rem;color:#888">${esc(m.unit || 'EA')}</span>
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid #f1f3f5">${m.min_stock ?? 0}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #f1f3f5">${statusBadgeHTML(st)}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #f1f3f5">
        <button class="btn btn-outline btn-sm" onclick="location.href='materials.html'">
          <i class="fas fa-edit"></i>
        </button>
      </td>
    </tr>
  `;
}

function toggleDashManufacturer(sectionId, btn) {
  const body = document.getElementById(sectionId);
  if (!body) return;

  const isOpen = body.style.display === 'block';
  body.style.display = isOpen ? 'none' : 'block';

  const icon = btn.querySelector('.dash-maker-chevron');
  if (icon) {
    icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  }

  const wrap = btn.closest('.dash-maker-group');
  if (wrap) wrap.classList.toggle('open', !isOpen);
}

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9가-힣_]/g, '');
}

/* ─────────────────────────────
   검색
───────────────────────────── */
function filterDashboardTable() {
  const keyword = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();

  const list = (window._dashMaterials || []).filter(m => {
    if (!keyword) return true;

    const maker = getManufacturerName(m).toLowerCase();

    return (
      (m.name || '').toLowerCase().includes(keyword) ||
      (m.code || '').toLowerCase().includes(keyword) ||
      (m.category || '').toLowerCase().includes(keyword) ||
      (m.location || '').toLowerCase().includes(keyword) ||
      maker.includes(keyword)
    );
  });

  renderDashTable(list);
}

// TOP 10 자주 사용 자재
async function loadTop10() {
  try {
    const txList = await TransactionAPI.getAll(9999);
    const countMap = {};

    txList.forEach(t => {
      if (!t.material_name) return;
      countMap[t.material_name] = (countMap[t.material_name] || 0) + t.quantity;
    });

    const top10 = Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const wrap = document.getElementById('top10List');
    if (!wrap) return;

    if (!top10.length) {
      wrap.innerHTML = '<div class="empty-state"><i class="fas fa-chart-bar"></i><p>입출고 이력이 없습니다</p></div>';
      return;
    }

    const max = top10[0][1];
    wrap.innerHTML = top10.map(([name, cnt], i) => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:24px;height:24px;border-radius:50%;background:${i < 3 ? 'var(--secondary)' : '#e9ecef'};
          color:${i < 3 ? '#fff' : '#666'};display:flex;align-items:center;justify-content:center;
          font-size:.75rem;font-weight:700;flex-shrink:0">${i + 1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
          <div style="background:#e9ecef;border-radius:4px;height:6px;margin-top:4px">
            <div style="width:${Math.round(cnt / max * 100)}%;background:${i < 3 ? 'var(--secondary)' : 'var(--gray-400)'};
              height:6px;border-radius:4px;transition:width .5s"></div>
          </div>
        </div>
        <div style="font-size:.85rem;font-weight:700;color:var(--secondary);flex-shrink:0">${cnt}</div>
      </div>
    `).join('');
  } catch (e) {
    console.error('TOP10 오류:', e);
  }
}