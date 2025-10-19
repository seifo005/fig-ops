// modules/customers.js
export function initCustomersUI(store){
  const tbody = document.querySelector('#customersTable tbody');
  const name = document.getElementById('c_name');
  const phone= document.getElementById('c_phone');
  const email= document.getElementById('c_email');
  const addr = document.getElementById('c_addr');
  const notes= document.getElementById('c_notes');
  const save = document.getElementById('saveCustomerBtn');
  const reset= document.getElementById('resetCustomerBtn');
  const hint = document.getElementById('c_edit_hint');
  const hid  = document.getElementById('c_editing_id');

  let currentId = null;

  function resetForm(){
    currentId=null; name.value=''; phone.value=''; email.value=''; addr.value=''; notes.value='';
    hint.hidden=true; hid.textContent='';
  }
  function loadToForm(c){
    currentId=c.id; name.value=c.name||''; phone.value=c.phone||''; email.value=c.email||'';
    addr.value=c.address||''; notes.value=c.notes||''; hint.hidden=false; hid.textContent=c.id;
  }
  function render(){
    tbody.innerHTML = (store.state.customers||[]).map(c=>`
      <tr>
        <td>${c.id}</td>
        <td>${escape(c.name||'')}</td>
        <td>${escape(c.phone||'')}</td>
        <td>${escape(c.email||'')}</td>
        <td>${escape(c.address||'')}</td>
        <td>
          <button data-act="edit" data-id="${c.id}">Edit</button>
          <button data-act="del" data-id="${c.id}" class="ghost">Delete</button>
        </td>
      </tr>`).join('');
  }
  async function saveCustomer(){
    const now = new Date().toISOString();
    const c = {
      id: currentId || null,
      name: name.value.trim(),
      phone: phone.value.trim(),
      email: email.value.trim(),
      address: addr.value.trim(),
      notes: notes.value.trim(),
      updated_at: now
    };
    if (!c.name) { alert('Name is required'); name.focus(); return; }
    if (!c.id) c.created_at = now;
    await store.upsertCustomer(c);
    resetForm(); render();
  }

  save.addEventListener('click', e=>{ e.preventDefault(); saveCustomer(); });
  reset.addEventListener('click', e=>{ e.preventDefault(); resetForm(); });

  tbody.addEventListener('click', async e=>{
    const btn=e.target.closest('button'); if(!btn) return;
    const id=btn.dataset.id; const act=btn.dataset.act;
    const found=(store.state.customers||[]).find(x=>x.id===id);
    if (act==='edit' && found) loadToForm(found);
    if (act==='del' && confirm('Delete this customer?')) { await store.deleteCustomer(id); render(); }
  });

  render();

  function escape(s){ return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
}
