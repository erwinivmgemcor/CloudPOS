// ============================================
// CloudPOS Dashboard Module
// ============================================

import { apiCall } from './api.js';
import { getCurrentUser, logout, showToast } from './auth.js';
import { formatPeso } from './utils.js';

// Global state
let salesChart = null;
let currentChartView = 'weekly';
let dashboardData = null;

/**
 * Initialize Dashboard
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Verify auth
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Load theme
  loadTheme();

  // Load dashboard data
  await loadDashboard();

  // Setup auto-refresh every 5 minutes
  setInterval(refreshDashboard, 300000);
});

/**
 * Load dashboard data from API
 */
async function loadDashboard() {
  try {
    showSkeletonLoading();
    
    const response = await apiCall('getDashboard');
    
    if (response.status === 'success') {
      dashboardData = response.data;
      renderDashboard(dashboardData);
    } else {
      showToast('Failed to load dashboard data', 'error');
    }
  } catch (error) {
    console.error('Dashboard load error:', error);
    showToast('Connection error. Using cached data if available.', 'warning');
    
    // Try to load from cache
    const cached = localStorage.getItem('dashboard_cache');
    if (cached) {
      dashboardData = JSON.parse(cached);
      renderDashboard(dashboardData);
    }
  }
}

/**
 * Render all dashboard components
 */
function renderDashboard(data) {
  renderStats(data);
  renderAlerts(data);
  renderTopProducts(data.topSellingProducts);
  renderSlowProducts(data.slowMovingProducts);
  renderChart(data.weeklySales, data.monthlySales);
  
  // Cache data
  localStorage.setItem('dashboard_cache', JSON.stringify(data));
  localStorage.setItem('dashboard_cache_time', new Date().toISOString());
}

/**
 * Render Stats Cards
 */
function renderStats(data) {
  const stats = [
    {
      key: 'sales',
      label: "Today's Sales",
      value: formatPeso(data.todaySales),
      icon: 'fa-peso-sign',
      change: '+12.5%',
      changeType: 'positive'
    },
    {
      key: 'profit',
      label: "Today's Profit",
      value: formatPeso(data.todayProfit),
      icon: 'fa-chart-line',
      change: '+8.3%',
      changeType: 'positive'
    },
    {
      key: 'transactions',
      label: 'Transactions',
      value: data.todayTransactions.toString(),
      icon: 'fa-receipt',
      change: '+5.2%',
      changeType: 'positive'
    },
    {
      key: 'products',
      label: 'Total Products',
      value: data.totalProducts.toString(),
      icon: 'fa-box',
      change: '0',
      changeType: 'neutral'
    },
    {
      key: 'customers',
      label: 'Customers',
      value: data.totalCustomers.toString(),
      icon: 'fa-users',
      change: '+3',
      changeType: 'positive'
    },
    {
      key: 'expenses',
      label: "Today's Expenses",
      value: formatPeso(data.todayExpenses),
      icon: 'fa-wallet',
      change: '-2.1%',
      changeType: 'negative'
    },
    {
      key: 'net',
      label: 'Net Income',
      value: formatPeso(data.netIncome),
      icon: 'fa-coins',
      change: '+15.7%',
      changeType: 'positive'
    }
  ];

  const container = document.getElementById('statsGrid');
  container.innerHTML = stats.map(stat => `
    <div class="stat-card ${stat.key}">
      <div class="stat-header">
        <div class="stat-icon">
          <i class="fas ${stat.icon}"></i>
        </div>
      </div>
      <div class="stat-label">${stat.label}</div>
      <div class="stat-value">${stat.value}</div>
      <div class="stat-change ${stat.changeType}">
        <i class="fas fa-arrow-${stat.changeType === 'positive' ? 'up' : stat.changeType === 'negative' ? 'down' : 'right'}"></i>
        <span>${stat.change} vs yesterday</span>
      </div>
    </div>
  `).join('');
}

/**
 * Render Alerts
 */
function renderAlerts(data) {
  const container = document.getElementById('alertsContainer');
  const alerts = [];

  // Out of stock alerts
  data.outOfStockAlert.forEach(item => {
    alerts.push({
      type: 'danger',
      icon: 'fa-times-circle',
      title: item.name,
      desc: 'Out of stock - Restock now!',
      badge: '0 left'
    });
  });

  // Low stock alerts
  data.lowStockAlert.forEach(item => {
    alerts.push({
      type: 'warning',
      icon: 'fa-exclamation-triangle',
      title: item.name,
      desc: `Only ${item.stock} left (min: ${item.minStock})`,
      badge: `${item.stock} left`
    });
  });

  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-check-circle" style="color: var(--success);"></i>
        <h3>All Good!</h3>
        <p>No stock alerts at the moment.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = alerts.map(alert => `
    <div class="alert-item ${alert.type}">
      <div class="alert-icon">
        <i class="fas ${alert.icon}"></i>
      </div>
      <div class="alert-content">
        <div class="alert-title">${alert.title}</div>
        <div class="alert-desc">${alert.desc}</div>
      </div>
      <span class="alert-badge">${alert.badge}</span>
    </div>
  `).join('');
}

/**
 * Render Top Selling Products
 */
function renderTopProducts(products) {
  const container = document.getElementById('topProductsContainer');
  
  if (!products || products.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-shopping-bag"></i>
        <h3>No Sales Yet</h3>
        <p>Start making sales to see top products here.</p>
      </div>
    `;
    return;
  }

  const ranks = ['gold', 'silver', 'bronze'];
  
  container.innerHTML = products.map((product, index) => `
    <div class="product-item">
      <div class="product-rank ${ranks[index] || 'normal'}">${index + 1}</div>
      <div class="product-info">
        <div class="product-name">${product.name}</div>
        <div class="product-meta">${product.quantity} sold</div>
      </div>
      <div class="product-stat">
        <div class="product-stat-value">${formatPeso(product.total)}</div>
        <div class="product-stat-label">Revenue</div>
      </div>
    </div>
  `).join('');
}

/**
 * Render Slow Moving Products
 */
function renderSlowProducts(products) {
  const container = document.getElementById('slowProductsContainer');
  
  if (!products || products.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-check-circle" style="color: var(--success);"></i>
        <h3>No Slow Items</h3>
        <p>All products are moving well.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(product => `
    <div class="product-item">
      <div class="product-rank normal">
        <i class="fas fa-arrow-down" style="color: var(--danger);"></i>
      </div>
      <div class="product-info">
        <div class="product-name">${product.name}</div>
        <div class="product-meta">${product.stock} in stock • ${product.soldLast30Days} sold (30d)</div>
      </div>
      <div class="product-stat">
        <div class="product-stat-value" style="color: var(--danger);">${product.soldLast30Days}</div>
        <div class="product-stat-label">Sold</div>
      </div>
    </div>
  `).join('');
}

/**
 * Render Sales Chart
 */
function renderChart(weeklyData, monthlyData) {
  const ctx = document.getElementById('salesChart').getContext('2d');
  
  const data = currentChartView === 'weekly' ? weeklyData : monthlyData;
  const labels = data.map(d => d.label);
  const values = data.map(d => d.value);

  // Destroy existing chart
  if (salesChart) {
    salesChart.destroy();
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sales (₱)',
        data: values,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: isDark ? '#1e293b' : '#fff',
          titleColor: isDark ? '#f1f5f9' : '#1e293b',
          bodyColor: isDark ? '#94a3b8' : '#64748b',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              return 'Sales: ' + formatPeso(context.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: textColor,
            font: {
              size: 11
            }
          }
        },
        y: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor,
            font: {
              size: 11
            },
            callback: function(value) {
              return '₱' + (value / 1000).toFixed(0) + 'k';
            }
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  });
}

/**
 * Switch between weekly and monthly chart
 */
function switchChart(view) {
  currentChartView = view;
  
  // Update button styles
  document.getElementById('btnWeekly').style.opacity = view === 'weekly' ? '1' : '0.6';
  document.getElementById('btnMonthly').style.opacity = view === 'monthly' ? '1' : '0.6';
  
  if (dashboardData) {
    renderChart(dashboardData.weeklySales, dashboardData.monthlySales);
  }
}

/**
 * Refresh dashboard data
 */
async function refreshDashboard() {
  const icon = document.getElementById('refreshIcon');
  if (icon) icon.classList.add('fa-spin');
  
  await loadDashboard();
  
  if (icon) icon.classList.remove('fa-spin');
  showToast('Dashboard refreshed', 'success');
}

/**
 * Show skeleton loading state
 */
function showSkeletonLoading() {
  const statsGrid = document.getElementById('statsGrid');
  statsGrid.innerHTML = Array(7).fill(0).map(() => `
    <div class="stat-card" style="min-height: 140px;">
      <div class="skeleton skeleton-title" style="width: 40%;"></div>
      <div class="skeleton skeleton-text" style="width: 70%; height: 2rem;"></div>
      <div class="skeleton skeleton-text" style="width: 50%;"></div>
    </div>
  `).join('');

  document.getElementById('alertsContainer').innerHTML = `
    <div class="skeleton skeleton-text" style="height: 60px;"></div>
    <div class="skeleton skeleton-text" style="height: 60px;"></div>
    <div class="skeleton skeleton-text" style="height: 60px;"></div>
  `;

  document.getElementById('topProductsContainer').innerHTML = `
    <div class="skeleton skeleton-text" style="height: 50px;"></div>
    <div class="skeleton skeleton-text" style="height: 50px;"></div>
    <div class="skeleton skeleton-text" style="height: 50px;"></div>
  `;

  document.getElementById('slowProductsContainer').innerHTML = `
    <div class="skeleton skeleton-text" style="height: 50px;"></div>
    <div class="skeleton skeleton-text" style="height: 50px;"></div>
  `;
}

/**
 * Toggle sidebar on mobile
 */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

/**
 * Toggle dark/light theme
 */
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('cloudpos_theme', newTheme);
  
  // Update icon
  const icon = document.querySelector('#themeToggle i');
  icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  
  // Re-render chart with new colors
  if (dashboardData) {
    setTimeout(() => {
      renderChart(dashboardData.weeklySales, dashboardData.monthlySales);
    }, 100);
  }
}

/**
 * Load saved theme
 */
function loadTheme() {
  const savedTheme = localStorage.getItem('cloudpos_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  const icon = document.querySelector('#themeToggle i');
  if (icon) {
    icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

// Make functions available globally for onclick handlers
window.toggleSidebar = toggleSidebar;
window.toggleTheme = toggleTheme;
window.switchChart = switchChart;
window.refreshDashboard = refreshDashboard;
window.logout = logout;
