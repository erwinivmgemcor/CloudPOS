// ============================================
// CloudPOS Authentication Module
// Session management, login/logout, route guards
// ============================================

import { apiCall } from './api.js';

// Session keys
const SESSION_KEY = 'cloudpos_session';
const REMEMBER_KEY = 'cloudpos_remember';

/**
 * Initialize auth module
 */
function initAuth() {
  // Check if we're on the login page
  const isLoginPage = window.location.pathname.includes('login.html') || 
                      window.location.pathname.endsWith('/');
  
  if (isLoginPage) {
    // If already logged in, redirect to dashboard
    if (isAuthenticated()) {
      window.location.href = 'dashboard.html';
    }
    initLoginForm();
  } else {
    // On protected pages, verify session
    if (!isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }
    updateUIForUser();
  }
}

/**
 * Initialize login form handlers
 */
function initLoginForm() {
  const form = document.getElementById('loginForm');
  const submitBtn = document.getElementById('submitBtn');
  const togglePassword = document.getElementById('togglePassword');
  
  if (!form) return;
  
  // Toggle password visibility
  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      const passwordInput = document.getElementById('password');
      const icon = togglePassword.querySelector('i');
      
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });
  }
  
  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    // Client-side validation
    if (!username || !password) {
      showToast('Please enter both username and password', 'warning');
      return;
    }
    
    // Show loading state
    setLoading(true);
    
    try {
        const response = await apiCall('login', {
  username: username,
  password: password,
  rememberMe: rememberMe
      });
      
      if (response.status === 'success') {
        // Store session
        const sessionData = {
          ...response.data,
          loginTime: new Date().toISOString()
        };
        
        if (rememberMe) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
          localStorage.setItem(REMEMBER_KEY, 'true');
        } else {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
          localStorage.removeItem(REMEMBER_KEY);
        }
        
        showToast('Login successful! Redirecting...', 'success');
        
        // Redirect to dashboard
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1000);
      }
      
    } catch (error) {
      console.error('Login error:', error);
      showToast(error.message || 'Login failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  });
}

/**
 * Set loading state on submit button
 */
function setLoading(loading) {
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  
  if (!submitBtn) return;
  
  if (loading) {
    submitBtn.disabled = true;
    btnText.innerHTML = '<span class="spinner"></span> Signing in...';
  } else {
    submitBtn.disabled = false;
    btnText.textContent = 'Sign In';
  }
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  const session = getSession();
  
  if (!session) return false;
  
  // Check if session expired
  const now = new Date();
  const expiresAt = new Date(session.expiresAt);
  
  if (now > expiresAt) {
    clearSession();
    return false;
  }
  
  return true;
}

/**
 * Get current session data
 */
function getSession() {
  // Check sessionStorage first, then localStorage
  const sessionData = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  
  if (!sessionData) return null;
  
  try {
    return JSON.parse(sessionData);
  } catch {
    return null;
  }
}

/**
 * Get current user data
 */
function getCurrentUser() {
  const session = getSession();
  return session ? session.user : null;
}

/**
 * Clear session (logout)
 */
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REMEMBER_KEY);
}

/**
 * Logout handler
 */
function logout() {
  clearSession();
  showToast('Logged out successfully', 'info');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 500);
}

/**
 * Update UI elements with user data
 */
function updateUIForUser() {
  const user = getCurrentUser();
  if (!user) return;
  
  // Update user name displays
  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = user.fullName || user.username;
  });
  
  // Update user role displays
  document.querySelectorAll('[data-user-role]').forEach(el => {
    el.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  });
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  
  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Auto remove
  setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

/**
 * Create toast container if not exists
 */
function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toastContainer';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

/**
 * Route guard for protected pages
 */
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initAuth);

// Export for use in other modules
export {
  initAuth,
  isAuthenticated,
  getCurrentUser,
  getSession,
  logout,
  showToast,
  requireAuth
};
