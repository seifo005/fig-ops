// modules/orders.js — multi-variety line items + totals + print
export function initOrdersUI(store){
  const tbody = document.querySelector('#ordersTable tbody');

  // form
  const idHint = document.getElementById('o_editing_id');
  const hint   = document.getElementById('o_edit_hint');
  const selCustomer = document.getElementById('o_customer');
  const dateEl = document.getElementById('o_date');
  const statusEl = document.getElementById('o_status');
  const notesEl = document.getElementById('o_notes');
  const itemsBody = document.querySelector('#o_items tbody');
  const totalEl = document.getElementById('o_total');

  // buttons
  const addItemBtn = document.getElementById('addItemBtn');
  const saveBtn    = document.getElementById('saveOrderBtn');
  const resetBtn   = document.getElementById('resetOrderBtn');
  const printBtn   = document.getElementById('printOrderBtn');

  let currentId = null;

  function fillCustomers(){
    selCustomer.innerHTML = (store.state.customers||[])
      .map(c=>`<option value="${c.id}">${escape(c.name||c.id)}</option>`).join('');
  }
  function fillVarietySelect(sel, value){
    sel.innerHTML = (store.state.varieties||[])
      .map(v=>`<option value="${v.id}" ${v.id===value?'selected':''}>${escape(v.name||v.id)}</option>`).join('');
  }

  function itemRow(it={}, idx){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td><select class="it_var"></select></td>
      <td><input class="it_qty" type="number" min="1" step="1" value="${it.qty??1}"></td>
      <td><input class="it_price" type="number" min="0" step="0.01" value="${it.price??0}"></td>
      <td class="it_sub">0</td>
      <td><button class="ghost it_del" type="button">✕</button></td>
    `;
    fillVarietySelect(tr.querySelector('.it_var'), it.variety_id);
    if (!it.price){ // default price from variety
      const v = (store.state.varieties||[]).find(v=>v.id===it.variety_id) || {};
      if (v && v.default_price!=null) tr.querySelector('.it_price').value = Number(v.default_price);
    }
    return tr;
  }

  function recalc(){
    let total = 0;
    itemsBody.querySelectorAll('tr').forEach(tr=>{
      const qty = Number(tr.querySelector('.it_qty').value||0);
      const price = Number(tr.querySelector('.it_price').value||0);
      const sub = qty*price;
      tr.querySelector('.it_sub').textContent = sub.toFixed(2);
      total += sub;
    });
    totalEl.textContent = total.toFixed(2);
  }

  function resetForm(){
    currentId = null; hint.hidden=true; idHint.textContent='';
    selCustomer.value = (store.state.customers?.[0]?.id)||'';
    dateEl.value = new Date().toISOString().slice(0,10);
    statusEl.value = 'draft';
    notesEl.value = '';
    itemsBody.innerHTML = '';
    addItem(); recalc();
  }

  function loadToForm(o){
    currentId = o.id; hint.hidden=false; idHint.textContent=o.id;
    selCustomer.value = o.customer_id || '';
    dateEl.value = o.date || new Date().toISOString().slice(0,10);
    statusEl.value = o.status || 'draft';
    notesEl.value = o.notes || '';
    itemsBody.innerHTML = '';
    (o.items||[]).forEach((it,i)=> addItem(it));
    recalc();
  }

  function addItem(it={}){
    const tr = itemRow(it, itemsBody.children.length);
    itemsBody.appendChild(tr);
    const qty = tr.querySelector('.it_qty');
    const price = tr.querySelector('.it_price');
    const varSel = tr.querySelector('.it_var');
    const del = tr.querySelector('.it_del');
    qty.oninput = recalc; price.oninput = recalc; varSel.onchange = (e)=>{
      // Prefill price on variety change if price is 0
      const v = (store.state.varieties||[]).find(v=>v.id===varSel.value);
      if (v && Number(price.value||0)===0 && v.default_price!=null) price.value = Number(v.default_price);
      recalc();
    };
    del.onclick = ()=>{ tr.remove(); recalc(); };
  }

  function render(){
    tbody.innerHTML = (store.state.orders||[]).map(o=>{
      const c = (store.state.customers||[]).find(c=>c.id===o.customer_id);
      return `<tr>
        <td>${o.id}</td>
        <td>${escape(o.date||'')}</td>
        <td>${escape((c&&c.name)||o.customer_id||'')}</td>
        <td>${(o.items||[]).length}</td>
        <td>${Number(o.total||0).toFixed(2)}</td>
        <td>${escape(o.status||'')}</td>
        <td>
          <button data-act="edit" data-id="${o.id}">Edit</button>
          <button data-act="print" data-id="${o.id}" class="ghost">Print</button>
          <button data-act="del" data-id="${o.id}" class="ghost">Delete</button>
        </td>
      </tr>`;
    }).join('');
  }

  async function saveOrder(){
    const now = new Date().toISOString();
    const items = [...itemsBody.querySelectorAll('tr')].map(tr=>{
      return {
        variety_id: tr.querySelector('.it_var').value,
        qty: Number(tr.querySelector('.it_qty').value||0),
        price: Number(tr.querySelector('.it_price').value||0)
      };
    }).filter(it=>it.qty>0);

    if (!selCustomer.value){ alert('Select a customer'); selCustomer.focus(); return; }
    if (items.length===0){ alert('Add at least one item'); return; }

    const prev = currentId ? (store.state.orders||[]).find(x=>x.id===currentId) || {} : {};
    const o = {
      ...prev,
      id: currentId || null,
      customer_id: selCustomer.value,
      date: dateEl.value,
      status: statusEl.value,
      notes: (notesEl.value||'').trim(),
      items,
      updated_at: now
    };
    if (!o.id) o.created_at = now;

    await store.upsertOrder(o);
    resetForm(); render();
  }

  function printOrder(o){
    const c = (store.state.customers||[]).find(x=>x.id===o.customer_id) || {};
    const lines = (o.items||[]).map(it=>{
      const v = (store.state.varieties||[]).find(v=>v.id===it.variety_id) || {};
      return `<tr><td>${escape(v.name||it.variety_id)}</td><td>${it.qty}</td><td>${Number(it.price).toFixed(2)}</td><td>${(it.qty*it.price).toFixed(2)}</td></tr>`;
    }).join('');
    const html = `
      <html><head><meta charset="utf-8"><title>${o.id}</title>
      <style>body{font-family:system-ui; padding:16px} h1{margin:0 0 8px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:6px;text-align:left}</style>
      </head><body onload="window.print()">
        <h1>Order ${o.id}</h1>
        <div><b>Date:</b> ${escape(o.date||'')}</div>
        <div><b>Customer:</b> ${escape(c.name||o.customer_id||'')}</div>
        <div><b>Phone:</b> ${escape(c.phone||'')} — <b>Email:</b> ${escape(c.email||'')}</div>
        <div><b>Address:</b> ${escape(c.address||'')}</div>
        <hr/>
        <table><thead><tr><th>Variety</th><th>Qty</th><th>Unit</th><th>Subtotal</th></tr></thead><tbody>${lines}</tbody></table>
        <h2 style="text-align:right">Total: ${Number(o.total||0).toFixed(2)}</h2>
        <p><b>Status:</b> ${escape(o.status||'')}</p>
        <p><b>Notes:</b> ${escape(o.notes||'')}</p>
      </body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html); w.document.close();
  }

  // listeners
  addItemBtn.addEventListener('click', e=>{ e.preventDefault(); addItem(); recalc(); });
  saveBtn.addEventListener('click', e=>{ e.preventDefault(); saveOrder(); });
  resetBtn.addEventListener('click', e=>{ e.preventDefault(); resetForm(); });
  printBtn.addEventListener('click', e=>{
    e.preventDefault();
    const draft = {
      id: currentId || '(unsaved)',
      customer_id: selCustomer.value, date: dateEl.value, status: statusEl.value,
      notes: notesEl.value, items: [...itemsBody.querySelectorAll('tr')].map(tr=>({
        variety_id: tr.querySelector('.it_var').value,
        qty: Number(tr.querySelector('.it_qty').value||0),
        price: Number(tr.querySelector('.it_price').value||0)
      })), total: Number(document.getElementById('o_total').textContent||0)
    };
    printOrder(draft);
  });

  tbody.addEventListener('click', async e=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const id = btn.dataset.id; const act = btn.dataset.act;
    const found = (store.state.orders||[]).find(x=>x.id===id);
    if (act==='edit' && found) loadToForm(found);
    if (act==='print' && found) printOrder(found);
    if (act==='del' && confirm('Delete this order?')){ await store.deleteOrder(id); render(); }
  });

  // init
  fillCustomers();
  if (!dateEl.value) dateEl.value = new Date().toISOString().slice(0,10);
  addItem(); recalc(); render();

  // helpers
  function escape(s){ return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
}
