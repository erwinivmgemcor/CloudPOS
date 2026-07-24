// ============================================
// CloudPOS POS Module
// Complete Point of Sale System
// ============================================

import { apiCall } from './api.js';
import { getCurrentUser, logout, showToast } from './auth.js';
import { formatPeso, generateId } from './utils.js';

// Global state
let products = [];
let cart = [];
let categories = ['All'];
let currentCategory = 'All';
let currentPaymentMethod = 'cash';
let taxRate = 0;
let discountAmount = 0;
let discountPercent = 0;
let scanner = null;
let scannerStream = null;

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
  await loadProducts();
  setupEventListeners();
});

function setupEventListeners() {
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    if (e.key === 'F4') {
      e.preventDefault();
      completeSale();
    }
    if (e.key === 'Escape') {
      if (!document.getElementById('scannerModal').classList.contains('hidden')) {
        closeScanner();
      } else if (!document.getElementById('receiptModal').classList.contains('hidden')) {
        closeReceipt();
      }
    }
  });
}

// ============================================
// PRODUCT LOADING
// ============================================

async function loadProducts() {
  try {
    showLoadingState();

    const response = await apiCall('getProducts');

    if (response.status === 'success') {
      products = response.data.filter(p => p.status === 'Active');
      extractCategories();
      renderCategories();
      renderProducts();
    } else {
      showToast('Failed to load products', 'error');
    }
  } catch (error) {
    console.error('Load products error:', error);
    showToast('Connection error', 'error');
  }
}

function extractCategories() {
  const cats = new Set(products.map(p => p.category).filter(Boolean));
  categories = ['All', ...Array.from(cats).sort()];
}

function showLoadingState() {
  document.getElementById('productGrid').innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
      <div class="skeleton skeleton-title" style="width: 200px; margin: 0 auto;"></div>
      <div class="skeleton skeleton-text" style="width: 300px; margin: 1rem auto;"></div>
    </div>
  `;
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderCategories() {
  const container = document.getElementById('categoriesContainer');
  container.innerHTML = categories.map(cat => `
    <button class="category-btn ${cat === currentCategory ? 'active' : ''}" 
            onclick="filterCategory('${cat}')">
      ${cat}
    </button>
  `).join('');
}

function renderProducts() {
  const container = document.getElementById('productGrid');
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

  let filtered = products;

  // Filter by category
  if (currentCategory !== 'All') {
    filtered = filtered.filter(p => p.category === currentCategory);
  }

  // Filter by search
  if (searchTerm) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchTerm) ||
      (p.barcode && p.barcode.includes(searchTerm)) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">
        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
        <p>No products found</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(product => {
    const inCart = cart.find(item => item.productId === product.productId);
    const cartQty = inCart ? inCart.quantity : 0;
    const availableStock = product.stock - cartQty;
    const outOfStock = availableStock <= 0;

    return `
      <div class="product-card ${outOfStock ? 'out-of-stock' : ''}" 
           onclick="${outOfStock ? '' : `addToCart('${product.productId}')`}">
        <div class="product-card-image">
          <i class="fas fa-box"></i>
        </div>
        <div class="product-card-name">${escapeHtml(product.name)}</div>
        <div class="product-card-price">${formatPeso(product.sellingPrice)}</div>
        <div class="product-card-stock">
          ${outOfStock ? '<span style="color: var(--danger);">Out of Stock</span>' : 
            availableStock <= product.minStock ? 
            `<span style="color: var(--warning);">Only ${availableStock} left</span>` :
            `${availableStock} in stock`}
        </div>
        ${inCart ? `<div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--primary);">In cart: ${cartQty}</div>` : ''}
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// CART OPERATIONS
// ============================================

function addToCart(productId) {
  const product = products.find(p => p.productId === productId);
  if (!product) return;

  const existingItem = cart.find(item => item.productId === productId);

  if (existingItem) {
    if (existingItem.quantity >= product.stock) {
      showToast('Not enough stock available', 'warning');
      return;
    }
    existingItem.quantity++;
    existingItem.total = existingItem.quantity * existingItem.unitPrice;
  } else {
    cart.push({
      productId: product.productId,
      name: product.name,
      unitPrice: product.sellingPrice,
      quantity: 1,
      total: product.sellingPrice,
      stock: product.stock
    });
  }

  updateCart();
  renderProducts(); // Update stock display
  showToast(`${product.name} added to cart`, 'success');
}

function updateCartItemQuantity(productId, change) {
  const item = cart.find(item => item.productId === productId);
  if (!item) return;

  const newQty = item.quantity + change;

  if (newQty <= 0) {
    removeFromCart(productId);
    return;
  }

  if (newQty > item.stock) {
    showToast('Not enough stock available', 'warning');
    return;
  }

  item.quantity = newQty;
  item.total = item.quantity * item.unitPrice;

  updateCart();
  renderProducts();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.productId !== productId);
  updateCart();
  renderProducts();
  showToast('Item removed from cart', 'info');
}

function updateCart() {
  renderCartItems();
  updateSummary();
  updateCompleteButton();
}

function renderCartItems() {
  const container = document.getElementById('cartItems');

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <i class="fas fa-shopping-basket"></i>
        <p>Your cart is empty</p>
        <p style="font-size: 0.75rem; margin-top: 0.5rem;">Click a product to add</p>
      </div>
    `;
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-image">
        <i class="fas fa-box"></i>
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">${formatPeso(item.unitPrice)} each</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" onclick="updateCartItemQuantity('${item.productId}', -1)">
          <i class="fas fa-minus"></i>
        </button>
        <span class="qty-value">${item.quantity}</span>
        <button class="qty-btn" onclick="updateCartItemQuantity('${item.productId}', 1)">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <div class="cart-item-total">${formatPeso(item.total)}</div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.productId}')">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
}

function updateSummary() {
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * (taxRate / 100);
  const discount = discountAmount || (subtotal * (discountPercent / 100));
  const total = subtotal + tax - discount;

  document.getElementById('subtotalAmount').textContent = formatPeso(subtotal);
  document.getElementById('discountAmount').textContent = `-${formatPeso(discount)}`;
  document.getElementById('taxAmount').textContent = formatPeso(tax);
  document.getElementById('totalAmount').textContent = formatPeso(total);

  calculateChange();
}

function updateCompleteButton() {
  const btn = document.getElementById('completeBtn');
  const total = getCartTotal();

  if (cart.length === 0) {
    btn.disabled = true;
    return;
  }

  if (currentPaymentMethod === 'cash') {
    const cashReceived = parseFloat(document.getElementById('cashInput').value) || 0;
    btn.disabled = cashReceived < total;
  } else {
    btn.disabled = false;
  }
}

function getCartTotal() {
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * (taxRate / 100);
  const discount = discountAmount || (subtotal * (discountPercent / 100));
  return subtotal + tax - discount;
}

// ============================================
// PAYMENT METHODS
// ============================================

function selectPaymentMethod(method) {
  currentPaymentMethod = method;

  document.querySelectorAll('.payment-method-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === method);
  });

  const cashSection = document.getElementById('cashInputSection');
  if (method === 'cash') {
    cashSection.style.display = 'block';
  } else {
    cashSection.style.display = 'none';
  }

  updateCompleteButton();
}

function setCash(amount) {
  document.getElementById('cashInput').value = amount;
  calculateChange();
}

function setCashExact() {
  const total = getCartTotal();
  document.getElementById('cashInput').value = Math.ceil(total);
  calculateChange();
}

function calculateChange() {
  const cashReceived = parseFloat(document.getElementById('cashInput').value) || 0;
  const total = getCartTotal();
  const change = cashReceived - total;

  const display = document.getElementById('changeDisplay');
  const amountEl = document.getElementById('changeAmount');

  if (change < 0) {
    display.classList.add('negative');
    amountEl.textContent = `Need ${formatPeso(Math.abs(change))}`;
  } else {
    display.classList.remove('negative');
    amountEl.textContent = formatPeso(change);
  }

  updateCompleteButton();
}

// ============================================
// SALE COMPLETION
// ============================================

async function completeSale() {
  if (cart.length === 0) {
    showToast('Cart is empty', 'warning');
    return;
  }

  const total = getCartTotal();
  const cashReceived = currentPaymentMethod === 'cash' 
    ? parseFloat(document.getElementById('cashInput').value) || 0 
    : total;

  if (currentPaymentMethod === 'cash' && cashReceived < total) {
    showToast('Insufficient cash', 'error');
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const discount = discountAmount || (subtotal * (discountPercent / 100));
  const tax = subtotal * (taxRate / 100);

  const saleData = {
    customerId: 'WALK-IN',
    subtotal: subtotal,
    discount: discount,
    tax: tax,
    total: total,
    paymentMethod: currentPaymentMethod.toUpperCase(),
    cashierId: getCurrentUser()?.userId || 'SYSTEM',
    notes: document.getElementById('saleNotes').value || '',
    items: cart.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total
    }))
  };

  try {
    const btn = document.getElementById('completeBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Processing...';

    const response = await apiCall('saveSale', saleData);

    if (response.status === 'success') {
      showToast('Sale completed successfully!', 'success');
      showReceipt(response.data.saleId, saleData, cashReceived);
      clearCart();
      await loadProducts(); // Refresh stock
    } else {
      showToast(response.message || 'Failed to save sale', 'error');
    }
  } catch (error) {
    console.error('Sale error:', error);
    showToast('Failed to complete sale', 'error');
  } finally {
    const btn = document.getElementById('completeBtn');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Complete Sale';
  }
}

function cancelSale() {
  if (cart.length === 0) {
    showToast('Cart is already empty', 'info');
    return;
  }

  if (!confirm('Are you sure you want to cancel this sale?')) return;

  clearCart();
  showToast('Sale cancelled', 'info');
}

function clearCart() {
  cart = [];
  discountAmount = 0;
  discountPercent = 0;
  document.getElementById('cashInput').value = '';
  document.getElementById('saleNotes').value = '';
  document.getElementById('changeAmount').textContent = formatPeso(0);
  document.getElementById('changeDisplay').classList.remove('negative');
  updateCart();
  renderProducts();
}

// ============================================
// RECEIPT
// ============================================

function showReceipt(saleId, saleData, cashReceived) {
  const change = cashReceived - saleData.total;
  const now = new Date();

  const receiptHTML = `
    <div class="receipt-header">
      <h3>CloudPOS</h3>
      <p>Official Receipt</p>
      <p>${now.toLocaleDateString('en-PH')} ${now.toLocaleTimeString('en-PH')}</p>
      <p style="font-size: 0.6875rem; color: #999;">${saleId}</p>
    </div>

    <div class="receipt-items">
      ${saleData.items.map(item => `
        <div class="receipt-item">
          <span class="receipt-item-name">${escapeHtml(item.name)}</span>
          <span class="receipt-item-qty">x${item.quantity}</span>
          <span>${formatPeso(item.total)}</span>
        </div>
      `).join('')}
    </div>

    <div class="receipt-summary">
      <div class="receipt-summary-row">
        <span>Subtotal</span>
        <span>${formatPeso(saleData.subtotal)}</span>
      </div>
      ${saleData.discount > 0 ? `
        <div class="receipt-summary-row">
          <span>Discount</span>
          <span>-${formatPeso(saleData.discount)}</span>
        </div>
      ` : ''}
      ${saleData.tax > 0 ? `
        <div class="receipt-summary-row">
          <span>Tax</span>
          <span>${formatPeso(saleData.tax)}</span>
        </div>
      ` : ''}
      <div class="receipt-summary-row total">
        <span>TOTAL</span>
        <span>${formatPeso(saleData.total)}</span>
      </div>
      <div class="receipt-summary-row">
        <span>Payment (${saleData.paymentMethod})</span>
        <span>${formatPeso(cashReceived)}</span>
      </div>
      <div class="receipt-summary-row">
        <span>Change</span>
        <span>${formatPeso(change)}</span>
      </div>
    </div>

    <div class="receipt-footer">
      <p>Thank you for your purchase!</p>
      <p>Please come again</p>
    </div>

    <div class="receipt-actions">
      <button class="btn btn-primary" onclick="printReceipt()">
        <i class="fas fa-print"></i> Print
      </button>
      <button class="btn" style="background: var(--border-color); color: var(--text-primary);" onclick="closeReceipt()">
        <i class="fas fa-times"></i> Close
      </button>
    </div>
  `;

  document.getElementById('receiptContent').innerHTML = receiptHTML;
  document.getElementById('receiptModal').classList.remove('hidden');
}

function printReceipt() {
  const receiptContent = document.getElementById('receiptContent').innerHTML;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Receipt</title>
        <style>
          body { font-family: monospace; width: 300px; margin: 0 auto; padding: 20px; }
          .receipt-header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 10px; margin-bottom: 10px; }
          .receipt-items { margin-bottom: 10px; }
          .receipt-item { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; }
          .receipt-summary { border-top: 1px dashed #ccc; padding-top: 10px; }
          .receipt-summary-row { display: flex; justify-content: space-between; font-size: 12px; }
          .receipt-summary-row.total { font-weight: bold; font-size: 14px; border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px; }
          .receipt-footer { text-align: center; border-top: 2px dashed #ccc; padding-top: 10px; margin-top: 10px; font-size: 10px; }
          .receipt-actions { display: none; }
        </style>
      </head>
      <body>
        ${receiptContent}
        <script>window.print(); window.close();</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function closeReceipt() {
  document.getElementById('receiptModal').classList.add('hidden');
}

// ============================================
// BARCODE SCANNER
// ============================================

async function openScanner() {
  const modal = document.getElementById('scannerModal');
  modal.classList.remove('hidden');

  try {
    const codeReader = new ZXing.BrowserMultiFormatReader();
    scanner = codeReader;

    const video = document.getElementById('scannerVideo');

    const result = await codeReader.decodeFromVideoDevice(undefined, video, (result, err) => {
      if (result) {
        const barcode = result.getText();
        console.log('Barcode detected:', barcode);

        // Find product by barcode
        const product = products.find(p => p.barcode === barcode);
        if (product) {
          if (product.stock > 0) {
            addToCart(product.productId);
            showToast(`Scanned: ${product.name}`, 'success');
            closeScanner();
          } else {
            showToast(`${product.name} is out of stock`, 'error');
          }
        } else {
          showToast('Product not found', 'error');
        }
      }
    });
  } catch (error) {
    console.error('Scanner error:', error);
    showToast('Camera access denied or not available', 'error');
  }
}

function closeScanner() {
  const modal = document.getElementById('scannerModal');
  modal.classList.add('hidden');

  if (scanner) {
    scanner.reset();
    scanner = null;
  }

  const video = document.getElementById('scannerVideo');
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
}

// ============================================
// SEARCH & FILTER
// ============================================

function searchProducts(query) {
  renderProducts();
}

function filterCategory(category) {
  currentCategory = category;
  renderCategories();
  renderProducts();
}

// ============================================
// THEME
// ============================================

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
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
};

window.logout = logout;
window.addToCart = addToCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.removeFromCart = removeFromCart;
window.selectPaymentMethod = selectPaymentMethod;
window.setCash = setCash;
window.setCashExact = setCashExact;
window.calculateChange = calculateChange;
window.completeSale = completeSale;
window.cancelSale = cancelSale;
window.openScanner = openScanner;
window.closeScanner = closeScanner;
window.printReceipt = printReceipt;
window.closeReceipt = closeReceipt;
window.searchProducts = searchProducts;
window.filterCategory = filterCategory;
