(function () {
    if (window.__crmTaskCenterInitialized) return;
    window.__crmTaskCenterInitialized = true;

    const body = document.body;
    const stateUrl = body.dataset.taskStateUrl;
    const actionTemplate = body.dataset.taskActionTemplate;
    if (!stateUrl || !actionTemplate || typeof bootstrap === 'undefined') return;

    let currentState = null;
    let stateReceivedAt = Date.now();
    let refreshPromise = null;
    let expandedReminderId = null;
    const activeToasts = new Map();
    const dismissedReminderIds = new Set();
    const REMINDER_WINDOW_SECONDS = 3 * 60 * 60;
    const OVERDUE_REMINDER_WINDOW_SECONDS = 7 * 24 * 60 * 60;
    const REMINDER_STACK_PEEK_PX = 36;
    const REMINDER_STACK_MAX_PEEK = 4;

    function escapeHtml(value) {
        const node = document.createElement('div');
        node.textContent = value == null ? '' : String(value);
        return node.innerHTML;
    }

    function csrfToken() {
        const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    }

    function actionUrl(taskId) {
        return actionTemplate.replace('__TASK_ID__', encodeURIComponent(taskId));
    }

    function adjustedDelta(task) {
        return Number(task.delta_seconds || 0) - Math.floor((Date.now() - stateReceivedAt) / 1000);
    }

    function durationText(seconds) {
        const absolute = Math.max(0, Math.abs(Math.round(seconds)));
        const days = Math.floor(absolute / 86400);
        const hours = Math.floor((absolute % 86400) / 3600);
        const minutes = Math.floor((absolute % 3600) / 60);
        if (days) return `${days}d ${hours}h`;
        if (hours) return `${hours}h ${minutes}m`;
        return `${Math.max(1, minutes)}m`;
    }

    function relativeText(task) {
        const delta = adjustedDelta(task);
        return delta < 0 ? `${durationText(delta)} overdue` : `Due in ${durationText(delta)}`;
    }

    function priorityClass(priority) {
        return `priority-${String(priority || 'Medium').toLowerCase()}`;
    }

    function renderNotifications(state) {
        const overdueCount = Number(state.dashboard?.overdue_count || 0);
        const dueTodayCount = Number(state.dashboard?.due_today_count || 0);
        const completedTodayCount = Number(state.dashboard?.completed_today_count || 0);
        const count = document.getElementById('taskNotificationCount');
        if (count) {
            count.textContent = overdueCount + dueTodayCount;
            count.hidden = overdueCount + dueTodayCount === 0;
        }

        const list = document.getElementById('taskNotificationList');
        if (!list) return;
        list.innerHTML = `<div class="notification-summary-grid">
            <a class="notification-summary-card summary-overdue" href="/tasks/?due=overdue&status=pending">
                <span class="notification-summary-icon">&#128308;</span>
                <span><strong>${overdueCount}</strong><small>Overdue Tasks</small></span>
            </a>
            <a class="notification-summary-card summary-today" href="/tasks/?due=today&status=pending">
                <span class="notification-summary-icon">&#128993;</span>
                <span><strong>${dueTodayCount}</strong><small>Due Today</small></span>
            </a>
            <a class="notification-summary-card summary-completed" href="/tasks/?due=completed_today&status=completed">
                <span class="notification-summary-icon">&#128994;</span>
                <span><strong>${completedTodayCount}</strong><small>Completed Today</small></span>
            </a>
        </div>`;
    }

    function dismissTaskToast(taskId) {
        const toast = activeToasts.get(String(taskId));
        if (toast) bootstrap.Toast.getOrCreateInstance(toast).hide();
    }

    function sortReminderTasks(tasks) {
        return [...tasks].sort((first, second) => {
            const firstDelta = adjustedDelta(first);
            const secondDelta = adjustedDelta(second);
            const firstOverdue = firstDelta < 0;
            const secondOverdue = secondDelta < 0;
            if (firstOverdue !== secondOverdue) return firstOverdue ? -1 : 1;
            if (firstOverdue && secondOverdue) return secondDelta - firstDelta;
            return firstDelta - secondDelta;
        });
    }

    function reminderCandidates(state) {
        const byId = new Map();
        const today = String(state.now || '').slice(0, 10);
        const groups = [
            state.reminders || [],
            state.notifications?.overdue || [],
            state.notifications?.today || []
        ];
        groups.flat().forEach((task) => {
            const taskId = String(task.id);
            const delta = adjustedDelta(task);
            const isPending = !task.is_completed && String(task.status || 'Pending').toLowerCase() !== 'completed';
            const isFutureDate = today && task.due_date && task.due_date > today;
            const isOverdue = delta < 0 && !isFutureDate && delta >= -OVERDUE_REMINDER_WINDOW_SECONDS;
            const isDueTodaySoon = task.due_date === today && delta >= 60 && delta <= REMINDER_WINDOW_SECONDS;
            const qualifies = isPending && task.due_at && (isOverdue || isDueTodaySoon);
            if (qualifies && !dismissedReminderIds.has(taskId)) byId.set(taskId, task);
        });
        return sortReminderTasks([...byId.values()]);
    }

    function styleReminderStack(container) {
        container.style.display = 'block';
        container.style.width = '380px';
        container.style.maxWidth = 'calc(100vw - 1rem)';
        container.style.minHeight = `calc(252px + ${REMINDER_STACK_PEEK_PX * REMINDER_STACK_MAX_PEEK}px)`;
        container.style.pointerEvents = 'none';
    }

    function renderReminderElement(element, task, expanded, stackIndex, activeHeight) {
        const depth = expanded ? 0 : Math.min(stackIndex + 1, REMINDER_STACK_MAX_PEEK);
        const xOffset = expanded ? 0 : depth * -8;
        const collapsedBaseOffset = Math.max(0, Number(activeHeight || 0) - 6);
        const yOffset = expanded ? 0 : -(collapsedBaseOffset + ((depth - 1) * REMINDER_STACK_PEEK_PX));
        const scale = expanded ? 1 : 1 - depth * 0.025;

        element.dataset.taskReminderId = String(task.id);
        element.dataset.taskReminderExpanded = expanded ? 'true' : 'false';
        element.style.position = 'absolute';
        element.style.right = '0';
        element.style.bottom = '0';
        element.style.margin = '0';
        element.style.width = expanded ? '360px' : '336px';
        element.style.maxWidth = 'calc(100vw - 2rem)';
        element.style.cursor = expanded ? 'default' : 'pointer';
        element.style.transform = `translate(${xOffset}px, ${yOffset}px) scale(${scale})`;
        element.style.transformOrigin = 'bottom right';
        element.style.opacity = expanded ? '1' : String(Math.max(0.78, 0.98 - depth * 0.06));
        element.style.pointerEvents = 'auto';
        element.style.transition = 'transform 220ms ease, opacity 220ms ease, width 220ms ease, box-shadow 220ms ease, height 220ms ease';
        element.style.zIndex = expanded ? '40' : String(40 - depth);
        element.style.boxShadow = expanded
            ? '0 18px 50px rgba(76, 29, 149, 0.2)'
            : '0 10px 30px rgba(76, 29, 149, 0.16)';
        element.innerHTML = expanded ? `<div class="toast-header">
            <span class="notification-priority ${priorityClass(task.priority)} me-2"></span>
            <strong class="me-auto">Task reminder</strong>
            <small>${escapeHtml(task.priority)}</small>
            <button type="button" class="btn-close ms-2" data-task-toast-dismiss="${escapeHtml(task.id)}" aria-label="Dismiss"></button>
        </div>
        <div class="toast-body">
            <div class="fw-bold mb-1">${escapeHtml(task.title)}</div>
            <div class="text-muted small mb-1">${escapeHtml(task.due_time || 'No time')}</div>
            <div class="task-reminder-time mb-3">${escapeHtml(relativeText(task))}</div>
            <div class="d-flex flex-wrap gap-2">
                <a class="btn btn-sm btn-primary" href="${escapeHtml(task.url)}" data-task-toast-view="${escapeHtml(task.id)}">View Task</a>
                <button class="btn btn-sm btn-success" type="button" data-task-toast-complete="${escapeHtml(task.id)}">Mark Completed</button>
                <button class="btn btn-sm btn-outline-secondary" type="button" data-task-toast-dismiss="${escapeHtml(task.id)}">Dismiss</button>
            </div>
        </div>` : `<div class="toast-header">
            <span class="notification-priority ${priorityClass(task.priority)} me-2"></span>
            <strong class="me-auto text-truncate">${escapeHtml(task.title)}</strong>
            <small class="ms-2">${escapeHtml(relativeText(task))}</small>
            <button type="button" class="btn-close ms-2" data-task-toast-dismiss="${escapeHtml(task.id)}" aria-label="Dismiss"></button>
        </div>`;
    }

    function showReminder(task, expanded) {
        const taskId = String(task.id);
        if (activeToasts.has(taskId)) {
            return;
        }

        const container = document.getElementById('taskToastContainer');
        if (!container) return;
        styleReminderStack(container);
        const element = document.createElement('div');
        element.className = 'toast task-reminder-toast';
        element.setAttribute('role', 'alert');
        element.setAttribute('aria-live', 'assertive');
        element.setAttribute('aria-atomic', 'true');
        container.appendChild(element);
        activeToasts.set(taskId, element);
        element.addEventListener('hidden.bs.toast', function () {
            activeToasts.delete(taskId);
            element.remove();
        });
        bootstrap.Toast.getOrCreateInstance(element, { autohide: false }).show();
    }

    function positionReminderStack(tasks) {
        const sortedIds = tasks.map((task) => String(task.id));
        const expandedIndex = sortedIds.indexOf(String(expandedReminderId));
        const stackTasks = expandedIndex > -1
            ? [tasks[expandedIndex], ...tasks.filter((_, index) => index !== expandedIndex)]
            : tasks;
        const activeToast = stackTasks[0] ? activeToasts.get(String(stackTasks[0].id)) : null;
        if (activeToast) renderReminderElement(activeToast, stackTasks[0], true, 0, 0);
        const activeHeight = activeToast?.offsetHeight || 180;
        stackTasks.forEach((task, index) => {
            if (index === 0) return;
            const toast = activeToasts.get(String(task.id));
            if (!toast) return;
            renderReminderElement(toast, task, false, Math.max(0, index - 1), activeHeight);
        });
    }

    function renderReminders(state) {
        const tasks = reminderCandidates(state);
        const pendingIds = new Set(tasks.map((task) => String(task.id)));
        activeToasts.forEach((toast, taskId) => {
            if (!pendingIds.has(taskId)) bootstrap.Toast.getOrCreateInstance(toast).hide();
        });
        if (!expandedReminderId || !pendingIds.has(String(expandedReminderId))) {
            expandedReminderId = tasks[0] ? String(tasks[0].id) : null;
        }
        tasks.forEach((task) => showReminder(task, String(task.id) === String(expandedReminderId)));
        positionReminderStack(tasks);
        const container = document.getElementById('taskToastContainer');
        if (container) {
            tasks.slice().reverse().forEach((task) => {
                const toast = activeToasts.get(String(task.id));
                if (toast) container.appendChild(toast);
            });
        }
    }

    function taskEditAttrs(task) {
        return `data-bs-toggle="modal" data-bs-target="#taskEditModal" data-task-edit-id="${escapeHtml(task.id)}" data-task-id="${escapeHtml(task.id)}" data-task-title="${escapeHtml(task.title)}" data-task-description="${escapeHtml(task.description)}" data-task-due-at="${escapeHtml(task.due_at)}" data-task-priority="${escapeHtml(task.priority)}" data-task-assignee="${escapeHtml(task.assignee_id)}" data-task-status="${escapeHtml(task.status)}"`;
    }

    function dashboardTaskHtml(task) {
        return `<button type="button" class="dashboard-task-row dashboard-task-edit-trigger ${task.is_completed ? 'is-completed' : ''}" ${taskEditAttrs(task)}>
            <span class="task-complete-circle ${task.is_completed ? 'is-checked' : ''}" role="button" tabindex="0" aria-label="${task.is_completed ? 'Mark task pending' : 'Mark task completed'}" data-task-toggle="${escapeHtml(task.id)}" data-next-status="${task.is_completed ? 'Pending' : 'Completed'}"></span>
            <span class="dashboard-task-main"><strong data-task-title-id="${escapeHtml(task.id)}">${escapeHtml(task.title)}</strong><small data-task-meta-id="${escapeHtml(task.id)}">${escapeHtml(task.priority)} priority</small></span>
            <span class="notification-priority ${priorityClass(task.priority)}"></span>
            <span class="dashboard-task-time">${escapeHtml(task.due_time || 'No time')}</span>
        </button>`;
    }

    function dashboardTimelineHtml(task) {
        return `<button type="button" class="dashboard-timeline-item ${task.is_completed ? 'is-completed' : ''}" ${taskEditAttrs(task)}>
            <span class="dashboard-timeline-time">${escapeHtml(task.due_time || 'No time')}</span>
            <span class="dashboard-timeline-dot ${priorityClass(task.priority)}"></span>
            <span class="dashboard-timeline-copy"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.status)} • ${escapeHtml(task.priority)}</small></span>
        </button>`;
    }

    function renderDashboard(state) {
        const data = state.dashboard;
        const mappings = {
            dashboardTodayDate: data.date,
            dashboardTodayCount: data.today_count,
            dashboardOverdueCount: data.overdue_count,
            dashboardDueTodayCount: data.due_today_count,
            dashboardCompletedTodayCount: data.completed_today_count
        };
        Object.entries(mappings).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        const list = document.getElementById('dashboardTodayTasks');
        if (list) {
            list.innerHTML = data.today_tasks.length
                ? data.today_tasks.map(dashboardTaskHtml).join('')
                : '<div class="empty-state dashboard-empty-state">No tasks scheduled for today. Your desk is suspiciously calm.</div>';
        }
        const timeline = document.getElementById('dashboardTodayTimeline');
        if (timeline) {
            timeline.innerHTML = data.today_tasks.length
                ? data.today_tasks.map(dashboardTimelineHtml).join('')
                : '<div class="empty-state dashboard-empty-state">No timeline items for today.</div>';
        }
    }

    function renderTaskStatuses(state) {
        state.statuses.forEach((task) => {
            const completed = task.status === 'Completed';
            document.querySelectorAll(`[data-task-status-id="${CSS.escape(String(task.id))}"]`).forEach((pill) => {
                pill.textContent = task.status;
                pill.classList.toggle('status-completed', completed);
                pill.classList.toggle('status-pending', !completed);
            });
            document.querySelectorAll(`[data-task-toggle="${CSS.escape(String(task.id))}"]`).forEach((button) => {
                button.dataset.nextStatus = completed ? 'Pending' : 'Completed';
                button.classList.toggle('is-checked', completed);
                button.setAttribute('aria-label', completed ? 'Mark task pending' : 'Mark task completed');
            });
            document.querySelectorAll(`[data-task-edit-id="${CSS.escape(String(task.id))}"]`).forEach((button) => {
                button.dataset.taskStatus = task.status;
            });

            const row = document.querySelector(`[data-task-row-id="${CSS.escape(String(task.id))}"]`);
            if (row) {
                let bucket = 'upcoming';
                if (completed) bucket = 'completed';
                else if (Number(task.delta_seconds) < 0) bucket = 'overdue';
                else if (currentState && task.due_date === currentState.now.slice(0, 10)) bucket = 'today';
                const bucketElement = document.querySelector(`[data-task-bucket="${bucket}"]`);
                if (bucketElement && row.parentElement !== bucketElement) bucketElement.appendChild(row);
            }
        });
    }

    function renderEditedTask(task) {
        document.querySelectorAll(`[data-task-title-id="${CSS.escape(String(task.id))}"]`).forEach((element) => {
            element.textContent = task.title;
        });
        document.querySelectorAll(`[data-task-meta-id="${CSS.escape(String(task.id))}"]`).forEach((element) => {
            element.textContent = `Due ${task.due_date || '-'} • ${task.priority}`;
        });
        document.querySelectorAll(`[data-task-edit-id="${CSS.escape(String(task.id))}"]`).forEach((button) => {
            button.dataset.taskTitle = task.title;
            button.dataset.taskDescription = task.description;
            button.dataset.taskDueAt = task.due_at;
            button.dataset.taskPriority = task.priority;
            button.dataset.taskAssignee = task.assignee_id;
            button.dataset.taskStatus = task.status;
        });
    }

    function applyState(state) {
        currentState = state;
        stateReceivedAt = Date.now();
        renderNotifications(state);
        renderReminders(state);
        renderDashboard(state);
        renderTaskStatuses(state);
        document.dispatchEvent(new CustomEvent('crm:task-state', { detail: state }));
    }

    async function refreshState() {
        if (refreshPromise) return refreshPromise;
        refreshPromise = fetch(stateUrl, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then((response) => {
                if (!response.ok) throw new Error(`Task state request failed (${response.status})`);
                return response.json();
            })
            .then(applyState)
            .catch((error) => console.error(error))
            .finally(() => { refreshPromise = null; });
        return refreshPromise;
    }

    async function updateTask(taskId, payload) {
        const response = await fetch(actionUrl(taskId), {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken()
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Unable to update task');
        applyState(result.state);
        return result;
    }

    document.addEventListener('click', async function (event) {
        const toastDismiss = event.target.closest('[data-task-toast-dismiss]');
        if (toastDismiss) {
            event.preventDefault();
            event.stopPropagation();
            const taskId = String(toastDismiss.dataset.taskToastDismiss);
            dismissedReminderIds.add(taskId);
            if (expandedReminderId === taskId) expandedReminderId = null;
            dismissTaskToast(taskId);
            if (currentState) renderReminders(currentState);
            return;
        }

        const toastView = event.target.closest('[data-task-toast-view]');
        if (toastView) {
            dismissedReminderIds.add(String(toastView.dataset.taskToastView));
            return;
        }

        const reminderToast = event.target.closest('[data-task-reminder-id]');
        if (reminderToast && reminderToast.dataset.taskReminderExpanded !== 'true') {
            event.preventDefault();
            event.stopPropagation();
            expandedReminderId = String(reminderToast.dataset.taskReminderId);
            if (currentState) renderReminders(currentState);
            return;
        }

        const toggle = event.target.closest('[data-task-toggle]');
        const toastComplete = event.target.closest('[data-task-toast-complete]');
        const button = toggle || toastComplete;
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const taskId = toggle ? toggle.dataset.taskToggle : toastComplete.dataset.taskToastComplete;
        const status = toggle ? toggle.dataset.nextStatus : 'Completed';
        button.disabled = true;
        try {
            await updateTask(taskId, { action: 'status', status });
            if (toastComplete) {
                dismissedReminderIds.delete(String(taskId));
                if (expandedReminderId === String(taskId)) expandedReminderId = null;
                dismissTaskToast(taskId);
            }
        } catch (error) {
            console.error(error);
            window.alert(error.message);
        } finally {
            button.disabled = false;
        }
    });

    const editModal = document.getElementById('taskEditModal');
    if (editModal) {
        const form = document.getElementById('taskEditForm');
        editModal.addEventListener('show.bs.modal', function (event) {
            const source = event.relatedTarget;
            if (!source || !form) return;
            form.elements.id.value = source.dataset.taskId || '';
            form.elements.title.value = source.dataset.taskTitle || '';
            form.elements.description.value = source.dataset.taskDescription || '';
            const dueParts = (source.dataset.taskDueAt || '').replace(' ', 'T').split('T');
            form.elements.due_date.value = dueParts[0] || '';
            form.elements.due_time.value = (dueParts[1] || '').slice(0, 5);
            form.elements.priority.value = source.dataset.taskPriority || 'Medium';
            form.elements.assignee_id.value = source.dataset.taskAssignee || '';
            form.elements.status.value = source.dataset.taskStatus || 'Pending';
        });
        form?.addEventListener('submit', async function (event) {
            event.preventDefault();
            const submit = form.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                const payload = Object.fromEntries(new FormData(form).entries());
                payload.action = 'edit';
                const result = await updateTask(payload.id, payload);
                renderEditedTask(result.task);
                bootstrap.Modal.getOrCreateInstance(editModal).hide();
            } catch (error) {
                console.error(error);
                window.alert(error.message);
            } finally {
                submit.disabled = false;
            }
        });
    }

    function updateClock() {
        const clock = document.getElementById('dashboardCurrentTime');
        if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    refreshState();
    updateClock();
    window.setInterval(updateClock, 1000);
    window.setInterval(() => {
        if (currentState) renderReminders(currentState);
    }, 10000);
    window.setInterval(refreshState, 60000);
    window.crmTaskCenter = { refresh: refreshState, updateTask };

    const selectedTaskId = new URLSearchParams(window.location.search).get('task');
    if (selectedTaskId) {
        const selectedModal = document.getElementById(`taskModal${selectedTaskId}`);
        if (selectedModal) bootstrap.Modal.getOrCreateInstance(selectedModal).show();
    }
}());
