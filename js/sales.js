// ============================================
// CloudPOS Sales Module
// Sales History & Transaction Management
// ============================================

import { apiCall } from './api.js';
import { getCurrentUser, logout, showToast } from './auth.js';
import { formatPeso } from './utils.js';

// Global state
let allSales = [];
let filteredSales = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentSale = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  loadTheme();
  setDefaultDates();
  await loadSales();
});

function setDefaultDates() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const toDate = document.getElementById('dateTo');
  const fromDate = document.getElementById('dateFrom');

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
// LOAD SALES
// ============================================

async function loadSales() {
  try {
    const response = await apiCall('getSales');

    if (response.status === 'success') {
      allSales = response.data || [];
      // Sort by date descending
      allSales.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
      filterSales();
    } else {
      showToast('Failed to load sales', 'error');
      renderEmptyState();
    }
  } catch (error) {
    console.error('Load sales error:', error);
    // Fallback: try to load from localStorage if API fails
    const localSales = localStorage.getItem('cloudpos_sales');
    if (localSales) {
      allSales = JSON.parse(localSales);
      allSales.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
      filterSales();
    } else {
      renderEmptyState();
    }
  }
}

// ============================================
// FILTER & SEARCH
// ============================================

function filterSales() {
  const searchInput = document.getElementById('searchSales');
  const dateFromInput = document.getElementById('dateFrom');
  const dateToInput = document.getElementById('dateTo');
  const paymentFilter = document.getElementById('paymentFilter');

  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const dateFrom = dateFromInput ? dateFromInput.value : '';
  const dateTo = dateToInput ? dateToInput.value : '';
  const payment = paymentFilter ? paymentFilter.value : 'all';

  filteredSales = allSales.filter(sale => {
    // Search filter
    if (search) {
      const searchable = [
        sale.saleId || '',
        sale.cashierName || sale.cashierId || '',
        sale.notes || '',
        sale.customerName || sale.customerId || ''
      ].join(' ').toLowerCase();
      if (!searchable.includes(search)) return false;
    }

    // Date filter
    const saleDate = new Date(sale.createdAt || sale.date);
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      if (saleDate < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (saleDate > to) return false;
    }

    // Payment method filter
    if (payment !== 'all') {
      if ((sale.paymentMethod || '').toUpperCase() !== payment) return false;
    }

    return true;
  });

  currentPage = 1;
  updateStats();
  renderSalesTable();
  renderPagination();
}

function resetFilters() {
  const searchInput = document.getElementById('searchSales');
  const paymentFilter = document.getElementById('paymentFilter');

  if (searchInput) searchInput.value = '';
  if (paymentFilter) paymentFilter.value = 'all';

  setDefaultDates();
  filterSales();
  showToast('Filters reset', 'info');
}

// ============================================
// STATS
// ============================================

function updateStats() {
  const totalSales = filteredSales.length;
  const revenue = filteredSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
  const itemsSold = filteredSales.reduce((sum, s) => {
    const items = s.items || [];
    return sum + items.reduce((itemSum, item) => itemSum + (parseInt(item.quantity) || 0), 0);
  }, 0);
  const avgSale = totalSales > 0 ? revenue / totalSales : 0;

  const statTotalSales = document.getElementById('statTotalSales');
  const statRevenue = document.getElementById('statRevenue');
  const statItemsSold = document.getElementById('statItemsSold');
  const statAvgSale = document.getElementById('statAvgSale');

  if (statTotalSales) statTotalSales.textContent = totalSales.toLocaleString();
  if (statRevenue) statRevenue.textContent = formatPeso(revenue);
  if (statItemsSold) statItemsSold.textContent = itemsSold.toLocaleString();
  if (statAvgSale) statAvgSale.textContent = formatPeso(avgSale);
}

// ============================================
// RENDER TABLE
// ============================================

function renderSalesTable() {
  const tbody = document.getElementById('salesTableBody');
  if (!tbody) return;

  if (filteredSales.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-sales">
            <i class="fas fa-receipt"></i>
            <h3>No sales found</h3>
            <p>Try adjusting your filters or make a sale at the POS.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageSales = filteredSales.slice(start, end);

  tbody.innerHTML = pageSales.map(sale => {
    const date = new Date(sale.createdAt || sale.date);
    const dateStr = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    const items = sale.items || [];
    const itemCount = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
    const method = (sale.paymentMethod || 'CASH').toLowerCase();

    return `
      <tr>
        <td><span class="sale-id">${sale.saleId || 'N/A'}</span></td>
        <td>
          <div style="font-weight: 600;">${dateStr}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">${timeStr}</div>
        </td>
        <td>
          <div style="font-weight: 600;">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">${items.length} product${items.length !== 1 ? 's' : ''}</div>
        </td>
        <td>
          <span class="payment-badge ${method}">
            <i class="fas ${getPaymentIcon(method)}"></i>
            ${sale.paymentMethod || 'CASH'}
          </span>
        </td>
        <td>${sale.cashierName || sale.cashierId || 'Unknown'}</td>
        <td style="text-align: right;">
          <div class="sale-total">${formatPeso(sale.total)}</div>
        </td>
        <td style="text-align: right;">
          <div class="action-btns">
            <button class="action-btn" onclick="viewReceipt('${sale.saleId}')" title="View Receipt">
              <i class="fas fa-eye"></i>
            </button>
            <button class="action-btn" onclick="printSaleReceipt('${sale.saleId}')" title="Print">
              <i class="fas fa-print"></i>
            </button>
            <button class="action-btn danger" onclick="deleteSale('${sale.saleId}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getPaymentIcon(method) {
  const icons = {
    cash: 'fa-money-bill-wave',
    gcash: 'fa-mobile-alt',
    maya: 'fa-credit-card',
    bank: 'fa-university'
  };
  return icons[method] || 'fa-money-bill-wave';
}

// ============================================
// PAGINATION
// ============================================

function renderPagination() {
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const pageInfo = document.getElementById('pageInfo');
  const pageButtons = document.getElementById('pageButtons');

  if (!pageInfo || !pageButtons) return;

  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, filteredSales.length);

  pageInfo.textContent = filteredSales.length > 0
    ? `Showing ${start}-${end} of ${filteredSales.length} sales`
    : 'Showing 0 of 0 sales';

  if (totalPages <= 1) {
    pageButtons.innerHTML = '';
    return;
  }

  let buttons = '';

  // Previous
  buttons += `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
    <i class="fas fa-chevron-left"></i>
  </button>`;

  // Page numbers
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    buttons += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) buttons += `<span style="padding: 0.5rem; color: var(--text-secondary);">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    buttons += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) buttons += `<span style="padding: 0.5rem; color: var(--text-secondary);">...</span>`;
    buttons += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }

  // Next
  buttons += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
    <i class="fas fa-chevron-right"></i>
  </button>`;

  pageButtons.innerHTML = buttons;
}

function goToPage(page) {
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderSalesTable();
  renderPagination();
}

function renderEmptyState() {
  const tbody = document.getElementById('salesTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-sales">
            <i class="fas fa-receipt"></i>
            <h3>No sales yet</h3>
            <p>Complete a sale at the POS to see it here.</p>
          </div>
        </td>
      </tr>
    `;
  }
}

// ============================================
// RECEIPT MODAL
// ============================================

function viewReceipt(saleId) {
  const sale = allSales.find(s => s.saleId === saleId);
  if (!sale) {
    showToast('Sale not found', 'error');
    return;
  }

  currentSale = sale;
  const modalBody = document.getElementById('receiptModalBody');
  if (!modalBody) return;

  const date = new Date(sale.createdAt || sale.date);
  const items = sale.items || [];
  const change = (parseFloat(sale.cashReceived) || 0) - (parseFloat(sale.total) || 0);

  modalBody.innerHTML = `
    <div class="receipt-content">
      <div class="receipt-header">
        <h2>CloudPOS</h2>
        <p>Official Receipt</p>
        <p>${date.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p>${date.toLocaleTimeString('en-PH')}</p>
        <p style="font-family: monospace; font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.6;">${sale.saleId}</p>
      </div>

      <div class="receipt-items">
        ${items.map(item => `
          <div class="receipt-item">
            <div class="receipt-item-name">${escapeHtml(item.name || 'Unknown')}</div>
            <div class="receipt-item-qty">x${item.quantity}</div>
            <div class="receipt-item-price">${formatPeso(item.total || item.unitPrice * item.quantity)}</div>
          </div>
        `).join('')}
      </div>

      <div class="receipt-summary">
        <div class="receipt-summary-row">
          <span>Subtotal</span>
          <span>${formatPeso(sale.subtotal)}</span>
        </div>
        ${sale.discount > 0 ? `
          <div class="receipt-summary-row">
            <span>Discount</span>
            <span>-${formatPeso(sale.discount)}</span>
          </div>
        ` : ''}
        ${sale.tax > 0 ? `
          <div class="receipt-summary-row">
            <span>Tax</span>
            <span>${formatPeso(sale.tax)}</span>
          </div>
        ` : ''}
        <div class="receipt-summary-row total">
          <span>TOTAL</span>
          <span>${formatPeso(sale.total)}</span>
        </div>
        <div class="receipt-summary-row">
          <span>Payment (${sale.paymentMethod || 'CASH'})</span>
          <span>${formatPeso(sale.cashReceived || sale.total)}</span>
        </div>
        ${change > 0 ? `
          <div class="receipt-summary-row">
            <span>Change</span>
            <span>${formatPeso(change)}</span>
          </div>
        ` : ''}
      </div>

      <div class="receipt-footer">
        <p><strong>Cashier:</strong> ${sale.cashierName || sale.cashierId || 'Unknown'}</p>
        ${sale.notes ? `<p><strong>Notes:</strong> ${escapeHtml(sale.notes)}</p>` : ''}
        <p style="margin-top: 1rem;">Thank you for your purchase!</p>
        <p>Please come again</p>
      </div>
    </div>
  `;

  const overlay = document.getElementById('receiptModalOverlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeReceiptModal() {
  const overlay = document.getElementById('receiptModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
  currentSale = null;
}

function printSaleReceipt(saleId) {
  const sale = allSales.find(s => s.saleId === saleId);
  if (!sale) {
    showToast('Sale not found', 'error');
    return;
  }

  currentSale = sale;
  viewReceipt(saleId);
  setTimeout(() => printReceiptModal(), 300);
}

function printReceiptModal() {
  if (!currentSale) return;

  const receiptContent = document.getElementById('receiptModalBody').innerHTML;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${currentSale.saleId}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', sans-serif;
            width: 320px;
            margin: 0 auto;
            padding: 20px;
            color: #1e293b;
            background: #fff;
          }
          .receipt-header { text-align: center; border-bottom: 2px dashed #e2e8f0; padding-bottom: 15px; margin-bottom: 15px; }
          .receipt-header h2 { font-size: 18px; margin-bottom: 4px; }
          .receipt-header p { font-size: 12px; color: #64748b; margin: 2px 0; }
          .receipt-items { margin-bottom: 15px; }
          .receipt-item { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
          .receipt-item:last-child { border-bottom: none; }
          .receipt-item-name { flex: 1; }
          .receipt-item-qty { color: #94a3b8; margin: 0 10px; font-size: 11px; }
          .receipt-item-price { font-weight: 600; }
          .receipt-summary { border-top: 2px dashed #e2e8f0; padding-top: 12px; margin-top: 12px; }
          .receipt-summary-row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; color: #64748b; }
          .receipt-summary-row.total { font-size: 16px; font-weight: 700; color: #1e293b; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 6px; }
          .receipt-footer { text-align: center; border-top: 2px dashed #e2e8f0; padding-top: 15px; margin-top: 15px; font-size: 12px; color: #64748b; }
          .receipt-footer p { margin: 3px 0; }
          @media print { body { width: 300px; } }
        </style>
      </head>
      <body>
        ${receiptContent}
        <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 500); };</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// ============================================
// DELETE SALE
// ============================================

async function deleteSale(saleId) {
  if (!confirm('Are you sure you want to delete this sale? This action cannot be undone.')) return;

  try {
    const response = await apiCall('deleteSale', { saleId });

    if (response.status === 'success') {
      showToast('Sale deleted', 'success');
      allSales = allSales.filter(s => s.saleId !== saleId);
      filterSales();
    } else {
      showToast(response.message || 'Failed to delete sale', 'error');
    }
  } catch (error) {
    console.error('Delete sale error:', error);
    // Fallback: remove from localStorage
    allSales = allSales.filter(s => s.saleId !== saleId);
    localStorage.setItem('cloudpos_sales', JSON.stringify(allSales));
    filterSales();
    showToast('Sale deleted (local)', 'success');
  }
}

// ============================================
// EXPORT CSV
// ============================================

function exportSales() {
  if (filteredSales.length === 0) {
    showToast('No sales to export', 'warning');
    return;
  }

  const headers = ['Sale ID', 'Date', 'Time', 'Items', 'Payment Method', 'Cashier', 'Subtotal', 'Discount', 'Tax', 'Total', 'Notes'];

  const rows = filteredSales.map(sale => {
    const date = new Date(sale.createdAt || sale.date);
    const items = sale.items || [];
    const itemNames = items.map(i => `${i.name}(x${i.quantity})`).join('; ');

    return [
      sale.saleId || '',
      date.toLocaleDateString('en-PH'),
      date.toLocaleTimeString('en-PH'),
      itemNames,
      sale.paymentMethod || 'CASH',
      sale.cashierName || sale.cashierId || '',
      sale.subtotal || 0,
      sale.discount || 0,
      sale.tax || 0,
      sale.total || 0,
      (sale.notes || '').replace(/,/g, ';')
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.href = URL.createObjectURL(blob);
  link.download = `sales_export_${dateStr}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);

  showToast(`Exported ${filteredSales.length} sales to CSV`, 'success');
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
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ============================================

window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
};

window.logout = logout;
window.filterSales = filterSales;
window.resetFilters = resetFilters;
window.goToPage = goToPage;
window.viewReceipt = viewReceipt;
window.closeReceiptModal = closeReceiptModal;
window.printReceiptModal = printReceiptModal;
window.printSaleReceipt = printSaleReceipt;
window.deleteSale = deleteSale;
window.exportSales = exportSales;
window.toggleTheme = function() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cloudpos_theme', next);
  const icon = document.querySelector('#themeToggle i');
  if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
};
