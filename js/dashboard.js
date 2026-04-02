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

    // 전체 재고 테이블
    window._dashMaterials = materials;
    renderDashTable(materials);

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

function renderDashTable(list) {
  const tbody = document.getElementById('materialsTableBody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:40px;color:#aaa">등록된 자재가 없습니다</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(m => {
    const st = getStockStatus(m);
    return `<tr>
      <td><code style="font-size:.75rem;background:#f0f2f5;padding:2px 6px;border-radius:4px">${esc(m.code || '-')}</code></td>
      <td><strong>${esc(m.name)}</strong></td>
      <td><span style="font-size:.78rem">${esc(m.category || '-')}</span></td>
      <td>${esc(m.location || '-')}</td>
      <td><strong>${m.current_stock ?? 0}</strong> <span style="font-size:.75rem;color:#888">${esc(m.unit || 'EA')}</span></td>
      <td>${m.min_stock ?? 0}</td>
      <td>${statusBadgeHTML(st)}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="location.href='materials.html'">
          <i class="fas fa-edit"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function filterDashboardTable() {
  const keyword = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const list = (window._dashMaterials || []).filter(m =>
    (m.name || '').toLowerCase().includes(keyword) ||
    (m.code || '').toLowerCase().includes(keyword)
  );
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
  } catch (e) { console.error('TOP10 오류:', e); }
}