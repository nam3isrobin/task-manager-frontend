/**
 * ==============================================================================
 * TaskMaster Pro - Frontend Application Logic (`public/script.js`)
 * ==============================================================================
 * Production-ready JavaScript client utilizing Axios for RESTful API orchestration.
 *
 * Core Features & Assignments Supported:
 * - Core: CRUD actions for Tasks (create, read, toggle status, delete).
 * - Assignment 1: Edit task title (via interactive modal and PUT /tasks/:id).
 * - Assignment 2: Category taxonomy ('Work', 'Personal', 'Urgent') with visual badges
 *   and real-time category filtering.
 * - Assignment 3: Chronological sorting (Newest first / Oldest first toggle) via API
 *   query parameters and client-side synchronization.
 * - Assignment 4: Multiple users (user switcher dropdown in header + user creation modal
 *   invoking POST /users and relational filtering via GET /tasks?userId=...).
 *
 * Invariants & Best Practices:
 * - Configurable API endpoint supporting local Express development and remote deployment.
 * - Robust input sanitization preventing Cross-Site Scripting (XSS).
 * - Keyboard shortcuts (Enter to submit, Escape to close modals).
 * - Accessible state management and instant visual toast notifications.
 * ==============================================================================
 */

// ==============================================================================
// 1. API Configuration & Environment Detection
// ==============================================================================

/**
 * Dynamically resolves the API base URL.
 * Automatically targets port 3000 if served via a local web server or file host,
 * while respecting origin host in production deployments.
 */
const API = (window.location.origin && window.location.origin.startsWith('http'))
  ? window.location.origin
  : 'http://localhost:3001';

// ==============================================================================
// 2. Application State Management
// ==============================================================================

const state = {
  // Active user filter ID ('': all users, or specific MongoDB ObjectId)
  currentUserId: '',
  // Task completion filter: 'all' | 'active' | 'completed'
  filterStatus: 'all',
  // Category filter: 'all' | 'Work' | 'Personal' | 'Urgent'
  filterCategory: 'all',
  // Sort order: 'desc' (Newest first) | 'asc' (Oldest first)
  sortOrder: 'desc',
  // In-memory cache of retrieved tasks
  tasksCache: [],
  // In-memory cache of registered users
  usersCache: [],
  // Task currently undergoing edit in modal
  editingTaskId: null,
  // Network activity flag
  isLoading: false
};

// ==============================================================================
// 3. DOM Elements Cache
// ==============================================================================

const DOM = {
  // User Management
  userSelect: document.getElementById('userSelect'),
  openUserModalBtn: document.getElementById('openUserModalBtn'),
  userModal: document.getElementById('userModal'),
  closeUserModalBtn: document.getElementById('closeUserModalBtn'),
  cancelUserBtn: document.getElementById('cancelUserBtn'),
  createUserForm: document.getElementById('createUserForm'),
  newUsername: document.getElementById('newUsername'),
  newUserEmail: document.getElementById('newUserEmail'),

  // Task Creation
  taskForm: document.getElementById('taskForm'),
  taskTitleInput: document.getElementById('taskTitleInput'),
  taskCategorySelect: document.getElementById('taskCategorySelect'),
  taskUserSelect: document.getElementById('taskUserSelect'),
  addTaskBtn: document.getElementById('addTaskBtn'),

  // Filtering & Sorting
  filterTabs: document.querySelectorAll('.tab-btn'),
  categoryFilter: document.getElementById('categoryFilter'),
  sortToggleBtn: document.getElementById('sortToggleBtn'),
  sortDescIcon: document.getElementById('sortDescIcon'),
  sortAscIcon: document.getElementById('sortAscIcon'),
  sortLabel: document.getElementById('sortLabel'),

  // Status Summary
  statusCounter: document.getElementById('statusCounter'),
  activeFilterBadge: document.getElementById('activeFilterBadge'),
  progressBar: document.getElementById('progressBar'),

  // Task List & Empty State
  taskList: document.getElementById('taskList'),
  emptyState: document.getElementById('emptyState'),

  // Edit Task Modal
  editModal: document.getElementById('editModal'),
  closeEditModalBtn: document.getElementById('closeEditModalBtn'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  editTaskForm: document.getElementById('editTaskForm'),
  editTaskId: document.getElementById('editTaskId'),
  editTaskTitle: document.getElementById('editTaskTitle'),
  editTaskCategory: document.getElementById('editTaskCategory'),
  editTaskUser: document.getElementById('editTaskUser'),
  editTaskCompleted: document.getElementById('editTaskCompleted'),

  // Toasts
  toastContainer: document.getElementById('toastContainer')
};

// ==============================================================================
// 4. Utility Functions
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
 * @returns {string} Formatted date (e.g. "Oct 3, 2026, 3:30 AM")
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
// 5. User Management Services (Assignment 4)
// ==============================================================================

/**
 * Fetches all registered users from the backend (GET /users).
 * Populates all user select dropdowns across the application.
 */
async function loadUsers() {
  try {
    const response = await axios.get(`${API}/users`);
    state.usersCache = Array.isArray(response.data) ? response.data : [];
    populateUserDropdowns();
  } catch (error) {
    console.error('[API] Failed to fetch users:', error);
    // Don't interrupt flow if users endpoint is unavailable, but notify
    showToast('Could not load user profiles from server', 'error');
  }
}

/**
 * Synchronizes users cache into HTML `<select>` elements.
 */
function populateUserDropdowns() {
  // 1. Header Active User Filter Dropdown
  const currentSelected = state.currentUserId;
  DOM.userSelect.innerHTML = `<option value="">All Users (Global)</option>`;

  // 2. Task Creation Form Assignee Dropdown
  DOM.taskUserSelect.innerHTML = `<option value="">Unassigned (None)</option>`;

  // 3. Task Edit Modal Assignee Dropdown
  DOM.editTaskUser.innerHTML = `<option value="">Unassigned (None)</option>`;

  state.usersCache.forEach((user) => {
    const userId = user._id || user.id;
    const displayName = user.username + (user.email ? ` (${user.email})` : '');

    // Option for User Switcher
    const optFilter = document.createElement('option');
    optFilter.value = userId;
    optFilter.textContent = displayName;
    DOM.userSelect.appendChild(optFilter);

    // Option for Task Creation
    const optCreate = document.createElement('option');
    optCreate.value = userId;
    optCreate.textContent = displayName;
    DOM.taskUserSelect.appendChild(optCreate);

    // Option for Task Edit
    const optEdit = document.createElement('option');
    optEdit.value = userId;
    optEdit.textContent = displayName;
    DOM.editTaskUser.appendChild(optEdit);
  });

  // Preserve previously selected user if still exists
  DOM.userSelect.value = currentSelected;
  if (currentSelected) {
    DOM.taskUserSelect.value = currentSelected;
  }
}

/**
 * Registers a new user profile via POST /users.
 * @param {string} username - User handle (required)
 * @param {string} email - User email (optional)
 */
async function createUser(username, email) {
  try {
    const payload = {
      username: username.trim(),
      email: email ? email.trim() : undefined
    };

    const response = await axios.post(`${API}/users`, payload);
    const createdUser = response.data;
    const createdId = createdUser._id || createdUser.id;

    showToast(`User profile "${createdUser.username}" created!`, 'success');

    // Close user creation modal and reset form
    closeUserModal();
    DOM.createUserForm.reset();

    // Reload users and auto-select newly created user
    await loadUsers();
    state.currentUserId = createdId;
    DOM.userSelect.value = createdId;
    DOM.taskUserSelect.value = createdId;

    // Reload tasks filtered for this new user
    await loadTasks();
  } catch (error) {
    console.error('[API] Error creating user:', error);
    const errorMsg = error.response?.data?.message || 'Failed to create user profile';
    showToast(errorMsg, 'error');
  }
}

// ==============================================================================
// 6. Task Management Services (CRUD & Assignments 1-3)
// ==============================================================================

/**
 * Fetches tasks from backend (GET /tasks) with query parameters:
 * - userId: Filter by assigned user
 * - category: Filter by category (Work, Personal, Urgent)
 * - completed: Filter by completion state
 * - sort: Sort by createdAt (desc/asc)
 */
async function loadTasks() {
  state.isLoading = true;
  DOM.statusCounter.textContent = 'Refreshing tasks...';

  try {
    // Construct query parameters matching backend route expectations
    const params = {};
    if (state.currentUserId) {
      params.userId = state.currentUserId;
    }
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

    // Render list and update progress indicators
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
 * Supports Assignments 2 (category) and 4 (userId).
 */
async function addTask() {
  const title = DOM.taskTitleInput.value.trim();
  const category = DOM.taskCategorySelect.value;
  const assignedUserId = DOM.taskUserSelect.value || undefined;

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
      category,
      userId: assignedUserId
    };

    const response = await axios.post(`${API}/tasks`, payload);
    const newTask = response.data;

    showToast('Task added successfully!', 'success');

    // Reset input fields
    DOM.taskTitleInput.value = '';
    DOM.taskTitleInput.focus();

    // Refresh tasks list
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

  // Set assigned user if available
  const assignedId = task.userId?._id || task.userId || '';
  DOM.editTaskUser.value = assignedId;

  // Reveal modal overlay
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
 */
async function handleSaveEdit(e) {
  e.preventDefault();
  const id = DOM.editTaskId.value;
  const newTitle = DOM.editTaskTitle.value.trim();
  const newCategory = DOM.editTaskCategory.value;
  const newUserId = DOM.editTaskUser.value || null;
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
      userId: newUserId,
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
// 7. Modal Controls (User & Edit Modals)
// ==============================================================================

function openUserModal() {
  DOM.userModal.classList.remove('hidden');
  DOM.newUsername.focus();
}

function closeUserModal() {
  DOM.userModal.classList.add('hidden');
  DOM.createUserForm.reset();
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

    // Resolve assigned user username if populated
    let userBadgeHtml = '';
    if (task.userId) {
      const username = typeof task.userId === 'object' ? task.userId.username : 'Assigned';
      userBadgeHtml = `
        <span class="badge-user" title="Assigned User">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>${escapeHtml(username)}</span>
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
            <!-- Assignment 4: User Badge -->
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

    // Bind event listeners for this task row
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
  const total = state.tasksCache.length;
  const completedCount = state.tasksCache.filter((t) => t.completed).length;
  const activeCount = total - completedCount;

  // Update progress percentage
  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  DOM.progressBar.style.width = `${percentage}%`;

  // Update descriptive counter
  DOM.statusCounter.textContent = `${completedCount} of ${total} tasks completed (${percentage}%)`;

  // Update Filtered Pill indicator if active filters are applied
  const hasActiveFilters = 
    state.currentUserId !== '' || 
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

  // 2. User Switcher Dropdown (Assignment 4)
  DOM.userSelect.addEventListener('change', (e) => {
    state.currentUserId = e.target.value;
    // Keep task create form aligned with chosen user
    DOM.taskUserSelect.value = state.currentUserId;
    loadTasks();
  });

  // 3. User Modal Trigger & Form Submission (Assignment 4)
  DOM.openUserModalBtn.addEventListener('click', openUserModal);
  DOM.closeUserModalBtn.addEventListener('click', closeUserModal);
  DOM.cancelUserBtn.addEventListener('click', closeUserModal);
  DOM.userModal.addEventListener('click', (e) => {
    if (e.target === DOM.userModal) closeUserModal();
  });

  DOM.createUserForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = DOM.newUsername.value;
    const email = DOM.newUserEmail.value;
    createUser(username, email);
  });

  // 4. Status Filter Tabs (All / Active / Completed)
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

  // 5. Category Filter Dropdown (Assignment 2)
  DOM.categoryFilter.addEventListener('change', (e) => {
    state.filterCategory = e.target.value;
    loadTasks();
  });

  // 6. Chronological Sort Toggle (Assignment 3)
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

  // 7. Edit Modal Controls (Assignment 1)
  DOM.closeEditModalBtn.addEventListener('click', closeEditModal);
  DOM.cancelEditBtn.addEventListener('click', closeEditModal);
  DOM.editModal.addEventListener('click', (e) => {
    if (e.target === DOM.editModal) closeEditModal();
  });
  DOM.editTaskForm.addEventListener('submit', handleSaveEdit);

  // 8. Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // ESC key closes any open modal
    if (e.key === 'Escape') {
      if (!DOM.editModal.classList.contains('hidden')) {
        closeEditModal();
      }
      if (!DOM.userModal.classList.contains('hidden')) {
        closeUserModal();
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
  // 1. Fetch user accounts first to populate dropdowns
  await loadUsers();
  // 2. Fetch and render initial task dataset
  await loadTasks();
});
