/**
 * ==============================================================================
 * TaskMaster Pro - Frontend Application Logic (`public/script.js`)
 * ==============================================================================
 * Production-ready JavaScript client utilizing Axios for RESTful API orchestration.
 *
 * Core Features & Capabilities:
 * - Authentication System:
 *   * Register (POST /auth/register) -> JWT token + user profile.
 *   * Login (POST /auth/login) -> JWT token + user profile.
 *   * Verify Session (GET /auth/me) -> Session validation on startup.
 *   * Axios interceptor for automatic Bearer token injection.
 *   * 401 session expiration handling with automatic logout and re-auth prompt.
 * - Core CRUD: Tasks management with user tenancy.
 * - Assignment 1: Edit task title & properties (PUT /tasks/:id).
 * - Assignment 2: Strict category taxonomy ('Work', 'Personal', 'Urgent').
 * - Assignment 3: Chronological sorting (Newest first / Oldest first).
 * - Multi-Tenant Security: Private task ownership per authenticated user.
 *
 * Invariants & Best Practices:
 * - Pure Standard Vanilla CSS integration (zero Tailwind shortcuts).
 * - Dark theme canvas and overscroll lock (#0d1117).
 * - Comprehensive inline comments and defensive validation guards.
 * ==============================================================================
 */

// ==============================================================================
// 1. API Configuration & Environment Detection
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
// 2. Axios Request & Response Interceptors (Token & Auth Lifecycle)
// ==============================================================================

/**
 * Request Interceptor: Automatically injects JWT Bearer token from localStorage
 * into every outgoing Axios HTTP request header.
 */
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

/**
 * Response Interceptor: Listens for HTTP 401 Unauthorized responses.
 * If a token was previously held and a protected request fails with 401,
 * clears credentials, updates UI to guest state, and prompts for re-authentication.
 */
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Avoid triggering session-expired toast if user entered wrong password during login
      const isAuthAttempt = error.config && error.config.url && (
        error.config.url.includes('/auth/login') ||
        error.config.url.includes('/auth/register')
      );
      const existingToken = localStorage.getItem('tm_token');

      if (existingToken && !isAuthAttempt) {
        localStorage.removeItem('tm_token');
        localStorage.removeItem('tm_user');
        state.currentUser = null;
        updateAuthUI();
        showToast('Session expired. Please log in again.', 'error');
        openAuthModal('signin');
      }
    }
    return Promise.reject(error);
  }
);

// ==============================================================================
// 3. Application State Management
// ==============================================================================

const state = {
  // Authenticated user entity: { id, username, email } or null
  currentUser: null,
  // Task completion filter: 'all' | 'active' | 'completed'
  filterStatus: 'all',
  // Category taxonomy filter: 'all' | 'Work' | 'Personal' | 'Urgent'
  filterCategory: 'all',
  // Chronological sort order: 'desc' (Newest first) | 'asc' (Oldest first)
  sortOrder: 'desc',
  // In-memory cache of retrieved tasks for current user
  tasksCache: [],
  // Task currently undergoing edit in modal
  editingTaskId: null,
  // Network activity flag
  isLoading: false
};

// ==============================================================================
// 4. DOM Elements Cache
// ==============================================================================

const DOM = {
  // Authentication Bar & Header Controls
  // Authentication Bar & Header Controls
  authControlBar: document.getElementById('authControlBar'),
  authGuestView: document.getElementById('authGuestView'),
  authUserView: document.getElementById('authUserView'),
  adminPortalBtn: document.getElementById('adminPortalBtn'),
  openAuthModalBtn: document.getElementById('openAuthModalBtn'),
  userProfileBadge: document.getElementById('userProfileBadge'),
  userAvatarText: document.getElementById('userAvatarText'),
  userHandle: document.getElementById('userHandle'),
  signOutBtn: document.getElementById('signOutBtn'),

  // Dedicated Fullscreen Authentication View & App Container
  authFullscreenView: document.getElementById('authFullscreenView'),
  appDashboard: document.getElementById('appDashboard'),
  tabSignInFsBtn: document.getElementById('tabSignInFsBtn'),
  tabRegisterFsBtn: document.getElementById('tabRegisterFsBtn'),
  authFsErrorAlert: document.getElementById('authFsErrorAlert'),
  authFsErrorText: document.getElementById('authFsErrorText'),
  signInFsPanel: document.getElementById('signInFsPanel'),
  registerFsPanel: document.getElementById('registerFsPanel'),
  signInFsForm: document.getElementById('signInFsForm'),
  loginFsUsername: document.getElementById('loginFsUsername'),
  loginFsPassword: document.getElementById('loginFsPassword'),
  submitLoginFsBtn: document.getElementById('submitLoginFsBtn'),
  registerFsForm: document.getElementById('registerFsForm'),
  registerFsUsername: document.getElementById('registerFsUsername'),
  registerFsEmail: document.getElementById('registerFsEmail'),
  registerFsPassword: document.getElementById('registerFsPassword'),
  registerFsConfirmPassword: document.getElementById('registerFsConfirmPassword'),
  submitRegisterFsBtn: document.getElementById('submitRegisterFsBtn'),
  demoUserPill: document.getElementById('demoUserPill'),
  demoAdminPill: document.getElementById('demoAdminPill'),

  // Auth Modal Dialog & Tab Switcher (Secondary / Legacy modal)
  authModal: document.getElementById('authModal'),
  authModalTitle: document.getElementById('authModalTitle'),
  closeAuthModalBtn: document.getElementById('closeAuthModalBtn'),
  tabSignInBtn: document.getElementById('tabSignInBtn'),
  tabRegisterBtn: document.getElementById('tabRegisterBtn'),
  authErrorAlert: document.getElementById('authErrorAlert'),
  authErrorText: document.getElementById('authErrorText'),
  signInFormPanel: document.getElementById('signInFormPanel'),
  registerFormPanel: document.getElementById('registerFormPanel'),

  // Sign In Form Elements
  signInForm: document.getElementById('signInForm'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  submitLoginBtn: document.getElementById('submitLoginBtn'),

  // Register Form Elements
  registerForm: document.getElementById('registerForm'),
  registerUsername: document.getElementById('registerUsername'),
  registerEmail: document.getElementById('registerEmail'),
  registerPassword: document.getElementById('registerPassword'),
  registerConfirmPassword: document.getElementById('registerConfirmPassword'),
  submitRegisterBtn: document.getElementById('submitRegisterBtn'),

  // Task Creation Form
  taskForm: document.getElementById('taskForm'),
  taskTitleInput: document.getElementById('taskTitleInput'),
  taskCategorySelect: document.getElementById('taskCategorySelect'),
  addTaskBtn: document.getElementById('addTaskBtn'),

  // Filtering & Sorting Toolbar
  filterTabs: document.querySelectorAll('.tab-btn'),
  categoryFilter: document.getElementById('categoryFilter'),
  sortToggleBtn: document.getElementById('sortToggleBtn'),
  sortDescIcon: document.getElementById('sortDescIcon'),
  sortAscIcon: document.getElementById('sortAscIcon'),
  sortLabel: document.getElementById('sortLabel'),

  // Status Summary & Progress
  statusCounter: document.getElementById('statusCounter'),
  activeFilterBadge: document.getElementById('activeFilterBadge'),
  progressBar: document.getElementById('progressBar'),

  // Task List, Empty State & Guest State Containers
  taskList: document.getElementById('taskList'),
  emptyState: document.getElementById('emptyState'),
  guestState: document.getElementById('guestState'),
  guestSignInBtn: document.getElementById('guestSignInBtn'),

  // Edit Task Modal Dialog
  editModal: document.getElementById('editModal'),
  closeEditModalBtn: document.getElementById('closeEditModalBtn'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  editTaskForm: document.getElementById('editTaskForm'),
  editTaskId: document.getElementById('editTaskId'),
  editTaskTitle: document.getElementById('editTaskTitle'),
  editTaskCategory: document.getElementById('editTaskCategory'),
  editTaskCompleted: document.getElementById('editTaskCompleted'),

  // Toast Container
  toastContainer: document.getElementById('toastContainer')
};

// ==============================================================================
// 5. Utility Functions & Sanitization
// ==============================================================================

/**
 * Escapes unsafe HTML characters to prevent XSS injection.
 * @param {string} str - Raw input string
 * @returns {string} Sanitized string safe for innerHTML injection
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
 * Formats ISO date timestamp into a human-friendly string.
 * @param {string|Date} dateInput - ISO timestamp string
 * @returns {string} Formatted date (e.g. "Oct 4, 2026, 3:30 PM")
 */
function formatDate(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Displays an accessible, animated toast notification.
 * @param {string} message - Notification text
 * @param {'success'|'error'|'info'} type - Toast aesthetic style
 */
function showToast(message, type = 'info') {
  if (!DOM.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  // Pick appropriate icon based on severity
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

  // Auto-remove toast after animation concludes (3.5 seconds)
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3500);
}

// ==============================================================================
// 6. Authentication Services & UI State Synchronization
// ==============================================================================

/**
 * Validates existing session on initial application load.
 * Invokes GET /auth/me with Bearer token.
 * @returns {Promise<boolean>} True if session is valid, false otherwise
 */
async function checkAuthSession() {
  const token = localStorage.getItem('tm_token');
  if (!token) {
    state.currentUser = null;
    updateAuthUI();
    return false;
  }

  try {
    const response = await axios.get(`${API}/auth/me`);
    const user = response.data.user || response.data;
    state.currentUser = user;
    localStorage.setItem('tm_user', JSON.stringify(user));
    updateAuthUI();
    return true;
  } catch (error) {
    console.warn('[Auth] Session validation failed:', error.message);
    localStorage.removeItem('tm_token');
    localStorage.removeItem('tm_user');
    state.currentUser = null;
    updateAuthUI();
    return false;
  }
}

/**
 * Updates header, status bar, and workspace based on authentication status.
 * Enforces fullscreen dedicated authentication portal when unauthenticated.
 */
function updateAuthUI() {
  const isAuthenticated = Boolean(state.currentUser && localStorage.getItem('tm_token'));

  if (isAuthenticated) {
    // 1. Hide fullscreen authentication view
    if (DOM.authFullscreenView) DOM.authFullscreenView.classList.add('hidden');

    // 2. Display main dashboard application view
    if (DOM.appDashboard) DOM.appDashboard.classList.remove('hidden');

    // 3. Reveal authenticated user controls in dashboard header
    if (DOM.authGuestView) DOM.authGuestView.classList.add('hidden');
    if (DOM.authUserView) DOM.authUserView.classList.remove('hidden');

    const username = state.currentUser.username || 'user';
    if (DOM.userHandle) DOM.userHandle.textContent = `@${username}`;
    if (DOM.userAvatarText) DOM.userAvatarText.textContent = username.charAt(0).toUpperCase();

    // 4. Role Authorization: Show "Admin Portal" button if role is admin or username is admin
    const isAdmin = Boolean(state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.username === 'admin'));
    if (DOM.adminPortalBtn) {
      if (isAdmin) {
        DOM.adminPortalBtn.classList.remove('hidden');
      } else {
        DOM.adminPortalBtn.classList.add('hidden');
      }
    }

    // Enable task creation form inputs
    if (DOM.taskTitleInput) {
      DOM.taskTitleInput.disabled = false;
      DOM.taskTitleInput.placeholder = 'What needs to be accomplished?';
    }
    if (DOM.addTaskBtn) DOM.addTaskBtn.disabled = false;

    // Hide guest state placeholder
    if (DOM.guestState) DOM.guestState.classList.add('hidden');
  } else {
    // 1. COMPLETELY hide the main application dashboard (ZERO elements beneath auth portal)
    if (DOM.appDashboard) DOM.appDashboard.classList.add('hidden');

    // 2. Display dedicated fullscreen auth container centered on viewport
    if (DOM.authFullscreenView) DOM.authFullscreenView.classList.remove('hidden');

    // 3. Hide authenticated controls
    if (DOM.authGuestView) DOM.authGuestView.classList.remove('hidden');
    if (DOM.authUserView) DOM.authUserView.classList.add('hidden');
    if (DOM.adminPortalBtn) DOM.adminPortalBtn.classList.add('hidden');

    // Clean up task list memory
    if (DOM.taskList) DOM.taskList.innerHTML = '';
    if (DOM.emptyState) DOM.emptyState.classList.add('hidden');
  }
}

/**
 * Switches the active tab in the fullscreen authentication view ('signin' | 'register').
 * @param {'signin'|'register'} tab - Target tab
 */
function switchFullscreenAuthTab(tab) {
  clearFullscreenAuthError();

  if (tab === 'signin') {
    if (DOM.tabSignInFsBtn) {
      DOM.tabSignInFsBtn.classList.add('active');
      DOM.tabSignInFsBtn.setAttribute('aria-selected', 'true');
    }
    if (DOM.tabRegisterFsBtn) {
      DOM.tabRegisterFsBtn.classList.remove('active');
      DOM.tabRegisterFsBtn.setAttribute('aria-selected', 'false');
    }
    if (DOM.signInFsPanel) DOM.signInFsPanel.classList.remove('hidden');
    if (DOM.registerFsPanel) DOM.registerFsPanel.classList.add('hidden');
    if (DOM.loginFsUsername) setTimeout(() => DOM.loginFsUsername.focus(), 60);
  } else {
    if (DOM.tabRegisterFsBtn) {
      DOM.tabRegisterFsBtn.classList.add('active');
      DOM.tabRegisterFsBtn.setAttribute('aria-selected', 'true');
    }
    if (DOM.tabSignInFsBtn) {
      DOM.tabSignInFsBtn.classList.remove('active');
      DOM.tabSignInFsBtn.setAttribute('aria-selected', 'false');
    }
    if (DOM.registerFsPanel) DOM.registerFsPanel.classList.remove('hidden');
    if (DOM.signInFsPanel) DOM.signInFsPanel.classList.add('hidden');
    if (DOM.registerFsUsername) setTimeout(() => DOM.registerFsUsername.focus(), 60);
  }
}

/**
 * Displays error message in fullscreen auth alert container.
 * @param {string} message - Error explanation
 */
function showFullscreenAuthError(message) {
  if (DOM.authFsErrorAlert && DOM.authFsErrorText) {
    DOM.authFsErrorText.textContent = message;
    DOM.authFsErrorAlert.classList.remove('hidden');
  }
}

/**
 * Clears fullscreen error banner.
 */
function clearFullscreenAuthError() {
  if (DOM.authFsErrorAlert && DOM.authFsErrorText) {
    DOM.authFsErrorText.textContent = '';
    DOM.authFsErrorAlert.classList.add('hidden');
  }
}

/**
 * Handles submission of fullscreen Sign In form.
 * @param {Event} e - Form submit event
 */
async function handleFullscreenLogin(e) {
  e.preventDefault();
  clearFullscreenAuthError();

  const username = DOM.loginFsUsername ? DOM.loginFsUsername.value.trim() : '';
  const password = DOM.loginFsPassword ? DOM.loginFsPassword.value : '';

  if (!username || !password) {
    showFullscreenAuthError('Username and password are required.');
    return;
  }

  try {
    if (DOM.submitLoginFsBtn) {
      DOM.submitLoginFsBtn.disabled = true;
      DOM.submitLoginFsBtn.innerHTML = `<span>Signing In...</span>`;
    }

    const response = await axios.post(`${API}/auth/login`, {
      username,
      password
    });

    const { token, user } = response.data;
    if (!token || !user) {
      throw new Error('Invalid response structure received from authentication server.');
    }

    localStorage.setItem('tm_token', token);
    localStorage.setItem('tm_user', JSON.stringify(user));
    state.currentUser = user;

    showToast(`Welcome back, ${user.username}!`, 'success');
    updateAuthUI();
    await loadTasks();
  } catch (error) {
    console.error('[Auth] Login error:', error);
    const msg = error.response?.data?.message || error.message || 'Invalid username or password.';
    showFullscreenAuthError(msg);
  } finally {
    if (DOM.submitLoginFsBtn) {
      DOM.submitLoginFsBtn.disabled = false;
      DOM.submitLoginFsBtn.innerHTML = `<span>Sign In</span>`;
    }
  }
}

/**
 * Handles submission of fullscreen Register form.
 * @param {Event} e - Form submit event
 */
async function handleFullscreenRegister(e) {
  e.preventDefault();
  clearFullscreenAuthError();

  const username = DOM.registerFsUsername ? DOM.registerFsUsername.value.trim() : '';
  const email = DOM.registerFsEmail ? DOM.registerFsEmail.value.trim() : '';
  const password = DOM.registerFsPassword ? DOM.registerFsPassword.value : '';
  const confirmPassword = DOM.registerFsConfirmPassword ? DOM.registerFsConfirmPassword.value : '';

  if (!username || username.length < 2) {
    showFullscreenAuthError('Username must be at least 2 characters.');
    if (DOM.registerFsUsername) DOM.registerFsUsername.focus();
    return;
  }

  if (!password || password.length < 6) {
    showFullscreenAuthError('Password must be at least 6 characters.');
    if (DOM.registerFsPassword) DOM.registerFsPassword.focus();
    return;
  }

  if (password !== confirmPassword) {
    showFullscreenAuthError('Passwords do not match. Please verify.');
    if (DOM.registerFsConfirmPassword) DOM.registerFsConfirmPassword.focus();
    return;
  }

  try {
    if (DOM.submitRegisterFsBtn) {
      DOM.submitRegisterFsBtn.disabled = true;
      DOM.submitRegisterFsBtn.innerHTML = `<span>Creating Account...</span>`;
    }

    const payload = { username, password };
    if (email) payload.email = email;

    const response = await axios.post(`${API}/auth/register`, payload);
    const { token, user } = response.data;

    if (!token || !user) {
      throw new Error('Invalid response structure received from registration server.');
    }

    localStorage.setItem('tm_token', token);
    localStorage.setItem('tm_user', JSON.stringify(user));
    state.currentUser = user;

    showToast(`Account created! Welcome, ${user.username}!`, 'success');
    updateAuthUI();
    await loadTasks();
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    const msg = error.response?.data?.message || error.message || 'Registration failed.';
    showFullscreenAuthError(msg);
  } finally {
    if (DOM.submitRegisterFsBtn) {
      DOM.submitRegisterFsBtn.disabled = false;
      DOM.submitRegisterFsBtn.innerHTML = `<span>Create Account</span>`;
    }
  }
}

/**
 * Handles user login submission (POST /auth/login).
 * @param {Event} e - Form submit event
 */
async function handleLogin(e) {
  e.preventDefault();
  clearAuthError();

  const username = DOM.loginUsername.value.trim();
  const password = DOM.loginPassword.value;

  if (!username || !password) {
    showAuthError('Username and password are required.');
    return;
  }

  try {
    DOM.submitLoginBtn.disabled = true;
    DOM.submitLoginBtn.innerHTML = `<span>Signing In...</span>`;

    const response = await axios.post(`${API}/auth/login`, {
      username,
      password
    });

    const { token, user } = response.data;
    if (!token || !user) {
      throw new Error('Invalid response structure received from authentication server.');
    }

    localStorage.setItem('tm_token', token);
    localStorage.setItem('tm_user', JSON.stringify(user));
    state.currentUser = user;

    showToast(`Welcome back, ${user.username}!`, 'success');
    closeAuthModal();
    updateAuthUI();
    await loadTasks();
  } catch (error) {
    console.error('[Auth] Login error:', error);
    const msg = error.response?.data?.message || error.message || 'Invalid username or password.';
    showAuthError(msg);
  } finally {
    DOM.submitLoginBtn.disabled = false;
    DOM.submitLoginBtn.innerHTML = `<span>Sign In</span>`;
  }
}

/**
 * Handles user registration submission (POST /auth/register).
 * @param {Event} e - Form submit event
 */
async function handleRegister(e) {
  e.preventDefault();
  clearAuthError();

  const username = DOM.registerUsername.value.trim();
  const email = DOM.registerEmail.value.trim();
  const password = DOM.registerPassword.value;
  const confirmPassword = DOM.registerConfirmPassword.value;

  // Validation guards
  if (!username || username.length < 2) {
    showAuthError('Username must be at least 2 characters.');
    DOM.registerUsername.focus();
    return;
  }

  if (!password || password.length < 6) {
    showAuthError('Password must be at least 6 characters.');
    DOM.registerPassword.focus();
    return;
  }

  if (password !== confirmPassword) {
    showAuthError('Passwords do not match. Please verify.');
    DOM.registerConfirmPassword.focus();
    return;
  }

  try {
    DOM.submitRegisterBtn.disabled = true;
    DOM.submitRegisterBtn.innerHTML = `<span>Creating Account...</span>`;

    const payload = {
      username,
      password
    };
    if (email) payload.email = email;

    const response = await axios.post(`${API}/auth/register`, payload);
    const { token, user } = response.data;

    if (!token || !user) {
      throw new Error('Invalid response structure received from registration server.');
    }

    localStorage.setItem('tm_token', token);
    localStorage.setItem('tm_user', JSON.stringify(user));
    state.currentUser = user;

    showToast(`Account created! Welcome, ${user.username}!`, 'success');
    closeAuthModal();
    updateAuthUI();
    await loadTasks();
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    const msg = error.response?.data?.message || error.message || 'Registration failed. Try another username.';
    showAuthError(msg);
  } finally {
    DOM.submitRegisterBtn.disabled = false;
    DOM.submitRegisterBtn.innerHTML = `<span>Create Account</span>`;
  }
}

/**
 * Signs out the active user, clears stored credentials, and resets views.
 */
function signOut() {
  localStorage.removeItem('tm_token');
  localStorage.removeItem('tm_user');
  state.currentUser = null;
  state.tasksCache = [];
  updateAuthUI();
  showToast('Signed out successfully', 'info');
}

/**
 * Switches the active tab in the authentication modal ('signin' | 'register').
 * @param {'signin'|'register'} tab - Target tab
 */
function switchAuthTab(tab) {
  clearAuthError();

  if (tab === 'signin') {
    DOM.tabSignInBtn.classList.add('active');
    DOM.tabSignInBtn.setAttribute('aria-selected', 'true');
    DOM.tabRegisterBtn.classList.remove('active');
    DOM.tabRegisterBtn.setAttribute('aria-selected', 'false');

    DOM.signInFormPanel.classList.remove('hidden');
    DOM.registerFormPanel.classList.add('hidden');
    DOM.authModalTitle.textContent = 'Sign In to TaskMaster';
    setTimeout(() => DOM.loginUsername.focus(), 60);
  } else {
    DOM.tabRegisterBtn.classList.add('active');
    DOM.tabRegisterBtn.setAttribute('aria-selected', 'true');
    DOM.tabSignInBtn.classList.remove('active');
    DOM.tabSignInBtn.setAttribute('aria-selected', 'false');

    DOM.registerFormPanel.classList.remove('hidden');
    DOM.signInFormPanel.classList.add('hidden');
    DOM.authModalTitle.textContent = 'Create TaskMaster Account';
    setTimeout(() => DOM.registerUsername.focus(), 60);
  }
}

/**
 * Opens the authentication modal dialog.
 * @param {'signin'|'register'} initialTab - Tab to display upon opening
 */
function openAuthModal(initialTab = 'signin') {
  clearAuthError();
  DOM.signInForm.reset();
  DOM.registerForm.reset();
  DOM.authModal.classList.remove('hidden');
  switchAuthTab(initialTab);
}

/**
 * Closes the authentication modal dialog and clears errors.
 */
function closeAuthModal() {
  DOM.authModal.classList.add('hidden');
  clearAuthError();
  DOM.signInForm.reset();
  DOM.registerForm.reset();
}

/**
 * Displays error message within the authentication modal.
 * @param {string} msg - Error message text
 */
function showAuthError(msg) {
  if (DOM.authErrorAlert && DOM.authErrorText) {
    DOM.authErrorText.textContent = msg;
    DOM.authErrorAlert.classList.remove('hidden');
  }
}

/**
 * Clears error notification inside the authentication modal.
 */
function clearAuthError() {
  if (DOM.authErrorAlert && DOM.authErrorText) {
    DOM.authErrorText.textContent = '';
    DOM.authErrorAlert.classList.add('hidden');
  }
}

// ==============================================================================
// 7. Task Management Services (CRUD & Assignments 1-3)
// ==============================================================================

/**
 * Fetches tasks from backend (GET /tasks) for current authenticated user.
 * Supports query parameters:
 * - category: Filter by taxonomy ('Work', 'Personal', 'Urgent')
 * - completed: Filter by status ('true' / 'false')
 * - sort: Chronological order ('desc' / 'asc')
 */
async function loadTasks() {
  if (!state.currentUser) {
    updateAuthUI();
    return;
  }

  state.isLoading = true;
  DOM.statusCounter.textContent = 'Refreshing tasks...';

  try {
    const params = {};
    if (state.filterCategory !== 'all') {
      params.category = state.filterCategory;
    }
    if (state.filterStatus === 'active') {
      params.completed = 'false';
    } else if (state.filterStatus === 'completed') {
      params.completed = 'true';
    }
    if (state.sortOrder) {
      params.sort = state.sortOrder;
    }

    const response = await axios.get(`${API}/tasks`, { params });
    state.tasksCache = Array.isArray(response.data) ? response.data : [];

    renderTasks(state.tasksCache);
    updateStatusBar();
  } catch (error) {
    console.error('[API] Failed to fetch tasks:', error);
    const errorMsg = error.response?.data?.message || 'Could not load tasks from server';
    showToast(errorMsg, 'error');
    DOM.statusCounter.textContent = 'Failed to load tasks';
  } finally {
    state.isLoading = false;
  }
}

/**
 * Creates a new task entity via POST /tasks.
 * Supports Assignment 2 (category taxonomy).
 */
async function addTask() {
  if (!state.currentUser) {
    openAuthModal('signin');
    return;
  }

  const title = DOM.taskTitleInput.value.trim();
  const category = DOM.taskCategorySelect.value;

  if (!title) {
    showToast('Please enter a task title', 'error');
    DOM.taskTitleInput.focus();
    return;
  }

  try {
    DOM.addTaskBtn.disabled = true;
    DOM.addTaskBtn.innerHTML = `<span>Adding...</span>`;

    const payload = {
      title,
      category
    };

    await axios.post(`${API}/tasks`, payload);
    showToast('Task added successfully!', 'success');

    // Reset input fields
    DOM.taskTitleInput.value = '';
    DOM.taskTitleInput.focus();

    // Reload tasks dataset
    await loadTasks();
  } catch (error) {
    console.error('[API] Error creating task:', error);
    const errorMsg = error.response?.data?.message || 'Failed to create task';
    showToast(errorMsg, 'error');
  } finally {
    DOM.addTaskBtn.disabled = false;
    DOM.addTaskBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      <span>Add Task</span>
    `;
  }
}

/**
 * Toggles a task's completion status via PUT /tasks/:id.
 * @param {string} id - Task ObjectId
 * @param {boolean} currentStatus - Existing completed state
 */
async function toggleTask(id, currentStatus) {
  try {
    const newStatus = !currentStatus;
    await axios.put(`${API}/tasks/${id}`, { completed: newStatus });
    showToast(newStatus ? 'Task completed!' : 'Task reopened', 'info');
    await loadTasks();
  } catch (error) {
    console.error('[API] Error toggling task status:', error);
    const errorMsg = error.response?.data?.message || 'Failed to update task status';
    showToast(errorMsg, 'error');
  }
}

/**
 * Permanently deletes a task via DELETE /tasks/:id.
 * @param {string} id - Task ObjectId
 */
async function deleteTask(id) {
  const confirmed = window.confirm('Are you sure you want to permanently delete this task?');
  if (!confirmed) return;

  try {
    await axios.delete(`${API}/tasks/${id}`);
    showToast('Task deleted', 'info');
    await loadTasks();
  } catch (error) {
    console.error('[API] Error deleting task:', error);
    const errorMsg = error.response?.data?.message || 'Failed to delete task';
    showToast(errorMsg, 'error');
  }
}

/**
 * Assignment 1: Opens the edit modal with current task values.
 * @param {string} id - Task ObjectId
 */
function openEditModal(id) {
  const task = state.tasksCache.find((t) => (t._id || t.id) === id);
  if (!task) return;

  state.editingTaskId = id;
  DOM.editTaskId.value = id;
  DOM.editTaskTitle.value = task.title;
  DOM.editTaskCategory.value = task.category || 'Personal';
  DOM.editTaskCompleted.checked = Boolean(task.completed);

  DOM.editModal.classList.remove('hidden');
  DOM.editTaskTitle.focus();
}

/**
 * Closes the Edit Task modal.
 */
function closeEditModal() {
  DOM.editModal.classList.add('hidden');
  state.editingTaskId = null;
  DOM.editTaskForm.reset();
}

/**
 * Submits the updated task title and fields via PUT /tasks/:id.
 * Fulfills Assignment 1.
 * @param {Event} e - Form submit event
 */
async function handleSaveEdit(e) {
  e.preventDefault();
  const id = DOM.editTaskId.value;
  const newTitle = DOM.editTaskTitle.value.trim();
  const newCategory = DOM.editTaskCategory.value;
  const newCompleted = DOM.editTaskCompleted.checked;

  if (!newTitle) {
    showToast('Task title cannot be empty', 'error');
    DOM.editTaskTitle.focus();
    return;
  }

  try {
    const payload = {
      title: newTitle,
      category: newCategory,
      completed: newCompleted
    };

    await axios.put(`${API}/tasks/${id}`, payload);
    showToast('Task updated successfully!', 'success');
    closeEditModal();
    await loadTasks();
  } catch (error) {
    console.error('[API] Error updating task:', error);
    const errorMsg = error.response?.data?.message || 'Failed to update task';
    showToast(errorMsg, 'error');
  }
}

// ==============================================================================
// 8. DOM Rendering & Status Bar
// ==============================================================================

/**
 * Renders the tasks list items and manages the empty state display.
 * @param {Array<Object>} tasks - List of task documents
 */
function renderTasks(tasks) {
  DOM.taskList.innerHTML = '';

  if (!tasks || tasks.length === 0) {
    DOM.emptyState.classList.remove('hidden');
    return;
  }

  DOM.emptyState.classList.add('hidden');

  tasks.forEach((task) => {
    const taskId = task._id || task.id;
    const isCompleted = Boolean(task.completed);
    const category = task.category || 'Personal';
    const categoryClass = `category-${category.toLowerCase()}`;
    const formattedDate = formatDate(task.createdAt);

    // Optional user badge if populated by backend
    let userBadgeHtml = '';
    if (task.userId && typeof task.userId === 'object' && task.userId.username) {
      userBadgeHtml = `
        <span class="badge-user" title="Task Owner">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>${escapeHtml(task.userId.username)}</span>
        </span>
      `;
    }

    const li = document.createElement('li');
    li.className = `task-item ${isCompleted ? 'completed' : ''}`;
    li.setAttribute('data-id', taskId);

    li.innerHTML = `
      <div class="task-left-section">
        <input 
          type="checkbox" 
          class="task-checkbox" 
          ${isCompleted ? 'checked' : ''} 
          aria-label="Toggle completion for ${escapeHtml(task.title)}"
        >
        <div class="task-content">
          <span class="task-title">${escapeHtml(task.title)}</span>
          <div class="task-meta">
            <!-- Assignment 2: Category Badge -->
            <span class="badge-category ${categoryClass}">${escapeHtml(category)}</span>
            <!-- User Badge (if available) -->
            ${userBadgeHtml}
            <!-- Timestamp -->
            <span class="task-date">${escapeHtml(formattedDate)}</span>
          </div>
        </div>
      </div>
      <div class="task-actions">
        <!-- Assignment 1: Edit Task Action -->
        <button type="button" class="action-btn edit-btn" title="Edit Task Title & Properties" aria-label="Edit Task ${escapeHtml(task.title)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <!-- Core: Delete Task Action -->
        <button type="button" class="action-btn delete-btn" title="Delete Task" aria-label="Delete Task ${escapeHtml(task.title)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      </div>
    `;

    // Bind row event handlers
    const checkbox = li.querySelector('.task-checkbox');
    checkbox.addEventListener('change', () => toggleTask(taskId, isCompleted));

    const editBtn = li.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => openEditModal(taskId));

    const deleteBtn = li.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => deleteTask(taskId));

    DOM.taskList.appendChild(li);
  });
}

/**
 * Calculates task statistics and updates the status bar and progress meter.
 */
function updateStatusBar() {
  if (!state.currentUser) {
    DOM.statusCounter.textContent = 'Please sign in to view and manage your private tasks.';
    DOM.progressBar.style.width = '0%';
    DOM.activeFilterBadge.classList.add('hidden');
    return;
  }

  const total = state.tasksCache.length;
  const completedCount = state.tasksCache.filter((t) => t.completed).length;

  // Update progress percentage
  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  DOM.progressBar.style.width = `${percentage}%`;

  // Update descriptive counter
  DOM.statusCounter.textContent = `${completedCount} of ${total} tasks completed (${percentage}%)`;

  // Update Filtered Pill indicator if active filters are applied
  const hasActiveFilters = 
    state.filterCategory !== 'all' || 
    state.filterStatus !== 'all';

  if (hasActiveFilters) {
    DOM.activeFilterBadge.classList.remove('hidden');
    DOM.activeFilterBadge.textContent = 'Filtered View';
  } else {
    DOM.activeFilterBadge.classList.add('hidden');
  }
}

// ==============================================================================
// 9. Event Listeners & Interactive Handlers
// ==============================================================================

/**
 * Initializes all event listeners across form controls, toolbar, and modals.
 */
function initEventListeners() {
  // 1. Task Creation Form Submission
  DOM.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addTask();
  });

  // Prompt sign in if guest clicks on task form
  DOM.taskForm.addEventListener('click', () => {
    if (!state.currentUser) {
      if (DOM.authFullscreenView) {
        switchFullscreenAuthTab('signin');
      } else {
        openAuthModal('signin');
      }
    }
  });

  // 2. Header Authentication Controls
  if (DOM.openAuthModalBtn) {
    DOM.openAuthModalBtn.addEventListener('click', () => {
      if (DOM.authFullscreenView) switchFullscreenAuthTab('signin');
      else openAuthModal('signin');
    });
  }
  if (DOM.signOutBtn) DOM.signOutBtn.addEventListener('click', signOut);

  // Fullscreen Authentication Controls
  if (DOM.tabSignInFsBtn) DOM.tabSignInFsBtn.addEventListener('click', () => switchFullscreenAuthTab('signin'));
  if (DOM.tabRegisterFsBtn) DOM.tabRegisterFsBtn.addEventListener('click', () => switchFullscreenAuthTab('register'));
  if (DOM.signInFsForm) DOM.signInFsForm.addEventListener('submit', handleFullscreenLogin);
  if (DOM.registerFsForm) DOM.registerFsForm.addEventListener('submit', handleFullscreenRegister);

  // Quick Demo Credential Pills
  if (DOM.demoUserPill) {
    DOM.demoUserPill.addEventListener('click', () => {
      switchFullscreenAuthTab('signin');
      if (DOM.loginFsUsername) DOM.loginFsUsername.value = 'alex_dev';
      if (DOM.loginFsPassword) {
        DOM.loginFsPassword.value = 'Password123!';
        DOM.loginFsPassword.focus();
      }
    });
  }

  if (DOM.demoAdminPill) {
    DOM.demoAdminPill.addEventListener('click', () => {
      switchFullscreenAuthTab('signin');
      if (DOM.loginFsUsername) DOM.loginFsUsername.value = 'admin';
      if (DOM.loginFsPassword) {
        DOM.loginFsPassword.value = 'AdminPass123!';
        DOM.loginFsPassword.focus();
      }
    });
  }

  // 3. Guest State Sign In Button
  if (DOM.guestSignInBtn) {
    DOM.guestSignInBtn.addEventListener('click', () => {
      if (DOM.authFullscreenView) switchFullscreenAuthTab('signin');
      else openAuthModal('signin');
    });
  }

  // 4. Auth Modal Controls
  if (DOM.closeAuthModalBtn) DOM.closeAuthModalBtn.addEventListener('click', closeAuthModal);
  if (DOM.authModal) {
    DOM.authModal.addEventListener('click', (e) => {
      if (e.target === DOM.authModal) closeAuthModal();
    });
  }

  // Tab switching in Auth Modal
  if (DOM.tabSignInBtn) DOM.tabSignInBtn.addEventListener('click', () => switchAuthTab('signin'));
  if (DOM.tabRegisterBtn) DOM.tabRegisterBtn.addEventListener('click', () => switchAuthTab('register'));

  // Auth Form Submissions
  if (DOM.signInForm) DOM.signInForm.addEventListener('submit', handleLogin);
  if (DOM.registerForm) DOM.registerForm.addEventListener('submit', handleRegister);

  // 5. Status Filter Tabs (All / Active / Completed)
  DOM.filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      DOM.filterTabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      state.filterStatus = tab.getAttribute('data-status');
      loadTasks();
    });
  });

  // 6. Category Filter Dropdown (Assignment 2)
  DOM.categoryFilter.addEventListener('change', (e) => {
    state.filterCategory = e.target.value;
    loadTasks();
  });

  // 7. Chronological Sort Toggle (Assignment 3)
  DOM.sortToggleBtn.addEventListener('click', () => {
    if (state.sortOrder === 'desc') {
      state.sortOrder = 'asc';
      DOM.sortToggleBtn.setAttribute('data-sort', 'asc');
      DOM.sortLabel.textContent = 'Oldest First';
      DOM.sortDescIcon.classList.add('hidden');
      DOM.sortAscIcon.classList.remove('hidden');
    } else {
      state.sortOrder = 'desc';
      DOM.sortToggleBtn.setAttribute('data-sort', 'desc');
      DOM.sortLabel.textContent = 'Newest First';
      DOM.sortDescIcon.classList.remove('hidden');
      DOM.sortAscIcon.classList.add('hidden');
    }
    loadTasks();
  });

  // 8. Edit Modal Controls (Assignment 1)
  DOM.closeEditModalBtn.addEventListener('click', closeEditModal);
  DOM.cancelEditBtn.addEventListener('click', closeEditModal);
  DOM.editModal.addEventListener('click', (e) => {
    if (e.target === DOM.editModal) closeEditModal();
  });
  DOM.editTaskForm.addEventListener('submit', handleSaveEdit);

  // 9. Global Keyboard Shortcuts (Escape to dismiss modals)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!DOM.editModal.classList.contains('hidden')) {
        closeEditModal();
      }
      if (!DOM.authModal.classList.contains('hidden')) {
        closeAuthModal();
      }
    }
  });
}

// ==============================================================================
// 10. Application Inception Bootstrapper
// ==============================================================================

/**
 * Boots the application on DOMContentLoaded.
 */
document.addEventListener('DOMContentLoaded', async () => {
  initEventListeners();

  // If redirected with ?auth=admin query, select signin tab and pre-fill admin username
  if (window.location.search.includes('auth=admin')) {
    switchFullscreenAuthTab('signin');
    if (DOM.loginFsUsername) DOM.loginFsUsername.value = 'admin';
    if (DOM.loginFsPassword) {
      DOM.loginFsPassword.value = 'AdminPass123!';
      DOM.loginFsPassword.focus();
    }
  }

  // 1. Verify active token or show fullscreen auth state
  const isAuthenticated = await checkAuthSession();
  // 2. If authenticated, fetch and render user's tasks
  if (isAuthenticated) {
    await loadTasks();
  }
});
