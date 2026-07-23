// ============================================
// CloudPOS Utility Functions
// Formatters, validators, helpers
// ============================================

/**
 * Format number as Philippine Peso
 */
function formatPeso(amount) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount || 0);
}

/**
 * Format date to local string
 */
function formatDate(date, options = {}) {
  const d = date instanceof Date ? date : new Date(date);
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };
  return d.toLocaleDateString('en-PH', defaultOptions);
}

/**
 * Format datetime to local string
 */
function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Generate unique ID with prefix
 */
function generateId(prefix = 'ID') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Validate Philippine mobile number
 */
function isValidPhone(phone) {
  const regex = /^(09|\+639)\d{9}$/;
  return regex.test(phone.replace(/\s/g, ''));
}

/**
 * Sanitize string input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Deep clone object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Calculate percentage
 */
function calculatePercentage(value, total) {
  if (!total) return 0;
  return ((value / total) * 100).toFixed(2);
}

/**
 * Group array by key
 */
function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    result[group] = result[group] || [];
    result[group].push(item);
    return result;
  }, {});
}

/**
 * Sort array by key
 */
function sortBy(array, key, order = 'asc') {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (order === 'desc') {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
  });
}

// Export utilities
export {
  formatPeso,
  formatDate,
  formatDateTime,
  generateId,
  debounce,
  isValidPhone,
  sanitizeInput,
  deepClone,
  calculatePercentage,
  groupBy,
  sortBy
};
