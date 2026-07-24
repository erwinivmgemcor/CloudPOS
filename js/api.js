// ============================================
// CloudPOS API Module
// Uses GET requests exclusively to avoid CORS issues with Google Apps Script
// ============================================

const API_CONFIG = {
  // Replace with your deployed Google Apps Script Web App URL
  BASE_URL: 'https://script.google.com/macros/s/AKfycbxO-PIIjzEEq_RnHYi6mW1bYS2vJlyhVnE5C7nyfA6UiX3k9yYV34gVKTUANka8EIgGA/exec',
  TIMEOUT: 30000
};

/**
 * Generic API call using GET with URL parameters
 * This avoids CORS issues with POST redirects
 */
async function apiCall(action, payload = {}) {
  const url = API_CONFIG.BASE_URL;
  
  // Build URL with all parameters as query strings
  const params = new URLSearchParams();
  params.append('action', action);
  
  // Add all payload data as query parameters
  for (const key in payload) {
    if (payload[key] !== undefined && payload[key] !== null) {
      params.append(key, payload[key]);
    }
  }
  
  const fullUrl = `${url}?${params.toString()}`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
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
    const result = await apiCall('test');
    console.log('✅ API Connection Test:', result);
    return result;
  } catch (error) {
    console.error('❌ API Connection Failed:', error);
    return { status: 'error', message: error.message };
  }
}

export { apiCall, testConnection, API_CONFIG };
