/* =====================================================
   common.js
   ★ SUPABASE_URL과 SUPABASE_KEY를 본인 값으로 교체하세요
   ===================================================== */
const SUPABASE_URL = 'https://cksluvcnpbtwtywypvkk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrc2x1dmNucGJ0d3R5d3lwdmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDM3MDcsImV4cCI6MjA5MDY3OTcwN30.fJVL1_bBotlaqj_04AnLv7t2VQBQlXMZ4NMtPoKcT-s';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── 유틸 ── */
function uuid(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16)})}
function fmtDate(s){if(!s)return'-';return new Date(s).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'})}
function fmtDateTime(s){if(!s)return'-';return new Date(s).toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function todayStr(){return new Date().toISOString().slice(0,10)}
function esc(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

/* ── 토스트 ── */
function showToast(msg,type='info'){
  let wrap=document.getElementById('toastWrap');
  if(!wrap){wrap=document.createElement('div');wrap.id='toastWrap';wrap.style.cssText='position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';document.body.appendChild(wrap)}
  const colors={success:'#4CAF50',error:'#f44336',warning:'#FF9800',info:'#2196F3'};
  const icons={success:'fa-check-circle',error:'fa-times-circle',warning:'fa-exclamation-circle',info:'fa-info-circle'};
  const t=document.createElement('div');
  t.style.cssText=`background:#fff;border-left:4px solid ${colors[type]||colors.info};padding:12px 18px;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.15);display:flex;align-items:center;gap:10px;font-size:.875rem;font-family:'Noto Sans KR',sans-serif;max-width:320px;min-width:220px;pointer-events:auto;animation:toastIn .3s ease`;
  t.innerHTML=`<i class="fas ${icons[type]||icons.info}" style="color:${colors[type]};flex-shrink:0"></i><span>${msg}</span>`;
  if(!document.getElementById('toastStyle')){const s=document.createElement('style');s.id='toastStyle';s.textContent='@keyframes toastIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}';document.head.appendChild(s)}
  wrap.appendChild(t);setTimeout(()=>t.remove(),3200)
}

/* ── 날짜 ── */
function setCurrentDate(){const el=document.getElementById('currentDate');if(el)el.textContent=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'})}

/* ── 사이드바 ── */
function initSidebar() {
  // 현재 페이지 메뉴 활성화
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.menu-item a').forEach(a => {
    a.parentElement.classList.toggle('active', a.getAttribute('href') === path);
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
    if (overlay) overlay.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('open');
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) closeSidebar();
});

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('open');
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) closeSidebar();
});

// 화면 크기 변경 시 처리
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    closeSidebar();
  }
});


/* ── 모달 드래그 버그 수정 ── */
function bindModalOverlayClose(ids){
  ids.forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.addEventListener('mousedown',function(e){el._mbg=(e.target===el)});
    el.addEventListener('click',function(e){if(e.target===el&&el._mbg)closeOverlay(id);el._mbg=false});
  });
}
function openOverlay(id){document.getElementById(id)?.classList.add('open')}
function closeOverlay(id){document.getElementById(id)?.classList.remove('open')}

/* ── 재고 상태 ── */
function getStockStatus(m){if(m.current_stock<=0)return'critical';if(m.current_stock<m.min_stock)return'low';return'ok'}
function statusBadgeHTML(s){return{ok:'<span class="status-badge status-ok">정상</span>',low:'<span class="status-badge status-low">부족</span>',critical:'<span class="status-badge status-critical">없음</span>'}[s]||''}

/* ══════════════════════════════════════════════════════
   MaterialAPI
══════════════════════════════════════════════════════ */
const MaterialAPI={
  async getAll(){
    const{data,error}=await sb.from('materials').select('*').eq('status','active').order('created_at',{ascending:false});
    if(error){console.error('materials getAll:',error);return[]}
    window._matCache=data||[];return window._matCache
  },
  async getById(id){
    const{data,error}=await sb.from('materials').select('*').eq('id',id).single();
    if(error)return null;return data
  },
  async getByBarcode(bc){
    const{data,error}=await sb.from('materials').select('*').eq('barcode',bc).single();
    if(error)return null;return data
  },
  async getByCode(code){
  const { data, error } = await sb
    .from('materials')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error) throw error;
  return data;
},

  async save(mat){
  const { data, error } = await sb
    .from('materials')
    .upsert(mat, { onConflict:'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
  },
  async delete(id){
    const{error}=await sb.from('materials').update({status:'inactive'}).eq('id',id);
    if(error)throw error
  },
  async updateStock(id,newStock){
    const{data,error}=await sb.from('materials').update({current_stock:Math.max(0,newStock)}).eq('id',id).select().single();
    if(error)throw error;return data
  }
};

/* ══════════════════════════════════════════════════════
   TransactionAPI
══════════════════════════════════════════════════════ */
const TransactionAPI={
  async getAll(limit=500){
    const{data,error}=await sb.from('transactions').select('*').order('transaction_date',{ascending:false}).limit(limit);
    if(error)return[];return data||[]
  },
  async add(tx){
    tx.id=uuid();tx.transaction_date=new Date().toISOString();
    const{data,error}=await sb.from('transactions').insert(tx).select().single();
    if(error)throw error;return data
  },
  async getByMaterial(id){
    const{data,error}=await sb.from('transactions').select('*').eq('material_id',id).order('transaction_date',{ascending:false}).limit(10);
    if(error)return[];return data||[]
  },
  async getToday(){
    const s=new Date();s.setHours(0,0,0,0);
    const e=new Date();e.setHours(23,59,59,999);
    const{data,error}=await sb.from('transactions').select('*').gte('transaction_date',s.toISOString()).lte('transaction_date',e.toISOString());
    if(error)return[];return data||[]
  },
  async getLast7Days(){
    const c=new Date();c.setDate(c.getDate()-6);c.setHours(0,0,0,0);
    const{data,error}=await sb.from('transactions').select('*').gte('transaction_date',c.toISOString()).order('transaction_date',{ascending:false});
    if(error)return[];return data||[]
  }
};

/* ══════════════════════════════════════════════════════
   CategoryAPI
══════════════════════════════════════════════════════ */
const CategoryAPI={
  _cache:null,
  async getAll(force=false){
    if(this._cache&&!force)return this._cache;
    const{data,error}=await sb.from('categories').select('*').order('level',{ascending:true}).order('sort_order',{ascending:true}).order('name',{ascending:true});
    if(error)return[];this._cache=data||[];return this._cache
  },
  async getLevel1(){return(await this.getAll()).filter(c=>c.level===1)},
  async getChildren(pid){return(await this.getAll()).filter(c=>c.parent_id===pid)},
  async getById(id){return(await this.getAll()).find(c=>c.id===id)||null},
  async save(cat){
    const{data,error}=await sb.from('categories').upsert(cat,{onConflict:'id'}).select().single();
    if(error)throw error;this._cache=null;return data
  },
  async delete(id){
    const{error}=await sb.from('categories').delete().eq('id',id);
    if(error)throw error;this._cache=null
  },
  async getTree(){
    const all=await this.getAll();
    return all.filter(c=>c.level===1).map(p1=>({...p1,children:all.filter(c=>c.parent_id===p1.id).map(p2=>({...p2,children:all.filter(c=>c.parent_id===p2.id)}))}))
  }
};

/* ══════════════════════════════════════════════════════
   HandlerAPI
══════════════════════════════════════════════════════ */
const HandlerAPI={
  async getAll(){
    const{data,error}=await sb.from('handlers').select('*').eq('active',true).order('sort_order',{ascending:true}).order('name',{ascending:true});
    if(error)return[];return data||[]
  },
  async save(h){
    const{data,error}=await sb.from('handlers').upsert(h,{onConflict:'id'}).select().single();
    if(error)throw error;return data
  },
  async delete(id){
    const{error}=await sb.from('handlers').update({active:false}).eq('id',id);
    if(error)throw error
  }
};

document.addEventListener('DOMContentLoaded',()=>{setCurrentDate();initSidebar()});
