/* transactions.js */
let txChart=null,catChart=null,currentPage=1;
const PAGE_SIZE=15;

document.addEventListener('DOMContentLoaded',()=>loadTx());

async function loadTx(){
  await renderTxStats();
  await renderTxCharts();
  await renderTxTable();
  bindTxFilters();
}

async function renderTxStats(){
  const all=await TransactionAPI.getAll();
  document.getElementById('statTotal').textContent=all.length;
  document.getElementById('statIn').textContent=all.filter(t=>t.type==='in').length;
  document.getElementById('statOut').textContent=all.filter(t=>t.type==='out').length;
  document.getElementById('statHandlers').textContent=new Set(all.map(t=>t.handler).filter(Boolean)).size;
}

async function renderTxCharts(){
  const last7=await TransactionAPI.getLast7Days();
  const days=[],inD=[],outD=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);days.push(k.slice(5));inD.push(last7.filter(t=>t.transaction_date.startsWith(k)&&t.type==='in').length);outD.push(last7.filter(t=>t.transaction_date.startsWith(k)&&t.type==='out').length)}
  const ctx1=document.getElementById('txChart').getContext('2d');
  if(txChart)txChart.destroy();
  txChart=new Chart(ctx1,{type:'bar',data:{labels:days,datasets:[{label:'입고',data:inD,backgroundColor:'rgba(76,175,80,.75)',borderRadius:5},{label:'출고',data:outD,backgroundColor:'rgba(255,152,0,.75)',borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{family:'Noto Sans KR'}}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}});

  const all=await TransactionAPI.getAll();
  const outs=all.filter(t=>t.type==='out');
  const mats=await MaterialAPI.getAll();
  const mm=Object.fromEntries(mats.map(m=>[m.id,m]));
  const catMap={};
  outs.forEach(tx=>{const cat=mm[tx.material_id]?.category||'기타';catMap[cat]=(catMap[cat]||0)+tx.quantity});
  const labels=Object.keys(catMap),data=Object.values(catMap);
  const colors=['#2196F3','#4CAF50','#FF9800','#f44336','#9C27B0','#00BCD4','#FF5722','#795548'];
  const ctx2=document.getElementById('catChart').getContext('2d');
  if(catChart)catChart.destroy();
  if(labels.length){catChart=new Chart(ctx2,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors.slice(0,labels.length),borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{family:'Noto Sans KR'},boxWidth:14}}}}})}
  else{const c=ctx2;c.fillStyle='#bbb';c.textAlign='center';c.font='14px Noto Sans KR';c.fillText('출고 이력 없음',ctx2.canvas.width/2,ctx2.canvas.height/2)}
}

function bindTxFilters(){
  ['txSearch','txTypeFilter','dateFrom','dateTo'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>{currentPage=1;renderTxTable()}));
  document.getElementById('resetFilter')?.addEventListener('click',()=>{document.getElementById('txSearch').value='';document.getElementById('txTypeFilter').value='';document.getElementById('dateFrom').value='';document.getElementById('dateTo').value='';currentPage=1;renderTxTable()});
}

async function renderTxTable(){
  const q=document.getElementById('txSearch').value.toLowerCase();
  const type=document.getElementById('txTypeFilter').value;
  const from=document.getElementById('dateFrom').value;
  const to=document.getElementById('dateTo').value;
  const all=await TransactionAPI.getAll();
  const mats=await MaterialAPI.getAll();
  const mm=Object.fromEntries(mats.map(m=>[m.id,m]));
  let list=all.filter(tx=>{
    const name=(mm[tx.material_id]?.name||tx.material_name||'').toLowerCase();
    const handler=(tx.handler||'').toLowerCase();
    const mq=!q||name.includes(q)||handler.includes(q)||(tx.note||'').toLowerCase().includes(q);
    const mt=!type||tx.type===type;
    const td=tx.transaction_date?.slice(0,10);
    const mf=!from||td>=from;
    const mto=!to||td<=to;
    return mq&&mt&&mf&&mto;
  });
  const total=list.length,pages=Math.ceil(total/PAGE_SIZE)||1;
  if(currentPage>pages)currentPage=pages;
  const paged=list.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  const tbody=document.getElementById('txTableBody');
  if(!paged.length){tbody.innerHTML='<tr><td colspan="8" class="text-center" style="padding:30px;color:#aaa">이력이 없습니다</td></tr>'}
  else{
    tbody.innerHTML=paged.map(tx=>{const m=mm[tx.material_id];return`<tr><td>${tx.type==='in'?'<span class="type-in"><i class="fas fa-arrow-down"></i> 입고</span>':'<span class="type-out"><i class="fas fa-arrow-up"></i> 출고</span>'}</td><td><strong>${esc(m?.name||tx.material_name||'-')}</strong></td><td><code style="font-size:.78rem;background:#f0f2f5;padding:2px 6px;border-radius:4px">${esc(m?.code||tx.material_code||'-')}</code></td><td><strong style="color:${tx.type==='in'?'#2e7d32':'#e65100'}">${tx.type==='in'?'+':'-'}${tx.quantity}</strong> <small>${esc(m?.unit||'EA')}</small></td><td>${tx.stock_after??'-'} ${esc(m?.unit||'EA')}</td><td>${esc(tx.handler||'-')}</td><td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(tx.note||'-')}</td><td style="white-space:nowrap;font-size:.8rem">${fmtDateTime(tx.transaction_date)}</td></tr>`}).join('');
  }
  const pg=document.getElementById('txPagination');
  if(pages<=1){pg.innerHTML='';return}
  let h=`<button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
  for(let i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-currentPage)<=1)h+=`<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;else if(Math.abs(i-currentPage)===2)h+=`<span style="padding:0 4px;color:#aaa">…</span>`}
  h+=`<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage===pages?'disabled':''}>›</button>`;
  h+=`<span style="font-size:.78rem;color:#aaa;margin-left:8px">총 ${total}건</span>`;
  pg.innerHTML=h;
}

function goPage(p){currentPage=p;renderTxTable()}
