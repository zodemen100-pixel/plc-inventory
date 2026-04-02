/* scan.js */
let scanMode='in',currentMat=null,html5QrCode=null;
let cameraActive=false,scanCooldown=false,sessionHistory=[];

document.addEventListener('DOMContentLoaded',()=>initScanPage());

async function initScanPage(){
  await loadHandlerSelect();
  document.getElementById('qtyMinus').addEventListener('click',()=>{const i=document.getElementById('quantityInput');i.value=Math.max(1,(parseInt(i.value)||1)-1)});
  document.getElementById('qtyPlus').addEventListener('click',()=>{const i=document.getElementById('quantityInput');i.value=(parseInt(i.value)||1)+1});
  const bi=document.getElementById('barcodeInput');
  bi.addEventListener('keydown',e=>{if(e.key==='Enter'){const v=bi.value.trim();if(v){processBarcode(v);bi.value=''}}});
  document.getElementById('clearScanBtn').addEventListener('click',resetScan);
  document.getElementById('submitBtn').addEventListener('click',submitTransaction);
  document.getElementById('clearHistoryBtn').addEventListener('click',()=>{sessionHistory=[];renderHistory()});
  const p=new URLSearchParams(location.search);
  if(p.get('barcode'))setTimeout(()=>processBarcode(p.get('barcode')),400);
  if(p.get('mode'))setMode(p.get('mode'));
  bi.focus();
}

async function loadHandlerSelect(){
  const sel=document.getElementById('handlerSelect');if(!sel)return;
  sel.innerHTML='<option value="">-- 담당자 선택 (필수) --</option>';
  try{
    const list=await HandlerAPI.getAll();
    list.forEach(h=>{const o=document.createElement('option');o.value=h.name;o.textContent=`${h.name}${h.department?' ('+h.department+')':''}`;sel.appendChild(o)});
    const saved=localStorage.getItem('lastHandler');
    if(saved)sel.value=saved;
  }catch(e){console.warn(e)}
}

function setMode(mode){
  if(mode!=='in'&&mode!=='out')return;
  scanMode=mode;
  document.getElementById('modeBtnIn').classList.toggle('active',mode==='in');
  document.getElementById('modeBtnOut').classList.toggle('active',mode==='out');
  document.getElementById('barcodeInput').className=`scan-big-input mode-${mode}`;
  if(currentMat)updateSubmitBtn();
}

function toggleCamera(){cameraActive?stopCamera():startCamera()}

function startCamera(){
  if(html5QrCode){html5QrCode.stop().catch(()=>{}).finally(()=>{html5QrCode.clear();html5QrCode=null;_doStart()})}
  else _doStart();
}

function _doStart(){
  document.getElementById('cameraWrapper').classList.add('active');
  document.getElementById('startCameraBtn').innerHTML='<i class="fas fa-stop-circle"></i> 카메라 중지';
  setStatus('<i class="fas fa-spinner fa-spin"></i> 카메라 시작 중...','info');
  try{html5QrCode=new Html5Qrcode('qr-reader',{verbose:false})}
  catch(e){setStatus('❌ 초기화 실패','error');_cleanup();return}
  const cfg={fps:10,qrbox:{width:260,height:160},aspectRatio:1.7};
  html5QrCode.start({facingMode:'environment'},cfg,onScanOK,()=>{})
    .then(()=>{cameraActive=true;setStatus('📷 스캔 준비 완료 — 바코드/QR을 비춰주세요','ready');insertGuide()})
    .catch(()=>{
      html5QrCode.start({facingMode:'user'},cfg,onScanOK,()=>{})
        .then(()=>{cameraActive=true;setStatus('📷 스캔 준비 완료 (전면 카메라)','ready');insertGuide()})
        .catch(err=>{
          setStatus('❌ 카메라 오류: '+(err.message||err),'error');_cleanup();
          if(location.protocol!=='https:'&&location.hostname!=='localhost')showToast('카메라는 HTTPS에서만 동작합니다','warning');
          else showToast('카메라 접근 권한을 허용해주세요','error');
        });
    });
}

function onScanOK(txt){
  if(scanCooldown)return;scanCooldown=true;
  setStatus(`✅ 인식: ${txt}`,'success');
  processBarcode(txt);
  setTimeout(()=>{scanCooldown=false;if(cameraActive)setStatus('📷 스캔 준비 완료','ready')},1500);
}

function stopCamera(){
  if(html5QrCode&&cameraActive)html5QrCode.stop().catch(()=>{}).finally(()=>{html5QrCode=null;_cleanup()});
  else _cleanup();
}

function _cleanup(){
  cameraActive=false;
  document.getElementById('cameraWrapper').classList.remove('active');
  document.getElementById('startCameraBtn').innerHTML='<i class="fas fa-camera"></i> 카메라 스캔 (QR·바코드)';
  document.querySelector('.scan-guide-box')?.remove();
  const r=document.getElementById('qr-reader');if(r)r.innerHTML='';
}

function setStatus(msg,type){
  const el=document.getElementById('scanStatus');if(!el)return;
  const c={info:'rgba(255,255,255,.65)',ready:'#a5d6a7',success:'#80cbc4',error:'#ef9a9a'};
  el.style.color=c[type]||c.info;el.innerHTML=msg;
}

function insertGuide(){
  const w=document.querySelector('.scan-overlay-wrap');
  if(!w||w.querySelector('.scan-guide-box'))return;
  const b=document.createElement('div');b.className='scan-guide-box';
  const l=document.createElement('div');l.className='scan-line';
  b.appendChild(l);w.appendChild(b);
}

async function processBarcode(bc){
  const mat=await MaterialAPI.getByBarcode(bc.trim());
  currentMat=mat;
  if(!mat){
    document.getElementById('scanResultArea').innerHTML=`<div class="result-card not-found"><div class="result-header"><div class="result-icon error"><i class="fas fa-times-circle"></i></div><div><div class="result-title">자재를 찾을 수 없습니다</div><div class="result-sub">${esc(bc)}</div></div></div><a href="materials.html" class="btn btn-sm btn-primary"><i class="fas fa-plus"></i> 자재 등록</a></div>`;
    document.getElementById('txDetailCard').style.display='none';
    showToast('등록되지 않은 바코드입니다','warning');return;
  }
  const isIn=scanMode==='in',st=getStockStatus(mat);
  const sc=(!isIn&&mat.current_stock<=mat.min_stock)?'#f44336':'#333';
  const warn=(!isIn&&mat.current_stock<=mat.min_stock)?`<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:8px 12px;font-size:.8rem;color:#856404;margin-top:8px"><i class="fas fa-exclamation-triangle"></i> 재고 부족 경고</div>`:'';
  document.getElementById('scanResultArea').innerHTML=`<div class="result-card ${isIn?'found-in':'found-out'}"><div class="result-header"><div class="result-icon ${isIn?'in':'out'}"><i class="fas fa-arrow-${isIn?'down':'up'}"></i></div><div style="flex:1"><div class="result-title">${esc(mat.name)}</div><div class="result-sub">${esc(mat.code)} · ${esc(mat.location||'-')}</div></div>${statusBadgeHTML(st)}</div><div class="result-details"><div class="detail-item"><div class="label">카테고리</div><div class="value">${esc(mat.category||'-')}</div></div><div class="detail-item"><div class="label">현재 재고</div><div class="value" style="color:${sc}">${mat.current_stock} ${esc(mat.unit||'EA')}</div></div><div class="detail-item"><div class="label">최소 재고</div><div class="value">${mat.min_stock} ${esc(mat.unit||'EA')}</div></div><div class="detail-item"><div class="label">버전</div><div class="value">${esc(mat.version||'-')}</div></div></div>${warn}</div>`;
  const card=document.getElementById('txDetailCard');
  card.style.display='block';
  document.getElementById('quantityInput').value=1;
  document.getElementById('unitLabel').textContent=mat.unit||'EA';
  document.getElementById('noteInput').value='';
  updateSubmitBtn();
  card.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function updateSubmitBtn(){
  const btn=document.getElementById('submitBtn'),text=document.getElementById('submitBtnText');
  if(scanMode==='in'){btn.style.background='#4CAF50';text.textContent='입고 처리';btn.querySelector('i').className='fas fa-arrow-down'}
  else{btn.style.background='#FF9800';text.textContent='출고 처리';btn.querySelector('i').className='fas fa-arrow-up'}
}

async function submitTransaction(){
  if(!currentMat){showToast('먼저 바코드를 스캔하세요','warning');return}
  const qty=parseInt(document.getElementById('quantityInput').value)||1;
  const handler=document.getElementById('handlerSelect').value.trim();
  const note=document.getElementById('noteInput').value.trim();
  if(!handler){
    showToast('담당자를 선택하세요 (필수)','error');
    const sel=document.getElementById('handlerSelect');
    sel.style.borderColor='#f44336';sel.focus();
    setTimeout(()=>sel.style.borderColor='',2000);return;
  }
  if(qty<=0){showToast('수량은 1 이상이어야 합니다','warning');return}
  if(scanMode==='out'&&currentMat.current_stock<qty){showToast(`재고 부족! 현재: ${currentMat.current_stock} ${currentMat.unit||'EA'}`,'error');return}
  const btn=document.getElementById('submitBtn');btn.disabled=true;
  try{
    const newStock=scanMode==='in'?currentMat.current_stock+qty:currentMat.current_stock-qty;
    await MaterialAPI.updateStock(currentMat.id,newStock);
    const tx=await TransactionAPI.add({material_id:currentMat.id,barcode:currentMat.barcode,material_name:currentMat.name,material_code:currentMat.code,type:scanMode,quantity:qty,stock_after:newStock,handler,note});
    localStorage.setItem('lastHandler',handler);
    sessionHistory.unshift({tx,mat:{...currentMat},qty});
    renderHistory();
    showToast(`${scanMode==='in'?'✅ 입고':'📤 출고'} 완료! ${currentMat.name} ${qty}${currentMat.unit||'EA'}`,'success');
    const ov=document.getElementById('successOverlay');
    ov.style.cssText='display:flex;position:fixed;inset:0;background:rgba(76,175,80,.15);z-index:9998;align-items:center;justify-content:center;font-size:5rem;color:#4CAF50;animation:fadeOut 1s ease forwards';
    setTimeout(()=>{ov.style.display='none';ov.style.animation=''},1000);
    resetScan();
    document.getElementById('handlerSelect').value=handler;
  }catch(e){showToast('처리 오류: '+e.message,'error')}
  finally{btn.disabled=false}
}

function renderHistory(){
  const el=document.getElementById('sessionHistory');
  if(!sessionHistory.length){el.innerHTML='<div style="text-align:center;padding:40px;color:#ccc"><i class="fas fa-history" style="font-size:1.8rem;display:block;margin-bottom:10px"></i><p style="font-size:.85rem">스캔 이력이 없습니다</p></div>';return}
  el.innerHTML=sessionHistory.map(({tx,mat,qty})=>`<div class="scan-history-item"><div class="scan-history-badge ${tx.type}"><i class="fas fa-arrow-${tx.type==='in'?'down':'up'}"></i></div><div class="scan-history-info"><h4>${esc(mat.name)}</h4><p>${fmtDateTime(tx.transaction_date)} · ${esc(tx.handler)} · 후: ${tx.stock_after}${esc(mat.unit||'EA')}</p></div><div class="scan-history-qty ${tx.type}">${tx.type==='in'?'+':'-'}${qty}</div></div>`).join('');
}

function resetScan(){
  currentMat=null;
  document.getElementById('txDetailCard').style.display='none';
  document.getElementById('scanResultArea').innerHTML='<div class="result-card"><div style="text-align:center;color:#bbb;padding:24px 12px"><i class="fas fa-barcode" style="font-size:2.2rem;display:block;margin-bottom:10px"></i><p style="font-size:.9rem">카메라 또는 스캐너로 바코드/QR을 스캔하세요</p></div></div>';
  document.getElementById('barcodeInput').value='';
  document.getElementById('quantityInput').value=1;
  document.getElementById('noteInput').value='';
  document.getElementById('barcodeInput').focus();
}
