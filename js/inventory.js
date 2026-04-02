/* inventory.js */
let stockChartInst=null,statusChartInst=null,adjustTargetId=null;

document.addEventListener('DOMContentLoaded',()=>{loadInventory();bindInvEvents()});

async function loadInventory(){
  const mats=await MaterialAPI.getAll();
  renderInvStats(mats);
  renderInvCharts(mats);
  renderInvAlerts(mats);
  renderInvTable(mats);
}

function renderInvStats(mats){
  document.getElementById('invTotal').textContent=mats.length;
  document.getElementById('invNormal').textContent=mats.filter(m=>getStockStatus(m)==='ok').length;
  document.getElementById('invLow').textContent=mats.filter(m=>getStockStatus(m)==='low').length;
  document.getElementById('invCritical').textContent=mats.filter(m=>getStockStatus(m)==='critical').length;
}

function renderInvCharts(mats){
  const catMap={};
  mats.forEach(m=>{const c=m.category||'기타';if(!catMap[c])catMap[c]={cur:0,min:0};catMap[c].cur+=m.current_stock;catMap[c].min+=m.min_stock});
  const labels=Object.keys(catMap);
  const ctx1=document.getElementById('stockChart').getContext('2d');
  if(stockChartInst)stockChartInst.destroy();
  stockChartInst=new Chart(ctx1,{type:'bar',data:{labels,datasets:[{label:'현재 재고',data:labels.map(c=>catMap[c].cur),backgroundColor:'rgba(33,150,243,.75)',borderRadius:5},{label:'최소 재고',data:labels.map(c=>catMap[c].min),backgroundColor:'rgba(244,67,54,.45)',borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{family:'Noto Sans KR'}}}},scales:{y:{beginAtZero:true}}}});

  const ok=mats.filter(m=>getStockStatus(m)==='ok').length;
  const low=mats.filter(m=>getStockStatus(m)==='low').length;
  const crit=mats.filter(m=>getStockStatus(m)==='critical').length;
  const ctx2=document.getElementById('statusChart').getContext('2d');
  if(statusChartInst)statusChartInst.destroy();
  statusChartInst=new Chart(ctx2,{type:'doughnut',data:{labels:['정상','부족','없음'],datasets:[{data:[ok,low,crit],backgroundColor:['rgba(76,175,80,.8)','rgba(255,152,0,.8)','rgba(244,67,54,.8)'],borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:'65%'}});
  const lg=document.getElementById('statusLegend');
  if(lg)lg.innerHTML=[{l:'정상',c:'#4CAF50',v:ok},{l:'부족',c:'#FF9800',v:low},{l:'없음',c:'#f44336',v:crit}].map(x=>`<div style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:12px;border-radius:50%;background:${x.c};display:inline-block"></span><span>${x.l}: <strong>${x.v}</strong></span></div>`).join('');
}

function renderInvAlerts(mats){
  const list=mats.filter(m=>getStockStatus(m)!=='ok');
  document.getElementById('alertCount').textContent=list.length;
  const el=document.getElementById('alertList');
  if(!list.length){el.innerHTML='<div class="empty-state" style="padding:20px"><i class="fas fa-check-circle" style="color:#4CAF50"></i><p>재고 부족 자재 없음 🎉</p></div>';return}
  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:10px">${list.map(m=>{const st=getStockStatus(m);return`<div class="inv-alert-item ${st}"><div><h4 style="font-size:.88rem;font-weight:700;color:#333">${esc(m.name)}</h4><p style="font-size:.75rem;color:#888">${esc(m.code)} · ${esc(m.location||'-')}</p></div><div style="display:flex;align-items:center;gap:12px"><div style="text-align:right"><div style="font-size:1.05rem;font-weight:700;color:${st==='critical'?'#f44336':'#FF9800'}">${m.current_stock} ${esc(m.unit||'EA')}</div><div style="font-size:.72rem;color:#aaa">최소: ${m.min_stock}</div></div><a href="scan.html?barcode=${encodeURIComponent(m.barcode)}&mode=in" class="btn btn-sm btn-success"><i class="fas fa-arrow-down"></i> 빠른 입고</a></div></div>`}).join('')}</div>`;
}

async function renderInvTable(mats){
  if(!mats)mats=await MaterialAPI.getAll();
  const q=document.getElementById('invSearch').value.toLowerCase();
  const cat=document.getElementById('invCategory').value;
  const stat=document.getElementById('invStatus').value;
  let list=mats.filter(m=>{
    const mq=!q||m.name.toLowerCase().includes(q)||m.code.toLowerCase().includes(q)||(m.location||'').toLowerCase().includes(q);
    const mc=!cat||m.category===cat;
    const ms=!stat||getStockStatus(m)===stat;
    return mq&&mc&&ms;
  });
  const tbody=document.getElementById('invTableBody');
  if(!list.length){tbody.innerHTML='<tr><td colspan="9" class="text-center" style="padding:30px;color:#aaa">검색 결과 없음</td></tr>';return}
  const txAll=await TransactionAPI.getAll(200);
  tbody.innerHTML=list.map(m=>{
    const st=getStockStatus(m);
    const pct=m.min_stock>0?Math.min(100,Math.round(m.current_stock/m.min_stock*100)):100;
    const bc=st==='ok'?'#4CAF50':st==='low'?'#FF9800':'#f44336';
    const lastTx=txAll.find(t=>t.material_id===m.id);
    return`<tr><td><code style="font-size:.78rem;background:#f0f2f5;padding:2px 6px;border-radius:4px">${esc(m.code)}</code></td><td><strong>${esc(m.name)}</strong></td><td><span class="badge badge-secondary">${esc(m.category||'-')}</span></td><td>${esc(m.location||'-')}</td><td><div style="display:flex;align-items:center;gap:8px"><strong style="min-width:28px">${m.current_stock}</strong><div style="flex:1;height:6px;background:#eee;border-radius:3px;min-width:60px"><div style="width:${pct}%;height:100%;background:${bc};border-radius:3px"></div></div><small style="color:#aaa">${esc(m.unit||'EA')}</small></div></td><td>${m.min_stock} ${esc(m.unit||'EA')}</td><td>${statusBadgeHTML(st)}</td><td style="font-size:.78rem;color:#888">${lastTx?fmtDateTime(lastTx.transaction_date):'-'}</td><td><div style="display:flex;gap:4px"><a href="scan.html?barcode=${encodeURIComponent(m.barcode)}" class="btn btn-sm btn-primary" title="스캔"><i class="fas fa-barcode"></i></a><button class="btn btn-sm btn-warning" onclick="openAdjust('${m.id}')" title="재고조정"><i class="fas fa-sliders-h"></i></button></div></td></tr>`;
  }).join('');
}

function bindInvEvents(){
  ['invSearch','invCategory','invStatus'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>loadInventory()));
  document.getElementById('refreshBtn')?.addEventListener('click',()=>{loadInventory();showToast('새로고침 완료','success')});
  const catSel=document.getElementById('invCategory');
  if(catSel)MaterialAPI.getAll().then(mats=>{const cats=[...new Set(mats.map(m=>m.category).filter(Boolean))].sort();cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;catSel.appendChild(o)})});
  document.getElementById('closeAdjustModal')?.addEventListener('click',()=>closeOverlay('adjustModal'));
  document.getElementById('cancelAdjust')?.addEventListener('click',()=>closeOverlay('adjustModal'));
  document.getElementById('confirmAdjust')?.addEventListener('click',doAdjust);
  bindModalOverlayClose(['adjustModal']);
}

async function openAdjust(id){
  const mat=await MaterialAPI.getById(id);if(!mat)return;
  adjustTargetId=id;
  document.getElementById('adjustMatName').textContent=mat.name;
  document.getElementById('adjustMatCode').textContent=mat.code+' · '+(mat.location||'-');
  document.getElementById('adjustQty').value=mat.current_stock;
  document.getElementById('adjustReason').value='';
  openOverlay('adjustModal');
}

async function doAdjust(){
  if(!adjustTargetId)return;
  const newQty=parseInt(document.getElementById('adjustQty').value);
  const reason=document.getElementById('adjustReason').value.trim()||'재고 실사 조정';
  if(isNaN(newQty)||newQty<0){showToast('올바른 수량을 입력하세요','warning');return}
  const mat=await MaterialAPI.getById(adjustTargetId);if(!mat)return;
  const diff=newQty-mat.current_stock;
  const btn=document.getElementById('confirmAdjust');btn.disabled=true;
  try{
    await MaterialAPI.updateStock(adjustTargetId,newQty);
    if(diff!==0)await TransactionAPI.add({material_id:mat.id,barcode:mat.barcode,material_name:mat.name,material_code:mat.code,type:diff>0?'in':'out',quantity:Math.abs(diff),stock_after:newQty,handler:'관리자',note:reason});
    showToast(`재고 조정 완료: ${mat.name} → ${newQty} ${mat.unit||'EA'}`,'success');
    closeOverlay('adjustModal');adjustTargetId=null;await loadInventory();
  }catch(e){showToast('조정 오류: '+e.message,'error')}
  finally{btn.disabled=false}
}
