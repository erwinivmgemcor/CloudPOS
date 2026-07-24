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
    } else {
      // Only show error if no data loaded
      if (!products || products.length === 0) {
        showToast('Failed to load products', 'error');
      }
    }
  } catch (error) {
    console.error('Load products error:', error);
    // Only show error if no products displayed
    if (!products || products.length === 0) {
      showToast('Failed to load products', 'error');
    }
  }
}
function extractCategories() {
  const cats = new Set(products.map(p => p.category).filter(Boolean));
  categories = Array.from(cats).sort();
  
  const datalist = document.getElementById('categoryList');
  datalist.innerHTML = categories.map(c => `<option value="${c}">`).join('');
  
  const filter = document.getElementById('categoryFilter');
  filter.innerHTML = '<option value="all">All Categories</option>' + 
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function renderProducts() {
  const search = document.getElementById('searchProducts').value.toLowerCase();
  const catFilter = document.getElementById('categoryFilter').value;
  
  let filtered = products;
  if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
  if (catFilter !== 'all') filtered = filtered.filter(p => p.category === catFilter);
  
  const tbody = document.getElementById('productsTableBody');
  
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

function openProductModal(productId = null) {
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  
  if (productId) {
    const p = products.find(x => x.productId === productId);
    if (!p) return;
    document.getElementById('modalTitle').textContent = 'Edit Product';
    document.getElementById('productId').value = p.productId;
    document.getElementById('productName').value = p.name;
    document.getElementById('productBarcode').value = p.barcode || '';
    document.getElementById('productSku').value = p.sku || '';
    document.getElementById('productCategory').value = p.category || '';
    document.getElementById('productBuyingPrice').value = p.buyingPrice;
    document.getElementById('productSellingPrice').value = p.sellingPrice;
    document.getElementById('productStock').value = p.stock;
    document.getElementById('productMinStock').value = p.minStock;
    document.getElementById('productSupplier').value = p.supplier || '';
    document.getElementById('productStatus').value = p.status;
  } else {
    document.getElementById('modalTitle').textContent = 'Add Product';
  }
  
  document.getElementById('productModal').classList.remove('hidden');
}

function closeProductModal() {
  document.getElementById('productModal').classList.add('hidden');
}

async function saveProduct(e) {
  e.preventDefault();
  
  const productId = document.getElementById('productId').value;
  const data = {
    name: document.getElementById('productName').value,
    barcode: document.getElementById('productBarcode').value,
    sku: document.getElementById('productSku').value,
    category: document.getElementById('productCategory').value,
    buyingPrice: parseFloat(document.getElementById('productBuyingPrice').value),
    sellingPrice: parseFloat(document.getElementById('productSellingPrice').value),
    stock: parseInt(document.getElementById('productStock').value),
    minStock: parseInt(document.getElementById('productMinStock').value) || 0,
    supplier: document.getElementById('productSupplier').value,
    status: document.getElementById('productStatus').value
  };
  
  try {
    const action = productId ? 'updateProduct' : 'addProduct';
    if (productId) data.productId = productId;
    
    const response = await apiCall(action, data);
    
    if (response.status === 'success') {
      showToast(productId ? 'Product updated!' : 'Product added!', 'success');
      closeProductModal();
      await loadProducts();
    }
  } catch (error) {
    showToast('Failed to save product', 'error');
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
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
};

window.logout = logout;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.searchProducts = searchProducts;
window.filterByCategory = filterByCategory;
