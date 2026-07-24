// ============================================
// CloudPOS Customers Module
// Customer Management & Loyalty Tracking
// ============================================

import { apiCall } from './api.js';
import { getCurrentUser, logout, showToast } from './auth.js';
import { formatPeso } from './utils.js';

// Global state
let customers = [];
let sales = [];
let filteredCustomers = [];
let currentPage = 1;
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
  await loadData();
  updateStats();
  filterCustomers();
});

async function loadData() {
  // Load customers
  try {
    const response = await apiCall('getCustomers');
    if (response.status === 'success') {
      customers = response.data || [];
    }
  } catch (error) {
    console.error('Load customers error:', error);
    customers = JSON.parse(localStorage.getItem('cloudpos_customers') || '[]');
  }

  // Load sales for revenue calculation
  try {
    const response = await apiCall('getSales');
    if (response.status === 'success') {
      sales = response.data || [];
    }
  } catch (error) {
    console.error('Load sales error:', error);
    sales = JSON.parse(localStorage.getItem('cloudpos_sales') || '[]');
  }

  // Calculate customer stats from sales
  calculateCustomerStats();
}

function calculateCustomerStats() {
  // For each customer, calculate total spent and order count from sales
  customers.forEach(c => {
    const customerSales = sales.filter(s =>
      s.customerId === c.customerId ||
      s.customerName === c.name ||
      s.customerPhone === c.phone
    );
    c.totalSpent = customerSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    c.orderCount = customerSales.length;
    c.lastPurchase = customerSales.length > 0
      ? new Date(Math.max(...customerSales.map(s => new Date(s.createdAt || s.date))))
      : null;
  });
}

function saveCustomers() {
  localStorage.setItem('cloudpos_customers', JSON.stringify(customers));
}

function generateId() {
  return 'CUST-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4).toUpperCase();
}

// ============================================
// STATS
// ============================================

function updateStats() {
  const total = customers.length;
  const active = customers.filter(c => c.status === 'Active').length;
  const vip = customers.filter(c => c.tier === 'VIP').length;
  const revenue = customers.reduce((sum, c) => sum + (parseFloat(c.totalSpent) || 0), 0);

  const statTotal = document.getElementById('statTotalCustomers');
  const statActive = document.getElementById('statActiveCustomers');
  const statVIP = document.getElementById('statVIPCustomers');
  const statRevenue = document.getElementById('statCustomerRevenue');

  if (statTotal) statTotal.textContent = total;
  if (statActive) statActive.textContent = active;
  if (statVIP) statVIP.textContent = vip;
  if (statRevenue) statRevenue.textContent = formatPeso(revenue);
}

// ============================================
// CUSTOMERS TABLE
// ============================================

function filterCustomers() {
  const searchInput = document.getElementById('searchCustomers');
  const tierFilter = document.getElementById('tierFilter');
  const statusFilter = document.getElementById('statusFilter');

  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const tier = tierFilter ? tierFilter.value : 'all';
  const status = statusFilter ? statusFilter.value : 'all';

  filteredCustomers = customers.filter(c => {
    const fullName = `${c.firstName || ''} ${c.lastName || ''} ${c.name || ''}`.toLowerCase();
    const matchSearch = !search ||
      fullName.includes(search) ||
      (c.email || '').toLowerCase().includes(search) ||
      (c.phone || '').toLowerCase().includes(search);
    const matchTier = tier === 'all' || c.tier === tier;
    const matchStatus = status === 'all' || c.status === status;
    return matchSearch && matchTier && matchStatus;
  });

  currentPage = 1;
  renderCustomersTable();
}

function renderCustomersTable() {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;

  if (filteredCustomers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <i class="fas fa-users"></i>
            <h3>No customers found</h3>
            <p>Add customers to get started.</p>
          </div>
        </td>
      </tr>
    `;
    document.getElementById('customersPageInfo').textContent = 'Showing 0 of 0 customers';
    document.getElementById('customersPageButtons').innerHTML = '';
    return;
  }

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = filteredCustomers.slice(start, end);

  tbody.innerHTML = pageItems.map(c => {
    const name = c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const totalSpent = parseFloat(c.totalSpent) || 0;
    const orders = parseInt(c.orderCount) || 0;

    return `
      <tr>
        <td>
          <div class="customer-cell">
            <div class="customer-avatar">${initials}</div>
            <div>
              <div class="customer-name">${escapeHtml(name)}</div>
              <div class="customer-email">${c.email || 'No email'}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-size: 0.875rem;">${c.phone || '-'}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">${c.address || ''}</div>
        </td>
        <td><span class="tier-badge ${(c.tier || 'regular').toLowerCase()}">${c.tier || 'Regular'}</span></td>
        <td style="text-align: right; font-weight: 600;">${formatPeso(totalSpent)}</td>
        <td style="text-align: center; font-weight: 600;">${orders}</td>
        <td><span class="status-badge ${(c.status || 'Active').toLowerCase()}">${c.status || 'Active'}</span></td>
        <td style="text-align: right;">
          <div class="action-btns">
            <button class="action-btn" onclick="viewCustomer('${c.customerId}')" title="View Details">
              <i class="fas fa-eye"></i>
            </button>
            <button class="action-btn" onclick="editCustomer('${c.customerId}')" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn danger" onclick="deleteCustomer('${c.customerId}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(filteredCustomers.length, currentPage, 'customersPageInfo', 'customersPageButtons', (p) => {
    currentPage = p;
    renderCustomersTable();
  });
}

function resetCustomerFilters() {
  const search = document.getElementById('searchCustomers');
  const tier = document.getElementById('tierFilter');
  const status = document.getElementById('statusFilter');
  if (search) search.value = '';
  if (tier) tier.value = 'all';
  if (status) status.value = 'all';
  filterCustomers();
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
    ? `Showing ${start}-${end} of ${total} customers`
    : 'Showing 0 of 0 customers';

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

  window._pageCallbacks = window._pageCallbacks || {};
  window._pageCallbacks[infoId] = onChange;
}

function goToPage(infoId, page) {
  const cb = window._pageCallbacks[infoId];
  if (cb) cb(page);
}

// ============================================
// CUSTOMER MODAL (Add/Edit)
// ============================================

function openCustomerModal(customerId = null) {
  const form = document.getElementById('customerForm');
  if (form) form.reset();

  const idInput = document.getElementById('customerId');
  if (idInput) idInput.value = '';

  if (customerId) {
    const c = customers.find(x => x.customerId === customerId);
    if (!c) return;

    document.getElementById('modalTitle').textContent = 'Edit Customer';
    if (idInput) idInput.value = c.customerId;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('firstName', c.firstName);
    setVal('lastName', c.lastName);
    setVal('email', c.email);
    setVal('phone', c.phone);
    setVal('address', c.address);
    setVal('tier', c.tier || 'Regular');
    setVal('status', c.status || 'Active');
    setVal('notes', c.notes);
  } else {
    document.getElementById('modalTitle').textContent = 'Add Customer';
  }

  document.getElementById('customerModalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCustomerModal() {
  document.getElementById('customerModalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

async function saveCustomer(e) {
  e.preventDefault();

  const customerId = document.getElementById('customerId');
  const firstName = document.getElementById('firstName');
  const lastName = document.getElementById('lastName');
  const email = document.getElementById('email');
  const phone = document.getElementById('phone');
  const address = document.getElementById('address');
  const tier = document.getElementById('tier');
  const status = document.getElementById('status');
  const notes = document.getElementById('notes');

  if (!firstName || !firstName.value.trim()) {
    showToast('First name is required', 'error');
    return;
  }
  if (!lastName || !lastName.value.trim()) {
    showToast('Last name is required', 'error');
    return;
  }
  if (!phone || !phone.value.trim()) {
    showToast('Phone number is required', 'error');
    return;
  }

  const data = {
    firstName: firstName.value.trim(),
    lastName: lastName.value.trim(),
    name: `${firstName.value.trim()} ${lastName.value.trim()}`,
    email: email && email.value ? email.value.trim() : '',
    phone: phone.value.trim(),
    address: address && address.value ? address.value.trim() : '',
    tier: tier && tier.value ? tier.value : 'Regular',
    status: status && status.value ? status.value : 'Active',
    notes: notes && notes.value ? notes.value.trim() : ''
  };

  try {
    const action = customerId && customerId.value ? 'updateCustomer' : 'addCustomer';
    if (customerId && customerId.value) data.customerId = customerId.value;

    const response = await apiCall(action, data);

    if (response.status === 'success') {
      showToast(customerId && customerId.value ? 'Customer updated!' : 'Customer added!', 'success');
      closeCustomerModal();
      await loadData();
      updateStats();
      filterCustomers();
    } else {
      showToast(response.message || 'Failed to save', 'error');
    }
  } catch (error) {
    console.error('Save error:', error);
    // Fallback to localStorage
    if (customerId && customerId.value) {
      const idx = customers.findIndex(c => c.customerId === customerId.value);
      if (idx >= 0) customers[idx] = { ...customers[idx], ...data };
    } else {
      data.customerId = generateId();
      data.totalSpent = 0;
      data.orderCount = 0;
      data.createdAt = new Date().toISOString();
      customers.push(data);
    }
    saveCustomers();
    showToast('Saved locally (API unavailable)', 'warning');
    closeCustomerModal();
    updateStats();
    filterCustomers();
  }
}

function editCustomer(customerId) {
  openCustomerModal(customerId);
}

async function deleteCustomer(customerId) {
  if (!confirm('Are you sure you want to delete this customer?')) return;

  try {
    const response = await apiCall('deleteCustomer', { customerId });
    if (response.status === 'success') {
      showToast('Customer deleted', 'success');
      customers = customers.filter(c => c.customerId !== customerId);
      saveCustomers();
      updateStats();
      filterCustomers();
    } else {
      showToast(response.message || 'Failed to delete', 'error');
    }
  } catch (error) {
    console.error('Delete error:', error);
    customers = customers.filter(c => c.customerId !== customerId);
    saveCustomers();
    updateStats();
    filterCustomers();
    showToast('Deleted locally (API unavailable)', 'warning');
  }
}

// ============================================
// CUSTOMER DETAIL MODAL
// ============================================

function viewCustomer(customerId) {
  const c = customers.find(x => x.customerId === customerId);
  if (!c) return;

  const name = c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const totalSpent = parseFloat(c.totalSpent) || 0;
  const orders = parseInt(c.orderCount) || 0;

  // Get customer sales
  const customerSales = sales.filter(s =>
    s.customerId === customerId ||
    s.customerName === name ||
    s.customerPhone === c.phone
  ).sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  const body = document.getElementById('detailBody');
  body.innerHTML = `
    <div class="detail-header">
      <div class="detail-avatar">${initials}</div>
      <div class="detail-name">${escapeHtml(name)}</div>
      <div class="detail-tier"><span class="tier-badge ${(c.tier || 'regular').toLowerCase()}">${c.tier || 'Regular'}</span></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title"><i class="fas fa-info-circle"></i> Contact Information</div>
      <div class="detail-row">
        <span class="detail-label">Email</span>
        <span class="detail-value">${c.email || '-'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Phone</span>
        <span class="detail-value">${c.phone || '-'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Address</span>
        <span class="detail-value">${c.address || '-'}</span>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title"><i class="fas fa-chart-pie"></i> Summary</div>
      <div class="detail-row">
        <span class="detail-label">Total Spent</span>
        <span class="detail-value">${formatPeso(totalSpent)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Total Orders</span>
        <span class="detail-value">${orders}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value"><span class="status-badge ${(c.status || 'active').toLowerCase()}">${c.status || 'Active'}</span></span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Member Since</span>
        <span class="detail-value">${c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-PH') : '-'}</span>
      </div>
      ${c.notes ? `
        <div class="detail-row">
          <span class="detail-label">Notes</span>
          <span class="detail-value">${escapeHtml(c.notes)}</span>
        </div>
      ` : ''}
    </div>

    <div class="detail-section">
      <div class="detail-section-title"><i class="fas fa-shopping-bag"></i> Recent Purchases (${customerSales.length})</div>
      ${customerSales.length === 0 ? `
        <p style="text-align: center; color: var(--text-secondary); padding: 1rem; font-size: 0.875rem;">No purchases yet</p>
      ` : customerSales.slice(0, 5).map(s => {
        const date = new Date(s.createdAt || s.date);
        return `
          <div class="purchase-item">
            <div>
              <div style="font-weight: 600;">${s.saleId || 'Sale'}</div>
              <div class="purchase-date">${date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
            <div class="purchase-total">${formatPeso(s.total)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  document.getElementById('detailModalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
  document.getElementById('detailModalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================
// EXPORT
// ============================================

function exportCustomers() {
  if (customers.length === 0) {
    showToast('No customers to export', 'warning');
    return;
  }

  const headers = ['Customer ID', 'Name', 'Email', 'Phone', 'Address', 'Tier', 'Status', 'Total Spent', 'Orders', 'Notes'];

  const rows = customers.map(c => {
    const name = c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim();
    return [
      c.customerId || '',
      name,
      c.email || '',
      c.phone || '',
      c.address || '',
      c.tier || 'Regular',
      c.status || 'Active',
      parseFloat(c.totalSpent) || 0,
      parseInt(c.orderCount) || 0,
      (c.notes || '').replace(/,/g, ';')
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
  link.download = `customers_${dateStr}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);

  showToast(`Exported ${customers.length} customers to CSV`, 'success');
}

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
window.filterCustomers = filterCustomers;
window.resetCustomerFilters = resetCustomerFilters;
window.goToPage = goToPage;
window.openCustomerModal = openCustomerModal;
window.closeCustomerModal = closeCustomerModal;
window.saveCustomer = saveCustomer;
window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;
window.viewCustomer = viewCustomer;
window.closeDetailModal = closeDetailModal;
window.exportCustomers = exportCustomers;

window.toggleTheme = function() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cloudpos_theme', next);
  const icon = document.querySelector('#themeToggle i');
  if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
};
