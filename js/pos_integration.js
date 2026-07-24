// Add this to your existing pos.js — inside your sale completion/save function
// Call this AFTER the sale is saved successfully:

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

// Fallback function (add this to pos.js if inventory.js might not be loaded)
function recordSaleMovementFallback(saleData) {
    let inventory = JSON.parse(localStorage.getItem('cloudpos_inventory') || '[]');
    let movements = JSON.parse(localStorage.getItem('cloudpos_movements') || '[]');
    const currentUser = JSON.parse(localStorage.getItem('cloudpos_user') || '{}');

    saleData.items.forEach(item => {
        const inv = inventory.find(i => i.productId === item.productId);
        const beforeStock = inv ? inv.stock : 0;
        const afterStock = beforeStock - item.qty;

        if (inv) {
            inv.stock = afterStock;
            inv.updatedAt = new Date().toISOString();
        } else {
            inventory.push({
                id: 'INV-' + Date.now(),
                productId: item.productId,
                stock: afterStock,
                minStock: 5,
                unitCost: item.cost || 0,
                updatedAt: new Date().toISOString()
            });
        }

        movements.push({
            id: 'MOV-' + Date.now() + Math.random().toString(36).substr(2, 4),
            productId: item.productId,
            type: 'sale',
            qty: -item.qty,
            beforeStock: beforeStock,
            afterStock: afterStock,
            reference: 'Sale #' + (saleData.saleId || saleData.id || 'OFF-' + Date.now()),
            date: new Date().toISOString(),
            by: saleData.cashier || currentUser.name || 'POS'
        });
    });

    localStorage.setItem('cloudpos_inventory', JSON.stringify(inventory));
    localStorage.setItem('cloudpos_movements', JSON.stringify(movements));
}
