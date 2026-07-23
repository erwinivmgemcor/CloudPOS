// ============================================
// CloudPOS API Module
// ============================================

const API_CONFIG = {
  // Replace with your deployed Google Apps Script Web App URL
  BASE_URL: 'https://script.google.com/macros/s/AKfycbxO-PIlLjzEEq_RnHYi6mW1bYS2vJIyhVnE5C7nyfA6UiX3k9yYV34gVKTUANka8ElgGA/exec',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 2
};

/**
 * Generic fetch wrapper with error handling
 */
async function apiCall(action, payload = {}) {
  const url = API_CONFIG.BASE_URL;
  
  // Use URL parameters for GET-like requests to avoid CORS preflight issues
  const params = new URLSearchParams({
    action: action,
    data: JSON.stringify(payload)
  });
  
  // For simple actions, use GET to avoid CORS preflight
  const useGet = ['test', 'getDashboard', 'getProducts'].includes(action);
  
  try {
    let response;
    
    if (useGet) {
      // GET request - no preflight needed
      response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        redirect: 'follow'
      });
    } else {
      // POST request for actions that modify data
      const formData = new URLSearchParams();
      formData.append('action', action);
      formData.append('data', JSON.stringify(payload));
      
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

/**
 * Test API connection
 */
async function testConnection() {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}?action=test`);
    return await response.json();
  } catch (error) {
    console.error('Connection test failed:', error);
    return { status: 'error', message: 'Cannot connect to API' };
  }
}

export { apiCall, testConnection, API_CONFIG };
