import { Storage } from './storage.js';
import { Analytics } from './analytics.js';
import { Charts } from './charts.js';

const tabs = document.querySelectorAll('nav button');
const sections = document.querySelectorAll('main .tab');
tabs.forEach(btn=>btn.addEventListener('click',()=>{
  tabs.forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  sections.forEach(s=>s.hidden = s.id !== btn.dataset.tab);
}));

const store = new Storage();
const analytics = new Analytics(store);
const charts = new Charts();

function setSync(status){ document.getElementById('syncStatus').textContent = status; }

async function boot(){
  await store.loadAll();
  populateSelects();
  renderTables();
  renderKPIs();
  charts.init();
  charts.orders(analytics.ordersTimeSeries());
  charts.rooting(analytics.rootingByMethod());
  charts.varieties(analytics.ordersByVariety());
  charts.returns(analytics.returnsSeries());
  setSync(store.isConfigured() ? 'ready' : 'offline');
}
boot();

function populateSelects(){
  const varieties = store.state.varieties.map(v=>v.name);
  const varietyOptions = varieties.map(v=>`<option>${v}</option>`).join('');
  ['lot_variety','order_variety'].forEach(id=>document.getElementById(id).innerHTML = varietyOptions);
  const custSel = document.getElementById('order_customer');
  custSel.innerHTML = store.state.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
}

function renderTables(){
  const lotsT = document.querySelector('#lotsTable tbody');
  lotsT.innerHTML = store.state.lots.map(l=>`<tr>
    <td>${l.id}</td><td>${l.variety}</td><td>${l.method}</td>
    <td>${l.qty}</td><td>${l.start}</td><td>${l.stage||'-'}</td><td>${l.success||0}%</td>
  </tr>`).join('');

  const ordT = document.querySelector('#ordersTable tbody');
  ordT.innerHTML = store.state.orders.map(o=>`<tr>
    <td>${o.id}</td><td>${o.date}</td><td>${store.getCustomerName(o.customer_id)}</td>
    <td>${o.variety}</td><td>${o.qty}</td><td>${o.status}</td>
  </tr>`).join('');

  const cusT = document.querySelector('#customersTable tbody');
  cusT.innerHTML = store.state.customers.map(c=>`<tr>
    <td>${c.id}</td><td>${c.name}</td><td>${c.phone||''}</td><td>${(c.city||'')}</td>
  </tr>`).join('');
}

function renderKPIs(){
  const k = analytics.kpis30d();
  document.getElementById('kpi_rooting').textContent = `${k.rootingSuccess}%`;
  document.getElementById('kpi_delivery').textContent = `${k.deliverySuccess}%`;
  document.getElementById('kpi_returns').textContent = `${k.returnRate}%`;
  document.getElementById('kpi_orders').textContent = k.orders;
}

document.getElementById('addLotBtn').onclick = async ()=>{
  const l = {
    id: store.nextId('LOT'),
    variety: document.getElementById('lot_variety').value,
    method: document.getElementById('lot_method').value,
    qty: Number(document.getElementById('lot_qty').value),
    start: document.getElementById('lot_start').value || new Date().toISOString().slice(0,10),
    stage: 'started', success: 0
  };
  await store.add('lots', l);
  renderTables(); charts.rooting(analytics.rootingByMethod());
};

document.getElementById('addOrderBtn').onclick = async ()=>{
  const o = {
    id: store.nextId('ORD'),
    date: new Date().toISOString().slice(0,10),
    customer_id: document.getElementById('order_customer').value,
    variety: document.getElementById('order_variety').value,
    qty: Number(document.getElementById('order_qty').value),
    status: 'new', delivered: false, returned: false
  };
  await store.add('orders', o);
  renderTables(); charts.orders(analytics.ordersTimeSeries()); charts.varieties(analytics.ordersByVariety());
};

document.getElementById('addCustomerBtn').onclick = async ()=>{
  const c = {
    id: store.nextId('CUS'),
    name: document.getElementById('cust_name').value,
    phone: document.getElementById('cust_phone').value,
    address: document.getElementById('cust_addr').value
  };
  await store.add('customers', c);
  populateSelects(); renderTables();
};

document.getElementById('saveRepoBtn').onclick = ()=>{
  store.setRepo({
    owner: document.getElementById('repo_owner').value.trim(),
    name: document.getElementById('repo_name').value.trim(),
    branch: document.getElementById('repo_branch').value.trim(),
    token: document.getElementById('gh_token').value.trim()
  });
  setSync(store.isConfigured() ? 'ready' : 'offline');
};

document.getElementById('syncAllBtn').onclick = async ()=>{
  setSync('syncing...');
  await store.syncAll();
  setSync('synced');
};

document.getElementById('exportBtn').onclick = ()=> store.exportZip();
document.getElementById('importFile').onchange = (e)=> store.importZip(e.target.files[0]);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');