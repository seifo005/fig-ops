// modules/lots.js
export function initLotsUI(store){
  const tbody = document.querySelector('#lotsTable tbody');
  const selVar = document.getElementById('lot_variety');
  const method = document.getElementById('lot_method');
  const start  = document.getElementById('lot_start');
  const check  = document.getElementById('lot_check');
  const qtyT   = document.getElementById('lot_qty_total');
  const qtyR   = document.getElementById('lot_qty_rooted');
  const mix    = document.getElementById('lot_mix');
  const temp   = document.getElementById('lot_temp');
  const hum    = document.getElementById('lot_humidity');
  const notes  = document.getElementById('lot_notes');
  const save   = document.getElementById('saveLotBtn');
  const reset  = document.getElementById('resetLotBtn');
  const hint   = document.getElementById('lot_edit_hint');
  const hid    = document.getElementById('lot_editing_id');
  const badge  = document.getElementById('lot_success_badge');

  let currentId = null;

  function fillVarieties(){
    if (!selVar) return;
    selVar.innerHTML = (store.state.varieties||[])
      .map(v=>`<option value="${v.id}">${escape(v.name||v.id)}</option>`).join('');
  }

  function success(){
    const t = Number(qtyT.value||0), r = Number(qtyR.value||0);
    const s = t>0 ? Math.round((r*100)/t) : 0;
    if (badge) badge.textContent = `Success: ${s}%`;
  }

  function resetForm(){
    currentId = null;
    if (selVar) selVar.value = (store.state.varieties?.[0]?.id)||'';
    method.value = 'cuttings';
    start.value = '';
    check.value = '';
    qtyT.value = ''; qtyR.value = '';
    mix.value=''; temp.value=''; hum.value=''; notes.value='';
    hint.hidden = true; hid.textContent='';
    success();
  }

  function loadToForm(l){
    currentId = l.id;
    selVar.value = l.variety_id || '';
    method.value = l.method || 'cuttings';
    start.value  = l.start_date || '';
    check.value  = l.check_date || '';
    qtyT.value   = l.qty_total ?? '';
    qtyR.value   = l.qty_rooted ?? '';
    mix.value    = l.mix || '';
    temp.value   = l.temp ?? '';
    hum.value    = l.humidity ?? '';
    notes.value  = l.notes || '';
    hint.hidden = false; hid.textContent = l.id;
    success();
  }

  function render(){
    if (!tbody) return;
    const rows = (store.state.lots||[]).map(l=>{
      const vName = store.state.varieties.find(v=>v.id===l.variety_id)?.name || l.variety_id;
      const s = store.computeLotSuccess? store.computeLotSuccess(l) :
               (Number(l.qty_total||0)>0? Math.round(Number(l.qty_rooted||0)*100/Number(l.qty_total||0)):0);
      return `<tr>
        <td>${l.id}</td>
        <td>${escape(vName||'')}</td>
        <td>${escape(l.method||'')}</td>
        <td>${escape(l.start_date||'')}</td>
        <td>${escape(l.check_date||'')}</td>
        <td>${l.qty_total??0}</td>
        <td>${l.qty_rooted??0}</td>
        <td>${s}%</td>
        <td>
          <button data-act="edit" data-id="${l.id}">Edit</button>
          <button data-act="del"  data-id="${l.id}" class="ghost">Delete</button>
        </td>
      </tr>`;
    }).join('');
    tbody.innerHTML = rows;
  }

  async function saveLot(){
    if(!selVar.value){ alert('Please select a variety.'); selVar.focus(); return; }
    const now = new Date().toISOString();
    const lot = {
      id: currentId,
      variety_id: selVar.value,
      method: method.value,
      start_date: start.value,
      check_date: check.value,
      qty_total: Number(qtyT.value||0),
      qty_rooted: Number(qtyR.value||0),
      mix: mix.value.trim(),
      temp: temp.value? Number(temp.value): undefined,
      humidity: hum.value? Number(hum.value): undefined,
      notes: notes.value.trim(),
      updated_at: now
    };
    if(!lot.id) lot.created_at = now;
    await store.upsertLot(lot);
    resetForm(); render();
  }

  if (qtyT) qtyT.oninput = success; 
  if (qtyR) qtyR.oninput = success;

  if (save) save.addEventListener('click', e=>{ e.preventDefault(); saveLot(); });
  if (reset) reset.addEventListener('click', e=>{ e.preventDefault(); resetForm(); });

  if (tbody) tbody.addEventListener('click', async e=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const id = btn.dataset.id; const act = btn.dataset.act;
    const found = (store.state.lots||[]).find(x=>x.id===id);
    if(act==='edit' && found) loadToForm(found);
    if(act==='del' ){
      if(confirm('Delete this lot?')){ await store.deleteLot(id); render(); }
    }
  });

  fillVarieties(); resetForm(); render();
}

function escape(s){ return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
