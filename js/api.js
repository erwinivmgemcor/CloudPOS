// ============================================
// CloudPOS API Module
// Supports both GET (read) and POST (write)
// ============================================

const API_CONFIG = {
  BASE_URL: 'https://script.google.com/macros/s/AKfycbxpEWHLm1KrdcjVdfIQ_1alweZNSTcktcs8sxNjGDoFaRv8egHOFKH1mJRAv4Nadfll4w/exec',
  TIMEOUT: 30000
};

/**
 * API call - uses GET for reads, POST for writes
 */
async function apiCall(action, payload = {}) {
  const url = API_CONFIG.BASE_URL;
  
  // List of read-only actions
  const readActions = ['test', 'getDashboard', 'getProducts', 'getSales', 'getCustomers', 'getSuppliers', 'getExpenses', 'getReports', 'getInventory', 'getPurchaseOrders', 'getSettings', 'getUsers'];
  const useGet = readActions.includes(action);
  
  try {
    let response;
    
    if (useGet) {
      // GET request
      const params = new URLSearchParams();
      params.append('action', action);
      for (const key in payload) {
        if (payload[key] !== undefined && payload[key] !== null) {
          if (typeof payload[key] === 'object') {
            params.append(key, JSON.stringify(payload[key]));
          } else {
            params.append(key, payload[key]);
          }
        }
      }
      
      response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        redirect: 'follow'
      });
    } else {
      // POST request using no-cors mode for Google Apps Script
      const formData = new URLSearchParams();
      formData.append('action', action);
      for (const key in payload) {
        if (payload[key] !== undefined && payload[key] !== null) {
          if (typeof payload[key] === 'object') {
            formData.append(key, JSON.stringify(payload[key]));
          } else {
            formData.append(key, payload[key]);
          }
        }
      }
      
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        redirect: 'follow'
      });
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.message || 'API Error');
    }
    
    return result;
    
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

export { apiCall, API_CONFIG };
