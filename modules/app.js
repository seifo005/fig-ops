// app.js - main application script for Fig Operations Manager
import { state, loadAll, addRecord, updateRecord, deleteRecord, getRecords, saveGithubSettings, computeLotSuccess } from './storage.js';
import { computeSummary, computeOrdersByMonth, computeTopVarieties, computeSuccessByMethod } from './analytics.js';

// DOM utility helper
function qs(selector, parent = document) {
  return parent.querySelector(selector);
}
function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

// Globals for chart instances
let charts = {};

// Entry point: initialize application when DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  bindTabNavigation();
  bindVarietyForm();
  bindLotForm();
  bindCustomerForm();
  bindOrderForm();
  bindSettingsForm();
  // Initially show dashboard
  showTab('dashboard');
});

/**
 * Tab navigation handler: add click listeners on nav buttons.
 */
function bindTabNavigation() {
  const tabButtons = qsa('.tabs button');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      showTab(btn.dataset.tab);
    });
  });
}

/**
 * Show a specific tab and hide others.
 */
function showTab(tabId) {
  // Hide all
  qsa('.tab-section').forEach(sec => sec.classList.add('hidden'));
  // Remove active classes
  qsa('.tabs button').forEach(btn => btn.classList.remove('active'));
  // Show selected
  const section = qs(`#${tabId}`);
  if (section) section.classList.remove('hidden');
  const activeBtn = qs(`.tabs button[data-tab="${tabId}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  // Trigger specific updates
  switch (tabId) {
    case 'dashboard':
      updateDashboard();
      break;
    case 'varieties':
      refreshVarietyUI();
      break;
    case 'lots':
      refreshLotUI();
      break;
    case 'customers':
      refreshCustomerUI();
      break;
    case 'orders':
      refreshOrderUI();
      break;
    case 'analytics':
      renderAnalytics();
      break;
    case 'settings':
      loadSettingsForm();
      break;
  }
}

// ----------------- Dashboard -----------------

function updateDashboard() {
  const summary = computeSummary();
  const container = qs('#dashboard-summary');
  container.innerHTML = '';
  const metrics = [
    { title: 'Varieties', value: summary.totalVarieties },
    { title: 'Lots', value: summary.totalLots },
    { title: 'Customers', value: summary.totalCustomers },
    { title: 'Orders', value: summary.totalOrders },
    { title: 'Revenue', value: summary.totalRevenue.toFixed(2) },
    { title: 'Avg Lot Success (%)', value: summary.avgSuccess.toFixed(2) }
  ];
  metrics.forEach(metric => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `<h4>${metric.title}</h4><p>${metric.value}</p>`;
    container.appendChild(card);
  });
}

// --------------- Varieties -------------------

function refreshVarietyUI() {
  refreshVarietyTable();
  populateVarietySelects();
  resetVarietyForm();
}

function bindVarietyForm() {
  const saveBtn = qs('#variety-save');
  const cancelBtn = qs('#variety-cancel');
  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = qs('#variety-id').value;
    const name = qs('#variety-name').value.trim();
    if (!name) return;
    const variety = {
      id: id || undefined,
      name,
      category: qs('#variety-category').value.trim(),
      price: parseFloat(qs('#variety-price').value) || 0,
      description: qs('#variety-description').value.trim()
    };
    if (id) {
      await updateRecord('varieties', variety);
    } else {
      await addRecord('varieties', variety);
    }
    refreshVarietyUI();
  });
  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    resetVarietyForm();
  });
}

function resetVarietyForm() {
  qs('#variety-id').value = '';
  qs('#variety-name').value = '';
  qs('#variety-category').value = '';
  qs('#variety-price').value = '';
  qs('#variety-description').value = '';
  qs('#variety-form-title').textContent = 'Add Variety';
  qs('#variety-save').textContent = 'Save';
  qs('#variety-cancel').classList.add('hidden');
}

function populateVarietySelects() {
  // Populate variety dropdowns for lot form and order items
  const varieties = getRecords('varieties');
  const lotSelect = qs('#lot-variety');
  const orderSelects = qsa('.item-variety-select');
  function fillSelect(select) {
    select.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select --';
    select.appendChild(defaultOption);
    varieties.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.name;
      opt.dataset.price = v.price;
      select.appendChild(opt);
    });
  }
  if (lotSelect) fillSelect(lotSelect);
  orderSelects.forEach(select => fillSelect(select));
}

function refreshVarietyTable() {
  const tbody = qs('#variety-table tbody');
  tbody.innerHTML = '';
  getRecords('varieties').forEach(variety => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${variety.name || ''}</td>
      <td>${variety.category || ''}</td>
      <td>${variety.price != null ? variety.price.toFixed(2) : ''}</td>
      <td>${variety.description || ''}</td>
      <td class="actions">
        <button class="edit-btn" data-id="${variety.id}" data-type="variety">Edit</button>
        <button class="delete-btn" data-id="${variety.id}" data-type="variety">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  // Attach event listeners for actions
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const record = getRecords('varieties').find(v => v.id === id);
      if (!record) return;
      qs('#variety-id').value = record.id;
      qs('#variety-name').value = record.name;
      qs('#variety-category').value = record.category || '';
      qs('#variety-price').value = record.price != null ? record.price : '';
      qs('#variety-description').value = record.description || '';
      qs('#variety-form-title').textContent = 'Edit Variety';
      qs('#variety-save').textContent = 'Update';
      qs('#variety-cancel').classList.remove('hidden');
    });
  });
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('Delete this variety?')) {
        await deleteRecord('varieties', id);
        refreshVarietyUI();
      }
    });
  });
}

// ----------------- Lots ----------------------

function refreshLotUI() {
  populateVarietySelects();
  refreshLotTable();
  resetLotForm();
}

function bindLotForm() {
  qs('#lot-save').addEventListener('click', async (e) => {
    e.preventDefault();
    const id = qs('#lot-id').value;
    const lot = {
      id: id || undefined,
      varietyId: qs('#lot-variety').value || null,
      method: qs('#lot-method').value.trim(),
      start: qs('#lot-start').value,
      end: qs('#lot-end').value,
      cuttings: parseInt(qs('#lot-cuttings').value, 10) || 0,
      rooted: parseInt(qs('#lot-rooted').value, 10) || 0,
      mix: qs('#lot-mix').value.trim(),
      status: qs('#lot-status').value.trim(),
      notes: qs('#lot-notes').value.trim()
    };
    if (id) {
      await updateRecord('lots', lot);
    } else {
      await addRecord('lots', lot);
    }
    refreshLotUI();
  });
  qs('#lot-cancel').addEventListener('click', (e) => {
    e.preventDefault();
    resetLotForm();
  });
}

function resetLotForm() {
  qs('#lot-id').value = '';
  qs('#lot-variety').value = '';
  qs('#lot-method').value = '';
  qs('#lot-start').value = '';
  qs('#lot-end').value = '';
  qs('#lot-cuttings').value = '';
  qs('#lot-rooted').value = '';
  qs('#lot-mix').value = '';
  qs('#lot-status').value = '';
  qs('#lot-notes').value = '';
  qs('#lot-form-title').textContent = 'Add Lot';
  qs('#lot-save').textContent = 'Save';
  qs('#lot-cancel').classList.add('hidden');
}

function refreshLotTable() {
  const tbody = qs('#lot-table tbody');
  tbody.innerHTML = '';
  const varieties = getRecords('varieties');
  const varMap = {};
  varieties.forEach(v => varMap[v.id] = v.name);
  getRecords('lots').forEach(lot => {
    const success = computeLotSuccess(lot);
    const varietyName = varMap[lot.varietyId] || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${lot.id}</td>
      <td>${varietyName}</td>
      <td>${lot.method || ''}</td>
      <td>${lot.start || ''}</td>
      <td>${lot.end || ''}</td>
      <td>${lot.cuttings || ''}</td>
      <td>${lot.rooted || ''}</td>
      <td>${success.toFixed(2)}</td>
      <td>${lot.status || ''}</td>
      <td class="actions">
        <button class="edit-btn" data-id="${lot.id}" data-type="lot">Edit</button>
        <button class="delete-btn" data-id="${lot.id}" data-type="lot">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const record = getRecords('lots').find(l => l.id === id);
      if (!record) return;
      qs('#lot-id').value = record.id;
      qs('#lot-variety').value = record.varietyId || '';
      qs('#lot-method').value = record.method || '';
      qs('#lot-start').value = record.start || '';
      qs('#lot-end').value = record.end || '';
      qs('#lot-cuttings').value = record.cuttings || '';
      qs('#lot-rooted').value = record.rooted || '';
      qs('#lot-mix').value = record.mix || '';
      qs('#lot-status').value = record.status || '';
      qs('#lot-notes').value = record.notes || '';
      qs('#lot-form-title').textContent = 'Edit Lot';
      qs('#lot-save').textContent = 'Update';
      qs('#lot-cancel').classList.remove('hidden');
    });
  });
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('Delete this lot?')) {
        await deleteRecord('lots', id);
        refreshLotUI();
      }
    });
  });
}

// ---------------- Customers ------------------

function refreshCustomerUI() {
  refreshCustomerTable();
  resetCustomerForm();
}

function bindCustomerForm() {
  qs('#customer-save').addEventListener('click', async (e) => {
    e.preventDefault();
    const id = qs('#customer-id').value;
    const customer = {
      id: id || undefined,
      name: qs('#customer-name').value.trim(),
      phone: qs('#customer-phone').value.trim(),
      address: qs('#customer-address').value.trim(),
      note: qs('#customer-note').value.trim()
    };
    if (!customer.name) return;
    if (id) {
      await updateRecord('customers', customer);
    } else {
      await addRecord('customers', customer);
    }
    refreshCustomerUI();
  });
  qs('#customer-cancel').addEventListener('click', (e) => {
    e.preventDefault();
    resetCustomerForm();
  });
}

function resetCustomerForm() {
  qs('#customer-id').value = '';
  qs('#customer-name').value = '';
  qs('#customer-phone').value = '';
  qs('#customer-address').value = '';
  qs('#customer-note').value = '';
  qs('#customer-form-title').textContent = 'Add Customer';
  qs('#customer-save').textContent = 'Save';
  qs('#customer-cancel').classList.add('hidden');
  populateCustomerSelect();
}

function refreshCustomerTable() {
  const tbody = qs('#customer-table tbody');
  tbody.innerHTML = '';
  getRecords('customers').forEach(cust => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cust.name || ''}</td>
      <td>${cust.phone || ''}</td>
      <td>${cust.address || ''}</td>
      <td>${cust.note || ''}</td>
      <td class="actions">
        <button class="edit-btn" data-id="${cust.id}" data-type="customer">Edit</button>
        <button class="delete-btn" data-id="${cust.id}" data-type="customer">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const record = getRecords('customers').find(c => c.id === id);
      if (!record) return;
      qs('#customer-id').value = record.id;
      qs('#customer-name').value = record.name;
      qs('#customer-phone').value = record.phone || '';
      qs('#customer-address').value = record.address || '';
      qs('#customer-note').value = record.note || '';
      qs('#customer-form-title').textContent = 'Edit Customer';
      qs('#customer-save').textContent = 'Update';
      qs('#customer-cancel').classList.remove('hidden');
    });
  });
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('Delete this customer?')) {
        await deleteRecord('customers', id);
        refreshCustomerUI();
      }
    });
  });
  // refresh order form customer select
  populateCustomerSelect();
}

function populateCustomerSelect() {
  const select = qs('#order-customer');
  if (!select) return;
  const customers = getRecords('customers');
  select.innerHTML = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '-- Select --';
  select.appendChild(defaultOpt);
  customers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
}

// ----------------- Orders --------------------

function refreshOrderUI() {
  refreshOrderTable();
  resetOrderForm();
  populateCustomerSelect();
  populateVarietySelects();
}

function bindOrderForm() {
  // Add item row
  qs('#add-item').addEventListener('click', () => {
    addItemRow();
  });
  // Save order
  qs('#order-save').addEventListener('click', async (e) => {
    e.preventDefault();
    const id = qs('#order-id').value;
    const date = qs('#order-date').value;
    const customerId = qs('#order-customer').value;
    const status = qs('#order-status').value.trim();
    const note = qs('#order-note').value.trim();
    const items = [];
    let valid = true;
    qsa('#order-items-table tbody tr').forEach(row => {
      const varSelect = row.querySelector('.item-variety-select');
      const qtyInput = row.querySelector('.item-qty-input');
      const priceInput = row.querySelector('.item-price-input');
      const varietyId = varSelect.value;
      const quantity = parseFloat(qtyInput.value) || 0;
      const price = parseFloat(priceInput.value) || 0;
      if (!varietyId || quantity <= 0) {
        valid = false;
        return;
      }
      items.push({ varietyId, quantity, price, subtotal: quantity * price });
    });
    if (!date || !customerId || !valid || items.length === 0) {
      alert('Please complete the order form.');
      return;
    }
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const order = {
      id: id || undefined,
      date,
      customerId,
      items,
      total: Math.round(total * 100) / 100,
      status,
      note
    };
    if (id) {
      await updateRecord('orders', order);
    } else {
      order.createdAt = date;
      await addRecord('orders', order);
    }
    refreshOrderUI();
  });
  qs('#order-cancel').addEventListener('click', (e) => {
    e.preventDefault();
    resetOrderForm();
  });
}

function resetOrderForm() {
  qs('#order-id').value = '';
  // Default date to today
  const today = new Date().toISOString().slice(0, 10);
  qs('#order-date').value = today;
  qs('#order-customer').value = '';
  qs('#order-status').value = '';
  qs('#order-note').value = '';
  qs('#order-total').textContent = '0.00';
  // Clear items table
  const tbody = qs('#order-items-table tbody');
  tbody.innerHTML = '';
  addItemRow();
  qs('#order-form-title').textContent = 'Add Order';
  qs('#order-save').textContent = 'Save';
  qs('#order-cancel').classList.add('hidden');
}

function addItemRow(existingItem = null) {
  const tbody = qs('#order-items-table tbody');
  const tr = document.createElement('tr');
  const varietySelect = document.createElement('select');
  varietySelect.className = 'item-variety-select';
  // Populate with varieties
  const varieties = getRecords('varieties');
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '-- Select --';
  varietySelect.appendChild(defaultOpt);
  varieties.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.name;
    opt.dataset.price = v.price;
    varietySelect.appendChild(opt);
  });
  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.min = '0';
  qtyInput.step = '1';
  qtyInput.className = 'item-qty-input';
  const priceInput = document.createElement('input');
  priceInput.type = 'number';
  priceInput.min = '0';
  priceInput.step = '0.01';
  priceInput.className = 'item-price-input';
  const subtotalCell = document.createElement('td');
  subtotalCell.className = 'item-subtotal';
  subtotalCell.textContent = '0.00';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = 'X';
  removeBtn.addEventListener('click', () => {
    tr.remove();
    updateOrderTotal();
  });
  // Pre-fill if editing existing item
  if (existingItem) {
    varietySelect.value = existingItem.varietyId;
    qtyInput.value = existingItem.quantity;
    priceInput.value = existingItem.price;
  }
  // Event listeners to update subtotal and total
  function updateSubtotal() {
    const qty = parseFloat(qtyInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    const subtotal = qty * price;
    subtotalCell.textContent = subtotal.toFixed(2);
    updateOrderTotal();
  }
  varietySelect.addEventListener('change', () => {
    const selOpt = varietySelect.selectedOptions[0];
    if (selOpt && selOpt.dataset.price) {
      priceInput.value = selOpt.dataset.price;
    }
    updateSubtotal();
  });
  qtyInput.addEventListener('input', updateSubtotal);
  priceInput.addEventListener('input', updateSubtotal);
  // Build row
  // Build table cells properly
  const tdVariety = document.createElement('td');
  tdVariety.appendChild(varietySelect);
  const tdQty = document.createElement('td');
  tdQty.appendChild(qtyInput);
  const tdPrice = document.createElement('td');
  tdPrice.appendChild(priceInput);
  const tdRemove = document.createElement('td');
  tdRemove.appendChild(removeBtn);
  tr.appendChild(tdVariety);
  tr.appendChild(tdQty);
  tr.appendChild(tdPrice);
  tr.appendChild(subtotalCell);
  tr.appendChild(tdRemove);
  tbody.appendChild(tr);
  updateSubtotal();
  populateVarietySelects();
}

function updateOrderTotal() {
  let total = 0;
  qsa('#order-items-table tbody tr').forEach(row => {
    const subtotal = parseFloat(row.querySelector('.item-subtotal').textContent) || 0;
    total += subtotal;
  });
  qs('#order-total').textContent = total.toFixed(2);
}

function refreshOrderTable() {
  const tbody = qs('#order-table tbody');
  tbody.innerHTML = '';
  const customers = getRecords('customers');
  const custMap = {};
  customers.forEach(c => custMap[c.id] = c.name);
  const varieties = getRecords('varieties');
  const varMap = {};
  varieties.forEach(v => varMap[v.id] = v.name);
  getRecords('orders').forEach(order => {
    // Build item summary string
    const itemsSummary = (order.items || []).map(item => `${item.quantity} × ${(varMap[item.varietyId] || item.varietyId)}`).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${order.id}</td>
      <td>${order.date || ''}</td>
      <td>${custMap[order.customerId] || ''}</td>
      <td>${itemsSummary}</td>
      <td>${order.total != null ? order.total.toFixed(2) : '0.00'}</td>
      <td>${order.status || ''}</td>
      <td class="actions">
        <button class="print-btn" data-id="${order.id}">Print</button>
        <button class="edit-btn" data-id="${order.id}">Edit</button>
        <button class="delete-btn" data-id="${order.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  // Print
  tbody.querySelectorAll('.print-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const order = getRecords('orders').find(o => o.id === id);
      if (order) printOrder(order);
    });
  });
  // Edit
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const order = getRecords('orders').find(o => o.id === id);
      if (!order) return;
      // Populate form
      qs('#order-id').value = order.id;
      qs('#order-date').value = order.date || '';
      qs('#order-customer').value = order.customerId || '';
      qs('#order-status').value = order.status || '';
      qs('#order-note').value = order.note || '';
      // Clear current items
      qs('#order-items-table tbody').innerHTML = '';
      (order.items || []).forEach(item => addItemRow(item));
      updateOrderTotal();
      qs('#order-form-title').textContent = 'Edit Order';
      qs('#order-save').textContent = 'Update';
      qs('#order-cancel').classList.remove('hidden');
      showTab('orders');
    });
  });
  // Delete
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('Delete this order?')) {
        await deleteRecord('orders', id);
        refreshOrderUI();
      }
    });
  });
}

function printOrder(order) {
  const customers = getRecords('customers');
  const cust = customers.find(c => c.id === order.customerId);
  const varieties = getRecords('varieties');
  const varMap = {};
  varieties.forEach(v => varMap[v.id] = v.name);
  const win = window.open('', '', 'width=700,height=600');
  const itemsRows = order.items.map(item => {
    const name = varMap[item.varietyId] || item.varietyId;
    return `<tr><td>${name}</td><td>${item.quantity}</td><td>${item.price.toFixed(2)}</td><td>${item.subtotal.toFixed(2)}</td></tr>`;
  }).join('');
  const html = `
    <html><head><title>Order ${order.id}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #ccc; padding: 5px; text-align: left; }
      th { background: #f0f0f0; }
    </style>
    </head><body>
    <h2>Order ${order.id}</h2>
    <p><strong>Date:</strong> ${order.date || ''}</p>
    <p><strong>Customer:</strong> ${cust ? cust.name : ''}</p>
    <p><strong>Status:</strong> ${order.status || ''}</p>
    <table>
      <thead><tr><th>Variety</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <p><strong>Total:</strong> ${order.total != null ? order.total.toFixed(2) : '0.00'}</p>
    <p><strong>Note:</strong> ${order.note || ''}</p>
    </body></html>
  `;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

// --------------- Settings --------------------

function loadSettingsForm() {
  try {
    const settings = JSON.parse(localStorage.getItem('fig_ops_settings') || '{}');
    qs('#gh-owner').value = settings.owner || '';
    qs('#gh-repo').value = settings.repo || '';
    qs('#gh-branch').value = settings.branch || '';
    qs('#gh-token').value = settings.token || '';
  } catch (err) {
    console.error('Could not parse settings', err);
  }
}

function bindSettingsForm() {
  qs('#settings-save').addEventListener('click', (e) => {
    e.preventDefault();
    const owner = qs('#gh-owner').value.trim();
    const repo = qs('#gh-repo').value.trim();
    const branch = qs('#gh-branch').value.trim();
    const token = qs('#gh-token').value.trim();
    const settings = { owner, repo, branch, token };
    saveGithubSettings(settings);
    alert('Settings saved! Future changes will sync to GitHub when possible.');
  });
}

// --------------- Analytics -------------------

function renderAnalytics() {
  const container = qs('#analytics-content');
  container.innerHTML = '';
  // Compute datasets
  const summary = computeSummary();
  const ordersByMonth = computeOrdersByMonth();
  const topVarieties = computeTopVarieties(5);
  const successByMethod = computeSuccessByMethod();
  // Create cards for summary
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'metrics-container';
  const metrics = [
    { title: 'Total Revenue', value: summary.totalRevenue.toFixed(2) },
    { title: 'Total Orders', value: summary.totalOrders },
    { title: 'Average Lot Success (%)', value: summary.avgSuccess.toFixed(2) }
  ];
  metrics.forEach(m => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `<h4>${m.title}</h4><p>${m.value}</p>`;
    cardsContainer.appendChild(card);
  });
  container.appendChild(cardsContainer);
  // Charts container
  const chartsWrapper = document.createElement('div');
  chartsWrapper.style.display = 'flex';
  chartsWrapper.style.flexWrap = 'wrap';
  chartsWrapper.style.gap = '20px';
  chartsWrapper.style.marginTop = '20px';
  // Orders per month chart
  const ordersCanvas = document.createElement('canvas');
  ordersCanvas.id = 'ordersChart';
  ordersCanvas.style.flex = '1 1 300px';
  chartsWrapper.appendChild(ordersCanvas);
  // Revenue per month chart
  const revenueCanvas = document.createElement('canvas');
  revenueCanvas.id = 'revenueChart';
  revenueCanvas.style.flex = '1 1 300px';
  chartsWrapper.appendChild(revenueCanvas);
  // Top varieties chart
  const topVarCanvas = document.createElement('canvas');
  topVarCanvas.id = 'topVarChart';
  topVarCanvas.style.flex = '1 1 300px';
  chartsWrapper.appendChild(topVarCanvas);
  // Success by method chart
  const successCanvas = document.createElement('canvas');
  successCanvas.id = 'successChart';
  successCanvas.style.flex = '1 1 300px';
  chartsWrapper.appendChild(successCanvas);
  container.appendChild(chartsWrapper);
  // Destroy existing charts if present
  Object.keys(charts).forEach(key => {
    charts[key].destroy();
    delete charts[key];
  });
  // Build orders chart
  charts.orders = new Chart(ordersCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ordersByMonth.labels,
      datasets: [{
        label: '# Orders',
        data: ordersByMonth.orders,
        borderWidth: 1
      }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
  // Build revenue chart
  charts.revenue = new Chart(revenueCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ordersByMonth.labels,
      datasets: [{
        label: 'Revenue',
        data: ordersByMonth.revenue,
        borderWidth: 1
      }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
  // Top varieties chart
  charts.topVarieties = new Chart(topVarCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: topVarieties.map(v => v.name),
      datasets: [{
        label: 'Quantity Sold',
        data: topVarieties.map(v => v.quantity),
        borderWidth: 1
      }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
  // Success by method chart
  charts.success = new Chart(successCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: successByMethod.labels,
      datasets: [{
        label: 'Average Success (%)',
        data: successByMethod.success,
        borderWidth: 1
      }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
}