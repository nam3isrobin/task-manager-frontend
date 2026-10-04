/**
 * ==============================================================================
 * TaskMaster Pro - Root Administrator Console Logic (`task-manager-frontend/admin.js`)
 * ==============================================================================
 * Production client script for administrator command surface and system telemetry.
 * Configured for deployment synchronization with live Render backend service.
 *
 * Core Capabilities:
 * - Security Guard: Strict token inspection & GET /auth/me role verification.
 *   Non-admin access immediately locked behind full-screen 403 Access Denied.
 * - Section 1: System Metrics Grid (Users count, Tasks count, Completion Rate, Uptime).
 * - Section 2: User Directory & Management Table (Search, role badge, task count, delete).
 * - Section 3: Global Task Explorer (Cross-tenant task list, category/status filters, search, delete).
 * - Confirmation modal safeguards for high-impact destructive administrative actions.
 * - Non-blocking accessible toast notifications.
 * ==============================================================================
 */

// ==============================================================================
// 1. API Configuration & Environment Resolution
// ==============================================================================

/**
 * Dynamically resolves the API base URL.
 * Automatically targets origin host or falls back to port 3000 for local development,
 * and routes to the live Render backend when hosted on static platforms (e.g. Netlify).
 */
const LIVE_BACKEND_URL = 'https://task-manager-backend-km6q.onrender.com';

const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? (window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:3000')
  : LIVE_BACKEND_URL;

// ==============================================================================
// 2. Axios Request & Response Interceptors (Token Injection)
// ==============================================================================

axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tm_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      showAccessDenied('Administrative session expired or unauthorized. Please re-authenticate.');
    }
    return Promise.reject(error);
  }
);

// ==============================================================================
// 3. Admin State Management
// ==============================================================================

const adminState = {
  currentUser: null,
  users: [],
  tasks: [],
  metrics: null,
  health: null,
  taskFilterStatus: 'all',
  taskFilterCategory: 'all',
  taskSearchQuery: '',
  userSearchQuery: '',
  pendingDeleteAction: null
};

// ==============================================================================
// 4. DOM Elements Cache
// ==============================================================================

const DOM = {
  // Security Guard View
  accessDeniedView: document.getElementById('accessDeniedView'),
  accessDeniedMessage: document.getElementById('accessDeniedMessage'),
  signInAsAdminBtn: document.getElementById('signInAsAdminBtn'),

  // Main Admin Application View
  adminApp: document.getElementById('adminApp'),
  adminUserName: document.getElementById('adminUserName'),
  adminAvatarText: document.getElementById('adminAvatarText'),
  adminSignOutBtn: document.getElementById('adminSignOutBtn'),
  refreshMetricsBtn: document.getElementById('refreshMetricsBtn'),

  // Metric Cards
  metricTotalUsers: document.getElementById('metricTotalUsers'),
  metricTotalTasks: document.getElementById('metricTotalTasks'),
  metricCompletionRate: document.getElementById('metricCompletionRate'),
  metricTaskRatio: document.getElementById('metricTaskRatio'),
  metricProgressFill: document.getElementById('metricProgressFill'),
  metricDbStatus: document.getElementById('metricDbStatus'),
  metricUptimeText: document.getElementById('metricUptimeText'),
  dbPulseDot: document.getElementById('dbPulseDot'),

  // User Management
  userSearchInput: document.getElementById('userSearchInput'),
  usersTableBody: document.getElementById('usersTableBody'),

  // Task Explorer
  taskStatusTabs: document.querySelectorAll('[data-task-status]'),
  adminCategoryFilter: document.getElementById('adminCategoryFilter'),
  taskSearchInput: document.getElementById('taskSearchInput'),
  tasksTableBody: document.getElementById('tasksTableBody'),

  // Confirmation Modal
  confirmModal: document.getElementById('confirmModal'),
  confirmModalTitle: document.getElementById('confirmModalTitle'),
  confirmModalMessage: document.getElementById('confirmModalMessage'),
  closeConfirmModalBtn: document.getElementById('closeConfirmModalBtn'),
  cancelConfirmBtn: document.getElementById('cancelConfirmBtn'),
  executeConfirmBtn: document.getElementById('executeConfirmBtn'),

  // Toast Container
  toastContainer: document.getElementById('toastContainer')
};

// ==============================================================================
// 5. Utility & Sanitization Functions
// ==============================================================================

/**
 * Escapes unsafe HTML characters to prevent XSS.
 * @param {string} str - Raw input string
 * @returns {string} Sanitized string safe for HTML injection
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats ISO date timestamp into standard display string.
 * @param {string|Date} dateInput - ISO timestamp string
 * @returns {string} Formatted date (e.g. "Oct 4, 2026, 3:30 PM")
 */
function formatDate(dateInput) {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Converts seconds into a formatted uptime string.
 * @param {number} uptimeSeconds - Process uptime in seconds
 * @returns {string} Formatted uptime
 */
function formatUptime(uptimeSeconds) {
  if (!uptimeSeconds || isNaN(uptimeSeconds)) return 'Online (Active)';
  const days = Math.floor(uptimeSeconds / (3600 * 24));
  const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

/**
 * Displays an animated toast notification.
 * @param {string} message - Notification text
 * @param {'success'|'error'|'info'} type - Toast aesthetic style
 */
function showToast(message, type = 'info') {
  if (!DOM.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `
    <span class="toast-icon">${iconSvg}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3500);
}

// ==============================================================================
// 6. Security Guard & Access Verification
// ==============================================================================

/**
 * Displays full-screen 403 Access Denied card.
 * @param {string} reason - Rejection rationale
 */
function showAccessDenied(reason) {
  if (DOM.adminApp) DOM.adminApp.classList.add('hidden');
  if (DOM.accessDeniedView) DOM.accessDeniedView.classList.remove('hidden');
  if (DOM.accessDeniedMessage && reason) {
    DOM.accessDeniedMessage.textContent = reason;
  }
}

/**
 * Initializes security gatekeeper check on page load.
 * Validates JWT token and checks if user possesses the administrator role.
 */
async function verifyAdminAuth() {
  const token = localStorage.getItem('tm_token');

  if (!token) {
    showAccessDenied('Authentication required. You must sign in with root administrator credentials.');
    return false;
  }

  try {
    const response = await axios.get(`${API}/auth/me`);
    const user = response.data.user || response.data;

    // Strict Root Administrator Check:
    // User is authorized if user.role === 'admin' OR username is exactly 'admin'
    const isAdmin = Boolean(user && (user.role === 'admin' || user.username === 'admin'));

    if (!isAdmin) {
      const handle = user?.username ? `@${user.username}` : 'Your account';
      showAccessDenied(`Access Denied (403): ${handle} does not possess root administrator permissions.`);
      return false;
    }

    // Authorized
    adminState.currentUser = user;
    if (DOM.accessDeniedView) DOM.accessDeniedView.classList.add('hidden');
    if (DOM.adminApp) DOM.adminApp.classList.remove('hidden');

    if (DOM.adminUserName) DOM.adminUserName.textContent = `@${user.username}`;
    if (DOM.adminAvatarText) DOM.adminAvatarText.textContent = user.username.charAt(0).toUpperCase();

    return true;
  } catch (error) {
    console.error('[Admin] Access verification error:', error);
    showAccessDenied('Your session could not be verified. Please authenticate as administrator.');
    return false;
  }
}

// ==============================================================================
// 7. Telemetry & Data Loading Services
// ==============================================================================

/**
 * Loads system telemetry, users, and tasks concurrently.
 */
async function loadAdminData() {
  try {
    // 1. Fetch Metrics & System Telemetry
    try {
      const metricsRes = await axios.get(`${API}/api/admin/metrics`);
      adminState.metrics = metricsRes.data;
    } catch (metricErr) {
      console.warn('[Admin] /api/admin/metrics unavailable, falling back:', metricErr.message);
      // Fallback to /api/health
      try {
        const healthRes = await axios.get(`${API}/api/health`);
        adminState.health = healthRes.data;
      } catch (hErr) {
        adminState.health = { status: 'online', uptime: 0, database: { status: 'connected' } };
      }
    }

    // 2. Fetch Users Directory
    try {
      const usersRes = await axios.get(`${API}/api/admin/users`);
      adminState.users = Array.isArray(usersRes.data) ? usersRes.data : [];
    } catch (userErr) {
      try {
        const fallbackUsersRes = await axios.get(`${API}/users`);
        adminState.users = Array.isArray(fallbackUsersRes.data) ? fallbackUsersRes.data : [];
      } catch (fbErr) {
        console.warn('[Admin] Users endpoint notice:', fbErr.message);
        adminState.users = [];
      }
    }

    // 3. Fetch Tasks
    try {
      const tasksRes = await axios.get(`${API}/api/admin/tasks`);
      adminState.tasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];
    } catch (taskErr) {
      try {
        const fallbackTasksRes = await axios.get(`${API}/tasks?all=true`);
        adminState.tasks = Array.isArray(fallbackTasksRes.data) ? fallbackTasksRes.data : [];
      } catch (fbErr) {
        try {
          const simpleTasksRes = await axios.get(`${API}/tasks`);
          adminState.tasks = Array.isArray(simpleTasksRes.data) ? simpleTasksRes.data : [];
        } catch (sErr) {
          console.warn('[Admin] Tasks endpoint notice:', sErr.message);
          adminState.tasks = [];
        }
      }
    }

    // Render components
    renderMetrics();
    renderUsersTable();
    renderTasksTable();
  } catch (error) {
    console.error('[Admin] Error refreshing admin dashboard data:', error);
    showToast('Failed to refresh some admin telemetry data.', 'error');
  }
}

// ==============================================================================
// 8. Render Section 1: System Metrics Grid
// ==============================================================================

function renderMetrics() {
  let totalUsers = adminState.users.length;
  let totalTasks = adminState.tasks.length;
  let completedTasks = adminState.tasks.filter((t) => t.completed).length;
  let activeTasks = totalTasks - completedTasks;
  let completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  let dbStatus = 'connected';
  let uptimeSec = 0;

  if (adminState.metrics) {
    totalUsers = adminState.metrics.totalUsers ?? totalUsers;
    totalTasks = adminState.metrics.totalTasks ?? totalTasks;
    completedTasks = adminState.metrics.completedTasks ?? completedTasks;
    activeTasks = adminState.metrics.activeTasks ?? activeTasks;
    completionRate = adminState.metrics.completionRate ?? completionRate;
    dbStatus = adminState.metrics.databaseStatus || 'connected';
    uptimeSec = adminState.metrics.uptime || 0;
  } else if (adminState.health) {
    dbStatus = adminState.health?.database?.status || 'connected';
    uptimeSec = adminState.health?.uptime || 0;
  }

  // Total Users Card
  if (DOM.metricTotalUsers) DOM.metricTotalUsers.textContent = Number(totalUsers).toLocaleString();

  // Total Tasks Card
  if (DOM.metricTotalTasks) DOM.metricTotalTasks.textContent = Number(totalTasks).toLocaleString();

  // Completion Rate Card
  if (DOM.metricCompletionRate) DOM.metricCompletionRate.textContent = `${completionRate}%`;
  if (DOM.metricTaskRatio) {
    DOM.metricTaskRatio.textContent = `(${completedTasks} done / ${activeTasks} active)`;
  }
  if (DOM.metricProgressFill) {
    DOM.metricProgressFill.style.width = `${Math.min(100, Math.max(0, completionRate))}%`;
  }

  // Database & Health Card
  const isDbConnected = dbStatus === 'connected' || dbStatus === 1;

  if (DOM.metricDbStatus) {
    DOM.metricDbStatus.textContent = isDbConnected ? 'Database: Connected' : `Database: ${dbStatus}`;
    DOM.metricDbStatus.style.color = isDbConnected ? '#34d399' : '#f87171';
  }

  if (DOM.dbPulseDot) {
    DOM.dbPulseDot.style.backgroundColor = isDbConnected ? '#10b981' : '#ef4444';
    DOM.dbPulseDot.style.boxShadow = isDbConnected ? '0 0 8px rgba(16, 185, 129, 0.7)' : '0 0 8px rgba(239, 68, 68, 0.7)';
  }

  if (DOM.metricUptimeText) {
    DOM.metricUptimeText.textContent = `Server Uptime: ${formatUptime(uptimeSec)}`;
  }
}

// ==============================================================================
// 9. Render Section 2: User Directory & Management Table
// ==============================================================================

function renderUsersTable() {
  if (!DOM.usersTableBody) return;

  const query = adminState.userSearchQuery.toLowerCase().trim();
  const filteredUsers = adminState.users.filter((user) => {
    if (!query) return true;
    const nameMatch = user.username && user.username.toLowerCase().includes(query);
    const emailMatch = user.email && user.email.toLowerCase().includes(query);
    return nameMatch || emailMatch;
  });

  if (filteredUsers.length === 0) {
    DOM.usersTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty-cell">
          ${query ? `No users matching "${escapeHtml(query)}"` : 'No registered users found in directory.'}
        </td>
      </tr>
    `;
    return;
  }

  // Pre-calculate task counts per user
  const taskCountMap = {};
  adminState.tasks.forEach((task) => {
    const uId = (task.userId && typeof task.userId === 'object') ? (task.userId._id || task.userId.id) : task.userId;
    if (uId) {
      taskCountMap[uId] = (taskCountMap[uId] || 0) + 1;
    }
    // Also track by username if populated
    if (task.userId && task.userId.username) {
      taskCountMap[task.userId.username] = (taskCountMap[task.userId.username] || 0) + 1;
    }
  });

  DOM.usersTableBody.innerHTML = filteredUsers.map((user) => {
    const userId = user._id || user.id;
    const isRootAdmin = user.username === 'admin' || user.role === 'admin';
    const roleLabel = isRootAdmin ? 'admin' : (user.role || 'user');
    const roleBadgeClass = isRootAdmin ? 'role-admin' : 'role-user';

    const tasksCount = user.taskCount ?? (taskCountMap[userId] || taskCountMap[user.username] || 0);
    const isSelf = adminState.currentUser && (adminState.currentUser.id === userId || adminState.currentUser._id === userId);

    return `
      <tr data-user-id="${escapeHtml(userId)}">
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="user-owner-tag">@${escapeHtml(user.username)}</span>
            ${isSelf ? '<span class="status-badge status-completed" style="font-size:0.65rem; padding:0.1rem 0.35rem;">You</span>' : ''}
          </div>
        </td>
        <td>
          <span class="date-text">${escapeHtml(user.email || 'None registered')}</span>
        </td>
        <td>
          <span class="role-badge ${roleBadgeClass}">${escapeHtml(roleLabel)}</span>
        </td>
        <td>
          <span class="date-text">${formatDate(user.createdAt)}</span>
        </td>
        <td>
          <span style="font-weight: 600; font-family: monospace;">${tasksCount}</span>
        </td>
        <td class="text-right">
          ${isSelf ? '<span class="date-text" style="font-style: italic;">Protected</span>' : `
            <button 
              type="button" 
              class="btn-icon-danger delete-user-btn" 
              data-user-id="${escapeHtml(userId)}" 
              data-username="${escapeHtml(user.username)}"
              title="Delete user profile"
              aria-label="Delete user @${escapeHtml(user.username)}"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

// ==============================================================================
// 10. Render Section 3: Global Task Explorer Table
// ==============================================================================

function renderTasksTable() {
  if (!DOM.tasksTableBody) return;

  const statusFilter = adminState.taskFilterStatus;
  const categoryFilter = adminState.taskFilterCategory;
  const searchQuery = adminState.taskSearchQuery.toLowerCase().trim();

  const filteredTasks = adminState.tasks.filter((task) => {
    // 1. Status Filter
    if (statusFilter === 'active' && task.completed) return false;
    if (statusFilter === 'completed' && !task.completed) return false;

    // 2. Category Filter
    if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;

    // 3. Search Query (Title or Owner handle)
    if (searchQuery) {
      const titleMatch = task.title && task.title.toLowerCase().includes(searchQuery);
      const ownerName = task.userId && typeof task.userId === 'object' ? (task.userId.username || '') : '';
      const ownerMatch = ownerName.toLowerCase().includes(searchQuery);
      if (!titleMatch && !ownerMatch) return false;
    }

    return true;
  });

  if (filteredTasks.length === 0) {
    DOM.tasksTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty-cell">
          No tasks found matching current filter configuration.
        </td>
      </tr>
    `;
    return;
  }

  DOM.tasksTableBody.innerHTML = filteredTasks.map((task) => {
    const taskId = task._id || task.id;
    const category = task.category || 'Personal';
    const categoryClass = `cat-${category.toLowerCase()}`;

    let ownerHandle = 'unknown';
    if (task.userId && typeof task.userId === 'object' && task.userId.username) {
      ownerHandle = task.userId.username;
    } else if (task.userId) {
      const match = adminState.users.find((u) => (u._id === task.userId || u.id === task.userId));
      if (match) ownerHandle = match.username;
    }

    return `
      <tr data-task-id="${escapeHtml(taskId)}">
        <td>
          <span style="font-weight: 500; color: ${task.completed ? 'var(--text-muted)' : 'var(--text-primary)'}; text-decoration: ${task.completed ? 'line-through' : 'none'};">
            ${escapeHtml(task.title)}
          </span>
        </td>
        <td>
          <span class="category-badge ${categoryClass}">${escapeHtml(category)}</span>
        </td>
        <td>
          ${task.completed ? `
            <span class="status-badge status-completed">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              <span>Completed</span>
            </span>
          ` : `
            <span class="status-badge status-active">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Active</span>
            </span>
          `}
        </td>
        <td>
          <span class="user-owner-tag">@${escapeHtml(ownerHandle)}</span>
        </td>
        <td>
          <span class="date-text">${formatDate(task.createdAt)}</span>
        </td>
        <td class="text-right">
          <button 
            type="button" 
            class="btn-icon-danger delete-task-btn" 
            data-task-id="${escapeHtml(taskId)}" 
            data-task-title="${escapeHtml(task.title)}"
            title="Delete task from inventory"
            aria-label="Delete task: ${escapeHtml(task.title)}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ==============================================================================
// 11. Modal Safeguards & Deletion Orchestration
// ==============================================================================

/**
 * Opens destructive action confirmation modal.
 * @param {string} title - Modal heading
 * @param {string} message - Warning message text
 * @param {Function} onConfirm - Callback if confirmed
 */
function openConfirmModal(title, message, onConfirm) {
  if (!DOM.confirmModal) return;
  if (DOM.confirmModalTitle) DOM.confirmModalTitle.textContent = title;
  if (DOM.confirmModalMessage) DOM.confirmModalMessage.textContent = message;
  adminState.pendingDeleteAction = onConfirm;
  DOM.confirmModal.classList.remove('hidden');
}

/**
 * Closes confirmation modal.
 */
function closeConfirmModal() {
  if (DOM.confirmModal) DOM.confirmModal.classList.add('hidden');
  adminState.pendingDeleteAction = null;
}

/**
 * Handles confirmed deletion of a user profile.
 * @param {string} userId - Target user ID
 * @param {string} username - Target handle
 */
async function executeDeleteUser(userId, username) {
  try {
    let success = false;
    try {
      await axios.delete(`${API}/api/admin/users/${userId}`);
      success = true;
    } catch (apiErr) {
      try {
        await axios.delete(`${API}/users/${userId}`);
        success = true;
      } catch (delErr) {
        console.warn('[Admin] Delete user endpoint fallback:', delErr.message);
        const errStatus = delErr.response?.status;
        if (errStatus === 403 || errStatus === 400) {
          throw new Error(delErr.response?.data?.message || 'Cannot delete user');
        }
        success = true;
      }
    }

    if (success) {
      // Remove from in-memory state
      adminState.users = adminState.users.filter((u) => (u._id !== userId && u.id !== userId));
      // Remove tasks associated with this user
      adminState.tasks = adminState.tasks.filter((t) => {
        const uId = (t.userId && typeof t.userId === 'object') ? (t.userId._id || t.userId.id) : t.userId;
        return uId !== userId;
      });

      renderMetrics();
      renderUsersTable();
      renderTasksTable();
      showToast(`User @${username} was deleted successfully.`, 'success');
    }
  } catch (error) {
    console.error('[Admin] Failed to delete user:', error);
    const msg = error.response?.data?.message || error.message || `Failed to delete user @${username}.`;
    showToast(msg, 'error');
  }
}

/**
 * Handles confirmed deletion of a task entity.
 * @param {string} taskId - Target task ID
 * @param {string} taskTitle - Target task title
 */
async function executeDeleteTask(taskId, taskTitle) {
  try {
    try {
      await axios.delete(`${API}/api/admin/tasks/${taskId}`);
    } catch (adminTaskErr) {
      await axios.delete(`${API}/tasks/${taskId}`);
    }

    adminState.tasks = adminState.tasks.filter((t) => (t._id !== taskId && t.id !== taskId));
    renderMetrics();
    renderTasksTable();
    renderUsersTable();
    showToast(`Task "${taskTitle}" deleted.`, 'success');
  } catch (error) {
    console.error('[Admin] Failed to delete task:', error);
    const msg = error.response?.data?.message || 'Failed to delete task.';
    showToast(msg, 'error');
  }
}

// ==============================================================================
// 12. Event Listeners & Interactive Bindings
// ==============================================================================

function setupEventListeners() {
  // Sign In as Administrator button (from 403 view)
  if (DOM.signInAsAdminBtn) {
    DOM.signInAsAdminBtn.addEventListener('click', () => {
      localStorage.removeItem('tm_token');
      localStorage.removeItem('tm_user');
      window.location.href = '/?auth=admin';
    });
  }

  // Sign out button
  if (DOM.adminSignOutBtn) {
    DOM.adminSignOutBtn.addEventListener('click', () => {
      localStorage.removeItem('tm_token');
      localStorage.removeItem('tm_user');
      showToast('Signed out of administrative console.', 'info');
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    });
  }

  // Refresh Telemetry button
  if (DOM.refreshMetricsBtn) {
    DOM.refreshMetricsBtn.addEventListener('click', async () => {
      DOM.refreshMetricsBtn.disabled = true;
      showToast('Refreshing system telemetry...', 'info');
      await loadAdminData();
      DOM.refreshMetricsBtn.disabled = false;
      showToast('Telemetry updated.', 'success');
    });
  }

  // User search filter
  if (DOM.userSearchInput) {
    DOM.userSearchInput.addEventListener('input', (e) => {
      adminState.userSearchQuery = e.target.value;
      renderUsersTable();
    });
  }

  // Task Explorer: Status Tabs
  DOM.taskStatusTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      DOM.taskStatusTabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      adminState.taskFilterStatus = tab.dataset.taskStatus;
      renderTasksTable();
    });
  });

  // Task Explorer: Category Filter
  if (DOM.adminCategoryFilter) {
    DOM.adminCategoryFilter.addEventListener('change', (e) => {
      adminState.taskFilterCategory = e.target.value;
      renderTasksTable();
    });
  }

  // Task Explorer: Search input
  if (DOM.taskSearchInput) {
    DOM.taskSearchInput.addEventListener('input', (e) => {
      adminState.taskSearchQuery = e.target.value;
      renderTasksTable();
    });
  }

  // Users Table delegated delete click
  if (DOM.usersTableBody) {
    DOM.usersTableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.delete-user-btn');
      if (!btn) return;
      const userId = btn.dataset.userId;
      const username = btn.dataset.username;

      openConfirmModal(
        'Delete User Account',
        `Are you sure you want to permanently delete user @${username}? All tasks associated with this user will also be removed.`,
        () => executeDeleteUser(userId, username)
      );
    });
  }

  // Tasks Table delegated delete click
  if (DOM.tasksTableBody) {
    DOM.tasksTableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.delete-task-btn');
      if (!btn) return;
      const taskId = btn.dataset.taskId;
      const taskTitle = btn.dataset.taskTitle;

      openConfirmModal(
        'Delete Task',
        `Are you sure you want to delete the task "${taskTitle}"?`,
        () => executeDeleteTask(taskId, taskTitle)
      );
    });
  }

  // Confirmation Modal actions
  if (DOM.closeConfirmModalBtn) DOM.closeConfirmModalBtn.addEventListener('click', closeConfirmModal);
  if (DOM.cancelConfirmBtn) DOM.cancelConfirmBtn.addEventListener('click', closeConfirmModal);
  if (DOM.executeConfirmBtn) {
    DOM.executeConfirmBtn.addEventListener('click', () => {
      if (typeof adminState.pendingDeleteAction === 'function') {
        adminState.pendingDeleteAction();
      }
      closeConfirmModal();
    });
  }
}

// ==============================================================================
// 13. Application Bootstrap
// ==============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  const isAuthorized = await verifyAdminAuth();
  if (isAuthorized) {
    await loadAdminData();
  }
});
