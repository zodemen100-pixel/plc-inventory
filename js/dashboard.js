/* dashboard.js */
document.addEventListener('DOMContentLoaded',()=>{loadDashboard()});

async function loadDashboard(){
  const[mats,todayTxs]=await Promise.all([MaterialAPI.getAll(),TransactionAPI.getToday()]);
  setText('totalMaterials',mats.length);
  setText('todayIn',todayTxs.filter(t=>t.type==='in').length);
  setText('todayOut',todayTxs.filter(t=>t.type==='out').length);
  setText('lowStock',mats.filter(m=>getStockStatus(m)!=='ok').length);
  renderLowStock(mats);
  await renderRecentTx();
  renderStockTable(mats,'');
  document.getElementById('searchInput')?.addEventListener('input',function(){renderStockTable(mats,this.value)});
}

function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=v}

function renderLowStock(mats){
  const el=document.getElementById('lowStockList');if(!el)return;
  const list=mats.filter(m=>getStockStatus(m)!=='ok');
  if(!list.length){el.innerHTML='<div class="empty-state"><i class="fas fa-check-circle" style="color:#4CAF50"></i><p>재고 부족 자재 없음 🎉</p></div>';return}
  el.innerHTML=list.map(m=>{const st=getStockStatus(m);return`<div class="alert-item"><div class="alert-info"><h4>${esc(m.name)}</h4><p>${esc(m.code)} · ${esc(m.location||'-')}</p></div><div class="alert-stock"><div class="current" style="color:${st==='critical'?'#f44336':'#FF9800'}">${m.current_stock} ${esc(m.unit||'EA')}</div><div class="min">최소: ${m.min_stock} ${esc(m.unit||'EA')}</div></div></div>`}).join('')
}

async function renderRecentTx(){
  const el=document.getElementById('recentTransactions');if(!el)return;
  const txs=await TransactionAPI.getAll(8);
  if(!txs.length){el.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>입출고 이력이 없습니다</p></div>';return}
  const mats=await MaterialAPI.getAll();
  const mm=Object.fromEntries(mats.map(m=>[m.id,m]));
  el.innerHTML=txs.map(tx=>{const m=mm[tx.material_id];return`<div class="tx-item"><div class="tx-badge ${tx.type}"><i class="fas fa-arrow-${tx.type==='in'?'down':'up'}"></i></div><div class="tx-info"><h4>${esc(m?.name||tx.material_name||'-')}</h4><p>${fmtDateTime(tx.transaction_date)} · ${esc(tx.handler||'-')}</p></div><div class="tx-qty ${tx.type}">${tx.type==='in'?'+':'-'}${tx.quantity}</div></div>`}).join('')
}

function renderStockTable(mats,q){
  const tbody=document.getElementById('materialsTableBody');if(!tbody)return;
  const list=q?mats.filter(m=>m.name.toLowerCase().includes(q.toLowerCase())||m.code.toLowerCase().includes(q.toLowerCase())):mats;
  if(!list.length){tbody.innerHTML='<tr><td colspan="8" class="text-center" style="padding:30px;color:#aaa">검색 결과 없음</td></tr>';return}
  tbody.innerHTML=list.map(m=>{const st=getStockStatus(m);return`<tr><td><code style="font-size:.8rem;background:#f0f2f5;padding:2px 7px;border-radius:5px">${esc(m.code)}</code></td><td><strong>${esc(m.name)}</strong></td><td><span class="badge badge-secondary">${esc(m.category||'-')}</span></td><td>${esc(m.location||'-')}</td><td><strong>${m.current_stock} ${esc(m.unit||'EA')}</strong></td><td>${m.min_stock} ${esc(m.unit||'EA')}</td><td>${statusBadgeHTML(st)}</td><td><a href="scan.html?barcode=${encodeURIComponent(m.barcode)}" class="btn btn-sm btn-primary"><i class="fas fa-barcode"></i></a></td></tr>`}).join('')
}
