// ============================================
// CloudPOS Inventory Module
// Stock Levels, Movements & Alerts
// ============================================

import { apiCall } from './api.js';
import { getCurrentUser, logout, showToast } from './auth.js';
import { formatPeso } from './utils.js';

// Global state
let products = [];
let inventory = [];
let movements = [];
let alerts = [];
let categories = [];
let filteredInventory = [];
let filteredMovements = [];
let currentPage = 1;
let movementPage = 1;
const itemsPerPage = 10;
let currentUser = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;

  loadTheme();
  setDefaultDates();
  await loadData();
  populateCategoryFilter();
  populateProductSelect();
  updateStats();
  filterInventory();
  filterMovements();
  checkStockAlerts();
  renderAlerts();
});

function setDefaultDates() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const toDate = document.getElementById('movementDateTo');
  const fromDate = document.getElementById('movementDateFrom');

  if (toDate) toDate.value = formatDateInput(today);
  if (fromDate) fromDate.value = formatDateInput(thirtyDaysAgo);
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================
// DATA LOADING
// ============================================

async function loadData() {
  // Load products
  try {
    const response = await apiCall('getProducts');
    if (response.status === 'success') {
      products = response.data || [];
    }
  } catch (error) {
    console.error('Load products error:', error);
    products = JSON.parse(localStorage.getItem('cloudpos_products') || '[]');
  }

  // Load inventory from API
  try {
    const response = await apiCall('getInventory');
    if (response.status === 'success') {
      inventory = response.data || [];
    }
  } catch (error) {
    console.error('Load inventory error:', error);
    inventory = JSON.parse(localStorage.getItem('cloudpos_inventory') || '[]');
  }

  // Load movements
  try {
    const response = await apiCall('getStockMovements');
    if (response.status === 'success') {
      movements = response.data || [];
    }
  } catch (error) {
    console.error('Load movements error:', error);
    movements = JSON.parse(localStorage.getItem('cloudpos_movements') || '[]');
  }

  // Load alerts from localStorage
  alerts = JSON.parse(localStorage.getItem('cloudpos_alerts') || '[]');

  // Extract categories
  const cats = new Set(products.map(p => p.category).filter(Boolean));
  categories = Array.from(cats).sort();

  // Ensure inventory records exist for all products
  ensureInventoryRecords();
}

function ensureInventoryRecords() {
  products.forEach(product => {
    const existing = inventory.find(inv => inv.productId === product.productId);
    if (!existing) {
      inventory.push({
        productId: product.productId,
        currentStock: product.stock || 0,
        lastUpdated: new Date().toISOString(),
        reorderLevel: product.minStock || 5,
        status: getStockStatus(product.stock || 0, product.minStock || 5),
        location: ''
      });
    } else {
      // Sync with product data if needed
      existing.currentStock = product.stock !== undefined ? product.stock : existing.currentStock;
      existing.reorderLevel = product.minStock !== undefined ? product.minStock : existing.reorderLevel;
      existing.status = getStockStatus(existing.currentStock, existing.reorderLevel);
    }
  });
  saveInventory();
}

function getStockStatus(stock, minStock) {
  if (stock <= 0) return 'Out of Stock';
  if (stock <= minStock) return 'Low Stock';
  return 'In Stock';
}

function saveInventory() {
  localStorage.setItem('cloudpos_inventory', JSON.stringify(inventory));
}

function saveMovements() {
  localStorage.setItem('cloudpos_movements', JSON.stringify(movements));
}

function saveAlerts() {
  localStorage.setItem('cloudpos_alerts', JSON.stringify(alerts));
}

function generateId() {
  return 'MOV-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4).toUpperCase();
}

// ============================================
// STATS
// ============================================

function updateStats() {
  const totalProducts = products.length;
  const stockValue = products.reduce((sum, p) => {
    const cost = parseFloat(p.buyingPrice) || 0;
    const stock = parseInt(p.stock) || 0;
    return sum + (cost * stock);
  }, 0);
  const lowStock = products.filter(p => {
    const stock = parseInt(p.stock) || 0;
    const min = parseInt(p.minStock) || 5;
    return stock > 0 && stock <= min;
  }).length;
  const outStock = products.filter(p => (parseInt(p.stock) || 0) <= 0).length;

  const statTotal = document.getElementById('statTotalProducts');
  const statValue = document.getElementById('statStockValue');
  const statLow = document.getElementById('statLowStock');
  const statOut = document.getElementById('statOutStock');

  if (statTotal) statTotal.textContent = totalProducts;
  if (statValue) statValue.textContent = formatPeso(stockValue);
  if (statLow) statLow.textContent = lowStock;
  if (statOut) statOut.textContent = outStock;
}

// ============================================
// TABS
// ============================================

function switchTab(tab) {
  document.querySelectorAll('.inv-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).style.display = 'block';
}

// ============================================
// STOCK LEVELS TABLE
// ============================================

function populateCategoryFilter() {
  const filter = document.getElementById('categoryFilter');
  if (!filter) return;
  filter.innerHTML = '<option value="all">All Categories</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function filterInventory() {
  const searchInput = document.getElementById('searchInventory');
  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');

  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const category = categoryFilter ? categoryFilter.value : 'all';
  const status = statusFilter ? statusFilter.value : 'all';

  filteredInventory = products.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search) ||
      (p.sku || '').toLowerCase().includes(search) ||
      (p.barcode || '').toLowerCase().includes(search);
    const matchCategory = category === 'all' || p.category === category;
    const stock = parseInt(p.stock) || 0;
    const min = parseInt(p.minStock) || 5;
    let matchStatus = true;
    if (status === 'in') matchStatus = stock > min;
    else if (status === 'low') matchStatus = stock > 0 && stock <= min;
    else if (status === 'out') matchStatus = stock <= 0;
    return matchSearch && matchCategory && matchStatus;
  });

  currentPage = 1;
  renderInventoryTable();
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;

  if (filteredInventory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">
            <i class="fas fa-boxes"></i>
            <h3>No products found</h3>
            <p>Add products to see inventory data.</p>
          </div>
        </td>
      </tr>
    `;
    document.getElementById('stockPageInfo').textContent = 'Showing 0 of 0 items';
    document.getElementById('stockPageButtons').innerHTML = '';
    return;
  }

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = filteredInventory.slice(start, end);

  tbody.innerHTML = pageItems.map(p => {
    const stock = parseInt(p.stock) || 0;
    const minStock = parseInt(p.minStock) || 5;
    const cost = parseFloat(p.buyingPrice) || 0;
    const stockValue = stock * cost;
    const maxRef = Math.max(minStock * 3, stock, 10);
    const pct = Math.min((stock / maxRef) * 100, 100);

    let barColor = '#22c55e';
    let badgeClass = 'in';
    let badgeText = 'In Stock';
    if (stock <= 0) {
      barColor = '#991b1b';
      badgeClass = 'out';
      badgeText = 'Out of Stock';
    } else if (stock <= minStock) {
      barColor = '#f59e0b';
      badgeClass = 'low';
      badgeText = 'Low Stock';
    }

    return `
      <tr>
        <td>
          <div class="product-cell">
            <div class="product-img">
              ${p.image ? `<img src="${p.image}" alt="">` : '<i class="fas fa-box"></i>'}
            </div>
            <div>
              <div class="product-name">${escapeHtml(p.name)}</div>
              <div class="product-barcode">${p.barcode || 'No barcode'}</div>
            </div>
          </div>
        </td>
        <td style="color: var(--text-secondary);">${p.sku || '-'}</td>
        <td><span class="stock-badge in" style="background: #e0e7ff; color: #4338ca;">${p.category || 'Uncategorized'}</span></td>
        <td style="text-align: center; font-weight: 600;">${stock}</td>
        <td style="text-align: center; color: var(--text-secondary);">${minStock}</td>
        <td><span class="stock-badge ${badgeClass}">${badgeText}</span></td>
        <td style="text-align: right; color: var(--text-secondary);">${formatPeso(cost)}</td>
        <td style="text-align: right; font-weight: 600;">${formatPeso(stockValue)}</td>
        <td style="text-align: center;">
          <div class="action-btns">
            <button class="action-btn" onclick="viewHistory('${p.productId}')" title="View History">
              <i class="fas fa-history"></i>
            </button>
            <button class="action-btn" onclick="quickAdjust('${p.productId}')" title="Quick Adjust">
              <i class="fas fa-edit"></i>
            </button>
          </div>
        </td>
      </tr>
      <tr>
        <td colspan="9" style="padding: 0 1rem 0.75rem 1rem; border-bottom: 1px solid var(--border-color);">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${pct}%; background: ${barColor};"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(filteredInventory.length, currentPage, 'stockPageInfo', 'stockPageButtons', (p) => {
    currentPage = p;
    renderInventoryTable();
  });
}

function resetInventoryFilters() {
  const search = document.getElementById('searchInventory');
  const cat = document.getElementById('categoryFilter');
  const status = document.getElementById('statusFilter');
  if (search) search.value = '';
  if (cat) cat.value = 'all';
  if (status) status.value = 'all';
  filterInventory();
  showToast('Filters reset', 'info');
}

// ============================================
// MOVEMENTS TABLE
// ============================================

function filterMovements() {
  const searchInput = document.getElementById('searchMovements');
  const typeFilter = document.getElementById('movementTypeFilter');
  const dateFromInput = document.getElementById('movementDateFrom');
  const dateToInput = document.getElementById('movementDateTo');

  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const type = typeFilter ? typeFilter.value : 'all';
  const dateFrom = dateFromInput ? dateFromInput.value : '';
  const dateTo = dateToInput ? dateToInput.value : '';

  filteredMovements = movements.map(mov => {
    const product = products.find(p => p.productId === mov.productId);
    return { ...mov, productName: product ? product.name : 'Unknown' };
  }).filter(mov => {
    const matchSearch = !search ||
      mov.productName.toLowerCase().includes(search) ||
      (mov.reference || '').toLowerCase().includes(search);
    const matchType = type === 'all' || mov.type === type;
    const movDate = new Date(mov.date).toISOString().split('T')[0];
    const matchDateFrom = !dateFrom || movDate >= dateFrom;
    const matchDateTo = !dateTo || movDate <= dateTo;
    return matchSearch && matchType && matchDateFrom && matchDateTo;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  movementPage = 1;
  renderMovementsTable();
}

function renderMovementsTable() {
  const tbody = document.getElementById('movementsTableBody');
  if (!tbody) return;

  if (filteredMovements.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <i class="fas fa-exchange-alt"></i>
            <h3>No movements found</h3>
            <p>Stock movements will appear here.</p>
          </div>
        </td>
      </tr>
    `;
    document.getElementById('movementPageInfo').textContent = 'Showing 0 of 0 items';
    document.getElementById('movementPageButtons').innerHTML = '';
    return;
  }

  const start = (movementPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = filteredMovements.slice(start, end);

  const typeLabels = {
    in: { class: 'in', label: 'Stock In', icon: 'fa-arrow-down' },
    out: { class: 'out', label: 'Stock Out', icon: 'fa-arrow-up' },
    sale: { class: 'sale', label: 'Sale', icon: 'fa-shopping-cart' },
    adjustment: { class: 'adjustment', label: 'Adjustment', icon: 'fa-sliders-h' },
    return: { class: 'return', label: 'Return', icon: 'fa-undo' }
  };

  tbody.innerHTML = pageItems.map(mov => {
    const tc = typeLabels[mov.type] || typeLabels.adjustment;
    const date = new Date(mov.date);
    const dateStr = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

    return `
      <tr>
        <td>
          <div style="font-weight: 500;">${dateStr}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">${timeStr}</div>
        </td>
        <td style="font-weight: 500;">${escapeHtml(mov.productName)}</td>
        <td>
          <span class="movement-type ${tc.class}">
            <i class="fas ${tc.icon}"></i> ${tc.label}
          </span>
        </td>
        <td style="text-align: center; font-weight: 600; color: ${mov.qty >= 0 ? '#22c55e' : '#ef4444'};">
          ${mov.qty >= 0 ? '+' : ''}${mov.qty}
        </td>
        <td style="text-align: center; color: var(--text-secondary);">${mov.beforeStock}</td>
        <td style="text-align: center; font-weight: 600;">${mov.afterStock}</td>
        <td style="color: var(--text-secondary); font-size: 0.875rem;">${mov.reference || '-'}</td>
        <td style="color: var(--text-secondary); font-size: 0.875rem;">${mov.by || 'System'}</td>
      </tr>
    `;
  }).join('');

  renderPagination(filteredMovements.length, movementPage, 'movementPageInfo', 'movementPageButtons', (p) => {
    movementPage = p;
    renderMovementsTable();
  });
}

function resetMovementFilters() {
  const search = document.getElementById('searchMovements');
  const type = document.getElementById('movementTypeFilter');
  if (search) search.value = '';
  if (type) type.value = 'all';
  setDefaultDates();
  filterMovements();
  showToast('Filters reset', 'info');
}

// ============================================
// PAGINATION
// ============================================

function renderPagination(total, page, infoId, buttonsId, onChange) {
  const totalPages = Math.ceil(total / itemsPerPage);
  const infoEl = document.getElementById(infoId);
  const buttonsEl = document.getElementById(buttonsId);

  if (!infoEl || !buttonsEl) return;

  const start = Math.min((page - 1) * itemsPerPage + 1, total);
  const end = Math.min(page * itemsPerPage, total);

  infoEl.textContent = total > 0
    ? `Showing ${start}-${end} of ${total} items`
    : 'Showing 0 of 0 items';

  if (totalPages <= 1) {
    buttonsEl.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button class="page-btn" onclick="goToPage('${infoId}', ${page - 1})" ${page === 1 ? 'disabled' : ''}>
    <i class="fas fa-chevron-left"></i>
  </button>`;

  const maxVisible = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `<button class="page-btn" onclick="goToPage('${infoId}', 1)">1</button>`;
    if (startPage > 2) html += `<span style="padding: 0.5rem; color: var(--text-secondary);">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToPage('${infoId}', ${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span style="padding: 0.5rem; color: var(--text-secondary);">...</span>`;
    html += `<button class="page-btn" onclick="goToPage('${infoId}', ${totalPages})">${totalPages}</button>`;
  }

  html += `<button class="page-btn" onclick="goToPage('${infoId}', ${page + 1})" ${page === totalPages ? 'disabled' : ''}>
    <i class="fas fa-chevron-right"></i>
  </button>`;

  buttonsEl.innerHTML = html;

  // Store callback
  window._pageCallbacks = window._pageCallbacks || {};
  window._pageCallbacks[infoId] = onChange;
}

function goToPage(infoId, page) {
  const cb = window._pageCallbacks[infoId];
  if (cb) cb(page);
}

// ============================================
// ALERTS
// ============================================

function checkStockAlerts() {
  const newAlerts = [];
  products.forEach(p => {
    const stock = parseInt(p.stock) || 0;
    const min = parseInt(p.minStock) || 5;

    if (stock <= 0) {
      newAlerts.push({
        id: 'ALERT-' + Date.now() + Math.random().toString(36).substr(2, 6),
        type: 'out',
        productId: p.productId,
        productName: p.name,
        message: `${p.name} is OUT OF STOCK`,
        date: new Date().toISOString(),
        read: false
      });
    } else if (stock <= min) {
      newAlerts.push({
        id: 'ALERT-' + Date.now() + Math.random().toString(36).substr(2, 6),
        type: 'low',
        productId: p.productId,
        productName: p.name,
        message: `${p.name} is running low (${stock} remaining)`,
        date: new Date().toISOString(),
        read: false
      });
    }
  });

  // Merge, avoid duplicates for same product+type
  const existingKeys = new Set(alerts.map(a => a.productId + '|' + a.type));
  newAlerts.forEach(a => {
    if (!existingKeys.has(a.productId + '|' + a.type)) {
      alerts.push(a);
    }
  });
  saveAlerts();
}

function renderAlerts() {
  const type = document.getElementById('alertTypeFilter');
  const typeVal = type ? type.value : 'all';
  const container = document.getElementById('alertsContainer');
  if (!container) return;

  const filtered = alerts
    .filter(a => typeVal === 'all' || a.type === typeVal)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-check-circle" style="color: #22c55e;"></i>
        <h3>All stock levels are healthy!</h3>
        <p>No low stock or out of stock alerts.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(a => {
    const isOut = a.type === 'out';
    const icon = isOut ? 'fa-times-circle' : 'fa-exclamation-triangle';
    const color = isOut ? '#dc2626' : '#d97706';
    const date = new Date(a.date).toLocaleDateString('en-PH', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    return `
      <div class="alert-item ${a.type} ${a.read ? 'read' : ''}">
        <i class="fas ${icon} alert-icon" style="color: ${color};"></i>
        <div class="alert-content">
          <div class="alert-title">${escapeHtml(a.message)}</div>
          <div class="alert-meta">${date}</div>
        </div>
        <button class="action-btn" onclick="markAlertRead('${a.id}')" title="Mark Read">
          <i class="fas fa-check"></i>
        </button>
      </div>
    `;
  }).join('');
}

function filterAlerts() {
  renderAlerts();
}

function markAlertRead(id) {
  const alert = alerts.find(a => a.id === id);
  if (alert) {
    alert.read = true;
    saveAlerts();
    renderAlerts();
  }
}

function markAllAlertsRead() {
  alerts.forEach(a => a.read = true);
  saveAlerts();
  renderAlerts();
  showToast('All alerts marked as read', 'success');
}

// ============================================
// STOCK ADJUSTMENT MODAL
// ============================================

function populateProductSelect() {
  const select = document.getElementById('adjustProduct');
  if (!select) return;
  select.innerHTML = '<option value="">Select a product</option>' +
    products.map(p => `<option value="${p.productId}">${escapeHtml(p.name)} (${p.sku || 'No SKU'})</option>`).join('');
}

function onAdjustProductChange() {
  const productId = document.getElementById('adjustProduct').value;
  if (!productId) {
    document.getElementById('adjustCurrentStock').value = '';
    document.getElementById('adjustMinStock').value = '';
    return;
  }
  const product = products.find(p => p.productId === productId);
  const inv = inventory.find(i => i.productId === productId);
  document.getElementById('adjustCurrentStock').value = product ? (product.stock || 0) : 0;
  document.getElementById('adjustMinStock').value = product ? (product.minStock || 5) : 5;
  document.getElementById('adjustCost').value = product ? (product.buyingPrice || '') : '';
}

function openStockModal() {
  document.getElementById('stockModalOverlay').classList.add('active');
  document.getElementById('adjustProduct').value = '';
  document.getElementById('adjustCurrentStock').value = '';
  document.getElementById('adjustMinStock').value = '';
  document.getElementById('adjustQty').value = '';
  document.getElementById('adjustCost').value = '';
  document.getElementById('adjustNotes').value = '';
}

function closeStockModal() {
  document.getElementById('stockModalOverlay').classList.remove('active');
}

function quickAdjust(productId) {
  const select = document.getElementById('adjustProduct');
  if (select) select.value = productId;
  onAdjustProductChange();
  openStockModal();
}

async function saveAdjustment() {
  const productId = document.getElementById('adjustProduct').value;
  const type = document.getElementById('adjustType').value;
  const qty = parseInt(document.getElementById('adjustQty').value) || 0;
  const cost = parseFloat(document.getElementById('adjustCost').value) || 0;
  const notes = document.getElementById('adjustNotes').value.trim();

  if (!productId) { showToast('Please select a product', 'error'); return; }
  if (qty <= 0) { showToast('Please enter a valid quantity', 'error'); return; }

  const product = products.find(p => p.productId === productId);
  const beforeStock = parseInt(product.stock) || 0;
  let afterStock = beforeStock;
  let movementQty = 0;

  if (type === 'in') {
    afterStock = beforeStock + qty;
    movementQty = qty;
  } else if (type === 'out') {
    if (qty > beforeStock) { showToast('Not enough stock to remove', 'error'); return; }
    afterStock = beforeStock - qty;
    movementQty = -qty;
  } else if (type === 'adjustment') {
    afterStock = qty;
    movementQty = qty - beforeStock;
  }

  // Update product stock
  product.stock = afterStock;

  // Update inventory record
  const inv = inventory.find(i => i.productId === productId);
  if (inv) {
    inv.currentStock = afterStock;
    inv.lastUpdated = new Date().toISOString();
    inv.status = getStockStatus(afterStock, inv.reorderLevel);
  }

  // Record movement
  const movement = {
    id: generateId(),
    productId: productId,
    type: type === 'adjustment' ? 'adjustment' : (type === 'in' ? 'in' : 'out'),
    qty: movementQty,
    beforeStock: beforeStock,
    afterStock: afterStock,
    reference: notes || (type === 'adjustment' ? 'Stock Adjustment' : (type === 'in' ? 'Stock In' : 'Stock Out')),
    date: new Date().toISOString(),
    by: currentUser.name || currentUser.email || 'Admin'
  };
  movements.push(movement);

  // Save locally
  saveInventory();
  saveMovements();
  localStorage.setItem('cloudpos_products', JSON.stringify(products));

  // Try API
  try {
    await apiCall('updateProduct', {
      productId: productId,
      stock: afterStock
    });
    await apiCall('addStockMovement', movement);
  } catch (e) {
    console.log('API update failed, using localStorage fallback');
  }

  closeStockModal();
  updateStats();
  filterInventory();
  filterMovements();
  checkStockAlerts();
  renderAlerts();

  const msg = type === 'in' ? `Added ${qty} units to ${product.name}` :
              type === 'out' ? `Removed ${qty} units from ${product.name}` :
              `Adjusted ${product.name} stock to ${afterStock}`;
  showToast(msg, 'success');
}

// ============================================
// HISTORY MODAL
// ============================================

function viewHistory(productId) {
  const product = products.find(p => p.productId === productId);
  document.getElementById('historyTitle').textContent = `Stock History — ${product ? product.name : 'Unknown'}`;

  const productMovements = movements
    .filter(m => m.productId === productId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const body = document.getElementById('historyBody');
  if (productMovements.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-history"></i>
        <h3>No movements yet</h3>
        <p>Stock changes will appear here.</p>
      </div>
    `;
  } else {
    const typeLabels = {
      in: 'Stock In', out: 'Stock Out', sale: 'Sale',
      adjustment: 'Adjustment', return: 'Return'
    };
    body.innerHTML = productMovements.map(mov => {
      const date = new Date(mov.date).toLocaleDateString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      return `
        <div class="history-item ${mov.type}">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: 600; font-size: 0.875rem;">${typeLabels[mov.type] || mov.type}</span>
              <span style="margin-left: 0.5rem; font-weight: 700; color: ${mov.qty >= 0 ? '#22c55e' : '#ef4444'};">
                ${mov.qty >= 0 ? '+' : ''}${mov.qty}
              </span>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-secondary);">${date}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 0.375rem; font-size: 0.8125rem; color: var(--text-secondary);">
            <span>Before: ${mov.beforeStock} → After: ${mov.afterStock}</span>
            <span>${mov.by || 'System'}</span>
          </div>
          ${mov.reference ? `<p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${escapeHtml(mov.reference)}</p>` : ''}
        </div>
      `;
    }).join('');
  }
  document.getElementById('historyModalOverlay').classList.add('active');
}

function closeHistoryModal() {
  document.getElementById('historyModalOverlay').classList.remove('active');
}

// ============================================
// EXPORT
// ============================================

function exportInventory() {
  if (filteredInventory.length === 0) {
    showToast('No data to export', 'warning');
    return;
  }

  const headers = ['Product', 'SKU', 'Category', 'Stock', 'Min Level', 'Status', 'Buying Price', 'Stock Value'];

  const rows = filteredInventory.map(p => {
    const stock = parseInt(p.stock) || 0;
    const cost = parseFloat(p.buyingPrice) || 0;
    const status = getStockStatus(stock, parseInt(p.minStock) || 5);
    return [
      p.name, p.sku || '', p.category || '', stock, p.minStock || 5,
      status, cost, stock * cost
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '\"')}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.href = URL.createObjectURL(blob);
  link.download = `inventory_${dateStr}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);

  showToast(`Exported ${filteredInventory.length} items to CSV`, 'success');
}

// ============================================
// POS INTEGRATION — Record Sale Movement
// ============================================

function recordSaleMovement(saleData) {
  if (!saleData || !saleData.items) return;

  saleData.items.forEach(item => {
    const product = products.find(p => p.productId === item.productId);
    if (!product) return;

    const beforeStock = parseInt(product.stock) || 0;
    const qty = parseInt(item.quantity) || 0;
    const afterStock = beforeStock - qty;

    // Update product stock
    product.stock = afterStock;

    // Update inventory record
    const inv = inventory.find(i => i.productId === item.productId);
    if (inv) {
      inv.currentStock = afterStock;
      inv.lastUpdated = new Date().toISOString();
      inv.status = getStockStatus(afterStock, inv.reorderLevel);
    }

    // Record movement
    movements.push({
      id: generateId(),
      productId: item.productId,
      type: 'sale',
      qty: -qty,
      beforeStock: beforeStock,
      afterStock: afterStock,
      reference: `Sale #${saleData.saleId || saleData.id || 'OFF-' + Date.now()}`,
      date: new Date().toISOString(),
      by: saleData.cashierName || saleData.cashierId || currentUser.name || 'POS'
    });
  });

  // Save everything
  localStorage.setItem('cloudpos_products', JSON.stringify(products));
  saveInventory();
  saveMovements();

  // Refresh UI if on inventory page
  if (document.getElementById('inventoryTableBody')) {
    updateStats();
    filterInventory();
    filterMovements();
    checkStockAlerts();
    renderAlerts();
  }
}

// Expose for pos.js
window.recordSaleMovement = recordSaleMovement;

// ============================================
// UTILITIES
// ============================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function loadTheme() {
  const savedTheme = localStorage.getItem('cloudpos_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

// ============================================
// EXPOSE TO GLOBAL SCOPE
// ============================================

window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
};

window.logout = logout;
window.switchTab = switchTab;
window.filterInventory = filterInventory;
window.resetInventoryFilters = resetInventoryFilters;
window.filterMovements = filterMovements;
window.resetMovementFilters = resetMovementFilters;
window.goToPage = goToPage;
window.openStockModal = openStockModal;
window.closeStockModal = closeStockModal;
window.onAdjustProductChange = onAdjustProductChange;
window.saveAdjustment = saveAdjustment;
window.quickAdjust = quickAdjust;
window.viewHistory = viewHistory;
window.closeHistoryModal = closeHistoryModal;
window.exportInventory = exportInventory;
window.filterAlerts = filterAlerts;
window.markAlertRead = markAlertRead;
window.markAllAlertsRead = markAllAlertsRead;

window.toggleTheme = function() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cloudpos_theme', next);
  const icon = document.querySelector('#themeToggle i');
  if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
};
