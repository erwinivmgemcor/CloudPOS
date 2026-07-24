// Inventory Module — CloudPOS
// ===========================

let products = [];
let inventory = [];
let movements = [];
let alerts = [];
let currentPage = 1;
let movementPage = 1;
let itemsPerPage = 10;
let filteredInventory = [];
let filteredMovements = [];
let currentUser = null;

// ── Init ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = JSON.parse(localStorage.getItem('cloudpos_user') || '{}');
    if (!currentUser.name) currentUser = { name: 'Admin' };

    await loadData();
    populateCategoryFilter();
    populateProductSelect();
    updateStats();
    filterInventory();
    filterMovements();
    checkStockAlerts();
    renderAlerts();

    // Default date range for movements (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    document.getElementById('movementDateTo').value = today.toISOString().split('T')[0];
    document.getElementById('movementDateFrom').value = thirtyDaysAgo.toISOString().split('T')[0];
});

// ── Data Loading ─────────────────────────────────────

async function loadData() {
    // Load products
    try {
        const res = await apiCall('getProducts');
        products = res.data || res || [];
    } catch (e) {
        products = JSON.parse(localStorage.getItem('cloudpos_products') || '[]');
    }

    // Load inventory records
    try {
        const res = await apiCall('getInventory');
        inventory = res.data || res || [];
    } catch (e) {
        inventory = JSON.parse(localStorage.getItem('cloudpos_inventory') || '[]');
    }

    // Load stock movements
    try {
        const res = await apiCall('getStockMovements');
        movements = res.data || res || [];
    } catch (e) {
        movements = JSON.parse(localStorage.getItem('cloudpos_movements') || '[]');
    }

    // Load alerts
    alerts = JSON.parse(localStorage.getItem('cloudpos_alerts') || '[]');

    // Ensure every product has an inventory record
    ensureInventoryRecords();
}

function ensureInventoryRecords() {
    products.forEach(product => {
        const existing = inventory.find(inv => inv.productId === product.id);
        if (!existing) {
            inventory.push({
                id: generateId(),
                productId: product.id,
                stock: product.stock || 0,
                minStock: product.minStock || 5,
                unitCost: product.cost || product.price || 0,
                updatedAt: new Date().toISOString()
            });
        }
    });
    saveInventory();
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
    return 'INV-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4).toUpperCase();
}

// ── Stats ────────────────────────────────────────────

function updateStats() {
    const totalProducts = products.length;
    const stockValue = inventory.reduce((sum, inv) => {
        const product = products.find(p => p.id === inv.productId);
        const cost = inv.unitCost || (product ? product.cost : 0);
        return sum + (inv.stock * cost);
    }, 0);
    const lowStock = inventory.filter(inv => {
        const product = products.find(p => p.id === inv.productId);
        return inv.stock > 0 && inv.stock <= (inv.minStock || 5);
    }).length;
    const outStock = inventory.filter(inv => inv.stock <= 0).length;

    document.getElementById('statTotalProducts').textContent = totalProducts;
    document.getElementById('statStockValue').textContent = '₱' + formatNumber(stockValue);
    document.getElementById('statLowStock').textContent = lowStock;
    document.getElementById('statOutStock').textContent = outStock;
}

// ── Tab Switching ────────────────────────────────────

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).style.display = 'block';
}

// ── Inventory Table ──────────────────────────────────

function filterInventory() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;

    filteredInventory = inventory.map(inv => {
        const product = products.find(p => p.id === inv.productId);
        return { ...inv, product };
    }).filter(item => {
        if (!item.product) return false;
        const matchSearch = !search ||
            item.product.name.toLowerCase().includes(search) ||
            (item.product.sku || '').toLowerCase().includes(search);
        const matchCategory = !category || item.product.category === category;
        let matchStatus = true;
        if (status === 'in') matchStatus = item.stock > (item.minStock || 5);
        else if (status === 'low') matchStatus = item.stock > 0 && item.stock <= (item.minStock || 5);
        else if (status === 'out') matchStatus = item.stock <= 0;
        return matchSearch && matchCategory && matchStatus;
    });

    currentPage = 1;
    renderInventoryTable();
}

function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredInventory.slice(start, end);

    tbody.innerHTML = pageItems.map(item => {
        const product = item.product;
        const stock = item.stock || 0;
        const minStock = item.minStock || 5;
        const cost = item.unitCost || product.cost || 0;
        const stockValue = stock * cost;
        const maxStock = Math.max(minStock * 3, stock, 10);
        const percentage = Math.min((stock / maxStock) * 100, 100);
        let barColor = '#10b981';
        let statusClass = 'in-stock';
        let statusText = 'In Stock';
        if (stock <= 0) {
            barColor = '#991b1b';
            statusClass = 'out-stock';
            statusText = 'Out of Stock';
        } else if (stock <= minStock) {
            barColor = '#dc2626';
            statusClass = 'low-stock';
            statusText = 'Low Stock';
        }

        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                            ${product.image ? `<img src="${product.image}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px;">` : '<i class="fas fa-box" style="color: #9ca3af;"></i>'}
                        </div>
                        <div>
                            <p style="font-weight: 600; color: #111827;">${product.name}</p>
                            <p style="font-size: 12px; color: #6b7280;">${product.barcode || ''}</p>
                        </div>
                    </div>
                </td>
                <td style="color: #6b7280; font-size: 14px;">${product.sku || '-'}</td>
                <td><span class="badge" style="background: #e0e7ff; color: #4338ca;">${product.category || 'Uncategorized'}</span></td>
                <td style="text-align: center; font-weight: 600;">${stock}</td>
                <td style="text-align: center; color: #6b7280;">${minStock}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td style="text-align: right; color: #6b7280;">₱${formatNumber(cost)}</td>
                <td style="text-align: right; font-weight: 600;">₱${formatNumber(stockValue)}</td>
                <td style="text-align: center;">
                    <button class="btn btn-ghost" style="padding: 6px 10px;" onclick="viewHistory('${item.productId}')" title="View History"><i class="fas fa-history"></i></button>
                    <button class="btn btn-ghost" style="padding: 6px 10px;" onclick="quickAdjust('${item.productId}')" title="Quick Adjust"><i class="fas fa-edit"></i></button>
                </td>
            </tr>
            <tr>
                <td colspan="9" style="padding: 0 16px 14px 16px; border-bottom: 1px solid #f3f4f6;">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%; background: ${barColor};"></div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('showingText').textContent = `Showing ${Math.min(start + 1, filteredInventory.length)}–${Math.min(end, filteredInventory.length)} of ${filteredInventory.length} items`;
    renderPagination(filteredInventory.length, currentPage, 'pagination', (p) => { currentPage = p; renderInventoryTable(); });
}

// ── Movements Table ──────────────────────────────────

function filterMovements() {
    const search = document.getElementById('movementSearch').value.toLowerCase();
    const type = document.getElementById('movementTypeFilter').value;
    const dateFrom = document.getElementById('movementDateFrom').value;
    const dateTo = document.getElementById('movementDateTo').value;

    filteredMovements = movements.map(mov => {
        const product = products.find(p => p.id === mov.productId);
        return { ...mov, productName: product ? product.name : 'Unknown' };
    }).filter(mov => {
        const matchSearch = !search ||
            mov.productName.toLowerCase().includes(search) ||
            (mov.reference || '').toLowerCase().includes(search);
        const matchType = !type || mov.type === type;
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
    const start = (movementPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredMovements.slice(start, end);

    tbody.innerHTML = pageItems.map(mov => {
        const typeColors = {
            in: { bg: '#d1fae5', color: '#065f46', label: 'Stock In' },
            out: { bg: '#fee2e2', color: '#991b1b', label: 'Stock Out' },
            sale: { bg: '#dbeafe', color: '#1e40af', label: 'Sale' },
            adjustment: { bg: '#fef3c7', color: '#92400e', label: 'Adjustment' },
            return: { bg: '#ede9fe', color: '#5b21b6', label: 'Return' }
        };
        const tc = typeColors[mov.type] || typeColors.adjustment;
        const date = new Date(mov.date);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        return `
            <tr>
                <td>
                    <p style="font-weight: 500;">${dateStr}</p>
                    <p style="font-size: 12px; color: #6b7280;">${timeStr}</p>
                </td>
                <td style="font-weight: 500;">${mov.productName}</td>
                <td><span class="badge" style="background: ${tc.bg}; color: ${tc.color};">${tc.label}</span></td>
                <td style="text-align: center; font-weight: 600; color: ${mov.qty > 0 ? '#10b981' : '#ef4444'};">${mov.qty > 0 ? '+' : ''}${mov.qty}</td>
                <td style="text-align: center; color: #6b7280;">${mov.beforeStock}</td>
                <td style="text-align: center; font-weight: 600;">${mov.afterStock}</td>
                <td style="color: #6b7280; font-size: 14px;">${mov.reference || '-'}</td>
                <td style="color: #6b7280; font-size: 14px;">${mov.by || 'System'}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('movementShowingText').textContent = `Showing ${Math.min(start + 1, filteredMovements.length)}–${Math.min(end, filteredMovements.length)} of ${filteredMovements.length} items`;
    renderPagination(filteredMovements.length, movementPage, 'movementPagination', (p) => { movementPage = p; renderMovementsTable(); });
}

// ── Pagination ───────────────────────────────────────

function renderPagination(total, page, containerId, onChange) {
    const totalPages = Math.ceil(total / itemsPerPage);
    const container = document.getElementById(containerId);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    html += `<button class="page-btn" onclick="onPageChange(${page - 1}, '${containerId}')" ${page === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
            html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="onPageChange(${i}, '${containerId}')">${i}</button>`;
        } else if (i === page - 2 || i === page + 2) {
            html += `<span style="padding: 8px;">…</span>`;
        }
    }
    html += `<button class="page-btn" onclick="onPageChange(${page + 1}, '${containerId}')" ${page === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;

    // Store callback
    window._pageCallbacks = window._pageCallbacks || {};
    window._pageCallbacks[containerId] = onChange;
}

function onPageChange(page, containerId) {
    const cb = window._pageCallbacks[containerId];
    if (cb) cb(page);
}

// ── Alerts ───────────────────────────────────────────

function checkStockAlerts() {
    const newAlerts = [];
    inventory.forEach(inv => {
        const product = products.find(p => p.id === inv.productId);
        if (!product) return;
        if (inv.stock <= 0) {
            newAlerts.push({
                id: 'ALERT-' + Date.now() + Math.random(),
                type: 'out',
                productId: inv.productId,
                productName: product.name,
                message: `${product.name} is OUT OF STOCK`,
                date: new Date().toISOString(),
                read: false
            });
        } else if (inv.stock <= (inv.minStock || 5)) {
            newAlerts.push({
                id: 'ALERT-' + Date.now() + Math.random(),
                type: 'low',
                productId: inv.productId,
                productName: product.name,
                message: `${product.name} is running low (${inv.stock} remaining)`,
                date: new Date().toISOString(),
                read: false
            });
        }
    });

    // Merge with existing, avoid duplicates for same product
    const existingIds = new Set(alerts.map(a => a.productId + a.type));
    newAlerts.forEach(a => {
        if (!existingIds.has(a.productId + a.type)) alerts.push(a);
    });
    saveAlerts();
}

function renderAlerts() {
    const type = document.getElementById('alertTypeFilter').value;
    const list = document.getElementById('alertsList');
    const filtered = alerts.filter(a => !type || a.type === type).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filtered.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6b7280;">
                <i class="fas fa-check-circle" style="font-size: 48px; color: #10b981; margin-bottom: 12px;"></i>
                <p style="font-size: 16px;">All stock levels are healthy!</p>
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map(a => {
        const isOut = a.type === 'out';
        const icon = isOut ? 'fa-times-circle' : 'fa-exclamation-triangle';
        const color = isOut ? '#991b1b' : '#dc2626';
        const bg = isOut ? '#fef2f2' : '#fffbeb';
        const date = new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `
            <div style="display: flex; align-items: start; gap: 12px; padding: 16px; border-radius: 12px; background: ${bg}; ${a.read ? 'opacity: 0.6;' : ''}">
                <i class="fas ${icon}" style="color: ${color}; font-size: 20px; margin-top: 2px;"></i>
                <div style="flex: 1;">
                    <p style="font-weight: 600; color: #111827;">${a.message}</p>
                    <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">${date}</p>
                </div>
                <button class="btn btn-ghost" style="padding: 6px 10px; font-size: 12px;" onclick="markAlertRead('${a.id}')">Mark Read</button>
            </div>
        `;
    }).join('');
}

function filterAlerts() {
    renderAlerts();
}

function markAlertRead(id) {
    const alert = alerts.find(a => a.id === id);
    if (alert) { alert.read = true; saveAlerts(); renderAlerts(); }
}

function markAllRead() {
    alerts.forEach(a => a.read = true);
    saveAlerts();
    renderAlerts();
}

// ── Stock Adjustment ─────────────────────────────────

function populateProductSelect() {
    const select = document.getElementById('adjustProduct');
    select.innerHTML = '<option value="">Select a product</option>' + products.map(p =>
        `<option value="${p.id}">${p.name} (${p.sku || 'No SKU'})</option>`
    ).join('');
}

function populateCategoryFilter() {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    const select = document.getElementById('categoryFilter');
    select.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

function onProductSelect() {
    const productId = document.getElementById('adjustProduct').value;
    if (!productId) {
        document.getElementById('adjustCurrentStock').value = '';
        document.getElementById('adjustMinStock').value = '';
        return;
    }
    const inv = inventory.find(i => i.productId === productId);
    const product = products.find(p => p.id === productId);
    document.getElementById('adjustCurrentStock').value = inv ? inv.stock : 0;
    document.getElementById('adjustMinStock').value = inv ? (inv.minStock || 5) : 5;
    document.getElementById('adjustCost').value = inv ? (inv.unitCost || '') : '';
}

function openStockModal() {
    document.getElementById('stockModal').classList.add('active');
    document.getElementById('adjustProduct').value = '';
    document.getElementById('adjustCurrentStock').value = '';
    document.getElementById('adjustMinStock').value = '';
    document.getElementById('adjustQty').value = '';
    document.getElementById('adjustCost').value = '';
    document.getElementById('adjustNotes').value = '';
}

function closeStockModal() {
    document.getElementById('stockModal').classList.remove('active');
}

function quickAdjust(productId) {
    document.getElementById('adjustProduct').value = productId;
    onProductSelect();
    openStockModal();
}

async function saveAdjustment() {
    const productId = document.getElementById('adjustProduct').value;
    const type = document.getElementById('adjustType').value;
    const qty = parseInt(document.getElementById('adjustQty').value) || 0;
    const cost = parseFloat(document.getElementById('adjustCost').value) || 0;
    const notes = document.getElementById('adjustNotes').value.trim();

    if (!productId) { alert('Please select a product.'); return; }
    if (qty <= 0) { alert('Please enter a valid quantity.'); return; }

    const inv = inventory.find(i => i.productId === productId);
    const product = products.find(p => p.id === productId);
    const beforeStock = inv ? inv.stock : 0;
    let afterStock = beforeStock;
    let movementQty = 0;

    if (type === 'in') {
        afterStock = beforeStock + qty;
        movementQty = qty;
    } else if (type === 'out') {
        if (qty > beforeStock) { alert('Not enough stock to remove.'); return; }
        afterStock = beforeStock - qty;
        movementQty = -qty;
    } else if (type === 'adjustment') {
        afterStock = qty;
        movementQty = qty - beforeStock;
    }

    // Update inventory
    if (inv) {
        inv.stock = afterStock;
        if (cost > 0) inv.unitCost = cost;
        inv.updatedAt = new Date().toISOString();
    } else {
        inventory.push({
            id: generateId(),
            productId: productId,
            stock: afterStock,
            minStock: 5,
            unitCost: cost > 0 ? cost : 0,
            updatedAt: new Date().toISOString()
        });
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
        by: currentUser.name
    };
    movements.push(movement);

    // Save
    saveInventory();
    saveMovements();

    // Try API
    try {
        await apiCall('updateInventory', { productId, stock: afterStock, unitCost: cost > 0 ? cost : undefined });
        await apiCall('addStockMovement', movement);
    } catch (e) {
        // Fallback to localStorage already done
    }

    closeStockModal();
    updateStats();
    filterInventory();
    filterMovements();
    checkStockAlerts();
    renderAlerts();

    // Show success
    showToast(type === 'in' ? `Added ${qty} units to ${product.name}` : (type === 'out' ? `Removed ${qty} units from ${product.name}` : `Adjusted ${product.name} stock to ${afterStock}`));
}

// ── History ──────────────────────────────────────────

function viewHistory(productId) {
    const product = products.find(p => p.id === productId);
    document.getElementById('historyTitle').textContent = `Stock History — ${product ? product.name : 'Unknown'}`;
    const productMovements = movements.filter(m => m.productId === productId).sort((a, b) => new Date(b.date) - new Date(a.date));

    const content = document.getElementById('historyContent');
    if (productMovements.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">No stock movements recorded yet.</p>';
    } else {
        content.innerHTML = productMovements.map(mov => {
            const typeLabels = { in: 'Stock In', out: 'Stock Out', sale: 'Sale', adjustment: 'Adjustment', return: 'Return' };
            const typeClass = mov.type === 'in' ? 'history-in' : (mov.type === 'out' || mov.type === 'sale' ? 'history-out' : 'history-adj');
            const date = new Date(mov.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            return `
                <div class="history-item ${typeClass}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="font-weight: 600; font-size: 14px;">${typeLabels[mov.type] || mov.type}</span>
                            <span style="margin-left: 8px; font-weight: 700; color: ${mov.qty >= 0 ? '#10b981' : '#ef4444'};">${mov.qty >= 0 ? '+' : ''}${mov.qty}</span>
                        </div>
                        <span style="font-size: 12px; color: #6b7280;">${date}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 13px; color: #6b7280;">
                        <span>Before: ${mov.beforeStock} → After: ${mov.afterStock}</span>
                        <span>${mov.by || 'System'}</span>
                    </div>
                    ${mov.reference ? `<p style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${mov.reference}</p>` : ''}
                </div>
            `;
        }).join('');
    }
    document.getElementById('historyModal').classList.add('active');
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.remove('active');
}

// ── Export ───────────────────────────────────────────

function exportInventory() {
    const csv = [
        ['Product', 'SKU', 'Category', 'Stock', 'Min Level', 'Status', 'Unit Cost', 'Stock Value'],
        ...filteredInventory.map(item => {
            const p = item.product;
            const cost = item.unitCost || p.cost || 0;
            const status = item.stock <= 0 ? 'Out of Stock' : (item.stock <= (item.minStock || 5) ? 'Low Stock' : 'In Stock');
            return [p.name, p.sku || '', p.category || '', item.stock, item.minStock || 5, status, cost, item.stock * cost];
        })
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '\"')}"`).join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// ── Helpers ──────────────────────────────────────────

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('statusFilter').value = '';
    filterInventory();
}

function resetMovementFilters() {
    document.getElementById('movementSearch').value = '';
    document.getElementById('movementTypeFilter').value = '';
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    document.getElementById('movementDateTo').value = today.toISOString().split('T')[0];
    document.getElementById('movementDateFrom').value = thirtyDaysAgo.toISOString().split('T')[0];
    filterMovements();
}

function formatNumber(num) {
    return Number(num).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position: fixed; bottom: 24px; right: 24px; background: #1e293b; color: #fff; padding: 14px 24px; border-radius: 10px; font-weight: 500; z-index: 100; animation: slideIn 0.3s ease;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function logout() {
    localStorage.removeItem('cloudpos_user');
    window.location.href = 'login.html';
}

// ── POS Integration: Record Sale Movement ────────────

function recordSaleMovement(saleData) {
    // Called from pos.js when a sale is completed
    if (!saleData || !saleData.items) return;
    saleData.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const inv = inventory.find(i => i.productId === item.productId);
        const beforeStock = inv ? inv.stock : 0;
        const afterStock = beforeStock - item.qty;

        if (inv) {
            inv.stock = afterStock;
            inv.updatedAt = new Date().toISOString();
        }

        movements.push({
            id: generateId(),
            productId: item.productId,
            type: 'sale',
            qty: -item.qty,
            beforeStock: beforeStock,
            afterStock: afterStock,
            reference: `Sale #${saleData.saleId || saleData.id}`,
            date: new Date().toISOString(),
            by: saleData.cashier || currentUser.name
        });
    });
    saveInventory();
    saveMovements();
    updateStats();
    checkStockAlerts();
}

// Expose for pos.js
window.recordSaleMovement = recordSaleMovement;
