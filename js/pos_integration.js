// ============================================
// Add this to your existing pos.js
// Call recordSaleMovement() AFTER saving a sale
// ============================================

// At the top of pos.js, import if needed:
// import { recordSaleMovement } from './inventory.js';

// In your completeSale() or saveSale() function, after the sale is saved:
async function completeSale(saleData) {
  // ... your existing sale saving code ...

  // After saving sale, record inventory movement
  if (typeof recordSaleMovement === 'function') {
    recordSaleMovement(saleData);
  } else {
    // Fallback if inventory.js isn't loaded
    recordSaleMovementFallback(saleData);
  }

  // ... rest of your code ...
}

// Fallback function (add this to pos.js)
function recordSaleMovementFallback(saleData) {
  let products = JSON.parse(localStorage.getItem('cloudpos_products') || '[]');
  let inventory = JSON.parse(localStorage.getItem('cloudpos_inventory') || '[]');
  let movements = JSON.parse(localStorage.getItem('cloudpos_movements') || '[]');
  const currentUser = JSON.parse(localStorage.getItem('cloudpos_user') || '{}');

  function getStockStatus(stock, minStock) {
    if (stock <= 0) return 'Out of Stock';
    if (stock <= minStock) return 'Low Stock';
    return 'In Stock';
  }

  function generateId() {
    return 'MOV-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4).toUpperCase();
  }

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
      inv.status = getStockStatus(afterStock, inv.reorderLevel || 5);
    } else {
      inventory.push({
        productId: item.productId,
        currentStock: afterStock,
        lastUpdated: new Date().toISOString(),
        reorderLevel: product.minStock || 5,
        status: getStockStatus(afterStock, product.minStock || 5),
        location: ''
      });
    }

    // Record movement
    movements.push({
      id: generateId(),
      productId: item.productId,
      type: 'sale',
      qty: -qty,
      beforeStock: beforeStock,
      afterStock: afterStock,
      reference: 'Sale #' + (saleData.saleId || saleData.id || 'OFF-' + Date.now()),
      date: new Date().toISOString(),
      by: saleData.cashierName || saleData.cashierId || currentUser.name || 'POS'
    });
  });

  localStorage.setItem('cloudpos_products', JSON.stringify(products));
  localStorage.setItem('cloudpos_inventory', JSON.stringify(inventory));
  localStorage.setItem('cloudpos_movements', JSON.stringify(movements));
}
