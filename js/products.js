import { apiCall } from './api.js';
import { getCurrentUser, logout, showToast } from './auth.js';
import { formatPeso } from './utils.js';

let products = [];
let categories = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }

  loadTheme();
  await loadProducts();
});

async function loadProducts() {
  try {
    const response = await apiCall('getProducts');
    if (response.status === 'success') {
      products = response.data;
      extractCategories();
      renderProducts();
      renderCategories();
    }
  } catch (error) {
    console.error('Load products error:', error);
  }
}

function extractCategories() {
  const cats = new Set(products.map(p => p.category).filter(Boolean));
  categories = Array.from(cats).sort();

  const datalist = document.getElementById('categoryList');
  if (datalist) {
    datalist.innerHTML = categories.map(c => `<option value="${c}">`).join('');
  }

  const filter = document.getElementById('categoryFilter');
  if (filter) {
    filter.innerHTML = '<option value="all">All Categories</option>' + 
      categories.map(c => `<option value="${c}">${c}</option>`).join('');
  }
}

function renderProducts() {
  const searchInput = document.getElementById('searchProducts');
  const categoryFilter = document.getElementById('categoryFilter');
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  const catFilter = categoryFilter ? categoryFilter.value : 'all';

  let filtered = products;
  if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
  if (catFilter !== 'all') filtered = filtered.filter(p => p.category === catFilter);

  const tbody = document.getElementById('productsTableBody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-secondary);">No products found</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const stockClass = p.stock === 0 ? 'color: var(--danger);' : 
                       p.stock <= p.minStock ? 'color: var(--warning);' : 'color: var(--success);';
    return `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 1rem;">
          <div style="font-weight: 600;">${p.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">${p.barcode || 'No barcode'}</div>
        </td>
        <td style="padding: 1rem; color: var(--text-secondary);">${p.category || '-'}</td>
        <td style="padding: 1rem; text-align: right;">${formatPeso(p.buyingPrice)}</td>
        <td style="padding: 1rem; text-align: right; font-weight: 600;">${formatPeso(p.sellingPrice)}</td>
        <td style="padding: 1rem; text-align: center; ${stockClass} font-weight: 600;">${p.stock}</td>
        <td style="padding: 1rem; text-align: center;">
          <span style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; 
            background: ${p.status === 'Active' ? '#dcfce7' : '#fee2e2'}; 
            color: ${p.status === 'Active' ? '#166534' : '#991b1b'};">
            ${p.status}
          </span>
        </td>
        <td style="padding: 1rem; text-align: right;">
          <button class="btn-icon" onclick="editProduct('${p.productId}')" style="width: 32px; height: 32px; margin-right: 0.5rem;">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon" onclick="deleteProduct('${p.productId}')" style="width: 32px; height: 32px; color: var(--danger);">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ===== AUTO-SUGGEST FUNCTIONS =====

function generateRandomBarcode() {
  // Generate a 12-digit EAN-13 style barcode
  const prefix = '8' + Math.floor(Math.random() * 9 + 1); // starts with 8x
  const middle = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  const code = prefix + middle;
  // Simple check digit calculation
  let sum = 0;
  for (let i = 0; i < code.length; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return code + checkDigit;
}

function suggestBarcode() {
  const barcodeInput = document.getElementById('productBarcode');
  if (!barcodeInput) return;

  // Check if barcode already exists
  let barcode;
  let attempts = 0;
  do {
    barcode = generateRandomBarcode();
    attempts++;
  } while (products.some(p => p.barcode === barcode) && attempts < 100);

  barcodeInput.value = barcode;
  barcodeInput.style.borderColor = '#22c55e';
  setTimeout(() => { barcodeInput.style.borderColor = ''; }, 1000);
  showToast('Barcode auto-generated!', 'success');
}

function suggestSKU() {
  const skuInput = document.getElementById('productSku');
  if (!skuInput) return;

  // Get highest existing SKU number
  let maxNum = 0;
  products.forEach(p => {
    if (p.sku && p.sku.startsWith('SKU-')) {
      const num = parseInt(p.sku.replace('SKU-', ''));
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });

  const nextNum = String(maxNum + 1).padStart(3, '0');
  skuInput.value = 'SKU-' + nextNum;
  skuInput.style.borderColor = '#22c55e';
  setTimeout(() => { skuInput.style.borderColor = ''; }, 1000);
  showToast('SKU auto-generated!', 'success');
}

function suggestMinStock() {
  const stockInput = document.getElementById('productStock');
  const minStockInput = document.getElementById('productMinStock');
  if (!minStockInput || !stockInput) return;

  const stock = parseInt(stockInput.value) || 0;
  // Suggest 20% of current stock, minimum 5, maximum 50
  let suggested = Math.max(5, Math.min(50, Math.round(stock * 0.2)));
  if (stock === 0) suggested = 10;

  minStockInput.value = suggested;
  minStockInput.style.borderColor = '#22c55e';
  setTimeout(() => { minStockInput.style.borderColor = ''; }, 1000);
  showToast('Min stock set to ' + suggested, 'success');
}

// ===== MODAL FUNCTIONS =====

function openProductModal(productId = null) {
  const form = document.getElementById('productForm');
  if (form) form.reset();

  const productIdInput = document.getElementById('productId');
  if (productIdInput) productIdInput.value = '';

  if (productId) {
    const p = products.find(x => x.productId === productId);
    if (!p) return;

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Edit Product';

    if (productIdInput) productIdInput.value = p.productId;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('productName', p.name);
    setVal('productBarcode', p.barcode);
    setVal('productSku', p.sku);
    setVal('productCategory', p.category);
    setVal('productBuyingPrice', p.buyingPrice);
    setVal('productSellingPrice', p.sellingPrice);
    setVal('productStock', p.stock);
    setVal('productMinStock', p.minStock);
    setVal('productSupplier', p.supplier);
    setVal('productStatus', p.status);
  } else {
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Add Product';

    // Auto-suggest for new products
    setTimeout(() => {
      suggestSKU();
      suggestBarcode();
    }, 100);
  }

  const overlay = document.getElementById('productModalOverlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeProductModal() {
  const overlay = document.getElementById('productModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

async function saveProduct(e) {
  e.preventDefault();

  const productId = document.getElementById('productId');
  const name = document.getElementById('productName');
  const barcode = document.getElementById('productBarcode');
  const sku = document.getElementById('productSku');
  const category = document.getElementById('productCategory');
  const buyingPrice = document.getElementById('productBuyingPrice');
  const sellingPrice = document.getElementById('productSellingPrice');
  const stock = document.getElementById('productStock');
  const minStock = document.getElementById('productMinStock');
  const supplier = document.getElementById('productSupplier');
  const status = document.getElementById('productStatus');

  if (!name || !name.value.trim()) {
    showToast('Product name is required', 'error');
    return;
  }

  // Validate selling price > buying price
  const bp = buyingPrice && buyingPrice.value ? parseFloat(buyingPrice.value) : 0;
  const sp = sellingPrice && sellingPrice.value ? parseFloat(sellingPrice.value) : 0;
  if (sp <= bp) {
    showToast('Selling price must be higher than buying price', 'warning');
    return;
  }

  const data = {
    name: name.value.trim(),
    barcode: barcode && barcode.value ? barcode.value.trim() : '',
    sku: sku && sku.value ? sku.value.trim() : '',
    category: category && category.value ? category.value.trim() : '',
    buyingPrice: bp,
    sellingPrice: sp,
    stock: stock && stock.value ? parseInt(stock.value) : 0,
    minStock: minStock && minStock.value ? parseInt(minStock.value) : 0,
    supplier: supplier && supplier.value ? supplier.value.trim() : '',
    status: status && status.value ? status.value : 'Active'
  };

  console.log('Saving product:', data);

  try {
    const action = productId && productId.value ? 'updateProduct' : 'addProduct';
    if (productId && productId.value) data.productId = productId.value;

    console.log('API Action:', action);

    const response = await apiCall(action, data);
    console.log('API Response:', response);

    if (response.status === 'success') {
      showToast(productId && productId.value ? 'Product updated!' : 'Product added!', 'success');
      closeProductModal();
      await loadProducts();
    } else {
      showToast(response.message || 'Failed to save', 'error');
    }
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed to save product: ' + error.message, 'error');
  }
}

function editProduct(productId) {
  openProductModal(productId);
}

async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this product?')) return;

  try {
    const response = await apiCall('deleteProduct', { productId });
    if (response.status === 'success') {
      showToast('Product deleted!', 'success');
      await loadProducts();
    }
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Failed to delete product', 'error');
  }
}

function searchProducts(query) {
  renderProducts();
}

function filterByCategory(category) {
  renderProducts();
}

function loadTheme() {
  const savedTheme = localStorage.getItem('cloudpos_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
};

window.logout = logout;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.searchProducts = searchProducts;
window.filterByCategory = filterByCategory;
window.suggestBarcode = suggestBarcode;
window.suggestSKU = suggestSKU;
window.suggestMinStock = suggestMinStock;
