let currentUser = null;
let userRole = null;
let allTasks = [];

const getTodayString = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await checkAuth();
    if (!authData) return;

    currentUser = authData.user;
    userRole = authData.role;

    document.getElementById('user-greeting').textContent = `Hello, ${userRole} (${currentUser.email.split('@')[0]})`;

    if (userRole === 'Manager') {
        document.getElementById('create-task-btn').style.display = 'inline-flex';
        document.getElementById('summary-cards').style.display = 'grid';
    }

    await loadTasks();
    setupRealtime();
    setupModal();
});

async function loadTasks() {
    let query = supabase.from('tasks').select('*').order('due_date', { ascending: false }).order('created_at', { ascending: false });

    // Associate can only see their tasks
    if (userRole === 'Associate') {
        query = query.eq('assigned_to', currentUser.email);
    }

    const { data: tasks, error } = await query;
    if (error) {
        console.error("Error fetching tasks:", error);
        document.getElementById('task-table-body').innerHTML = `<tr><td colspan="9" class="text-center text-danger">Failed to load tasks.</td></tr>`;
        return;
    }

    await handleAutoCarryForward(tasks);
    allTasks = tasks;
    renderTasks(tasks);
    if (userRole === 'Manager') {
        updateSummaryCards(tasks);
    }
}

async function handleAutoCarryForward(tasks) {
    const today = getTodayString();
    let updatedCount = 0;

    for (let task of tasks) {
        // Auto carry-forward if not completed and due date is in the past
        if (task.status !== 'Completed' && task.due_date < today) {
            task.due_date = today; // Update locally for instant render

            // Update in DB
            const { error } = await supabase.from('tasks').update({ due_date: today }).eq('id', task.id);
            if (error) console.error("Error carrying forward task:", error);
            else updatedCount++;
        }
    }

    if (updatedCount > 0) {
        console.log(`Auto carried forward ${updatedCount} tasks to today.`);
    }
}

function renderTasks(tasks) {
    const tbody = document.getElementById('task-table-body');
    tbody.innerHTML = '';

    if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center">No tasks found.</td></tr>`;
        return;
    }

    const today = getTodayString();

    tasks.forEach(task => {
        const tr = document.createElement('tr');

        const isOverdue = task.status !== 'Completed' && task.due_date < today;
        const isCompleted = task.status === 'Completed';

        if (isOverdue) tr.classList.add('overdue-row');
        if (isCompleted) tr.classList.add('completed-row');

        tr.innerHTML = `
            <td>${task.assigned_to.split('@')[0]}</td>
            <td class="task-title-cell"><strong>${escapeHTML(task.task_title)}</strong></td>
            <td>${new Date(task.created_at).toLocaleDateString()}</td>
            <td>${task.due_date}</td>
            <td>${task.created_by.split('@')[0]}</td>
            <td>
                <select class="status-select status-${(task.status || 'Pending').toLowerCase().replace(' ', '')}" data-id="${task.id}" ${isCompleted && userRole !== 'Manager' ? 'disabled' : ''}>
                    <option value="Pending" ${task.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Active" ${task.status === 'Active' ? 'selected' : ''}>Active</option>
                    <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select>
            </td>
            <td>
                <input type="text" class="comment-input" data-id="${task.id}" value="${escapeHTML(task.comments || '')}" placeholder="Add comment...">
            </td>
            <td>${task.completed_date || '-'}</td>
            <td>
                <button class="icon-btn view-btn" data-id="${task.id}" title="View Details">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Add Event Listeners
    document.querySelectorAll('.status-select').forEach(el => {
        el.addEventListener('change', handleStatusChange);
    });

    let commentTimeout;
    document.querySelectorAll('.comment-input').forEach(el => {
        el.addEventListener('input', (e) => {
            clearTimeout(commentTimeout);
            commentTimeout = setTimeout(() => handleCommentChange(e), 500); // debounce
        });
    });

    document.querySelectorAll('.view-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            const btn = e.target.closest('.view-btn');
            openModal(btn.dataset.id);
        });
    });
}

function updateSummaryCards(tasks) {
    const total = tasks.length;
    let completed = 0;
    let active = 0;
    let overdue = 0;
    const today = getTodayString();

    tasks.forEach(t => {
        if (t.status === 'Completed') completed++;
        if (t.status === 'Active' || t.status === 'In Progress') active++;
        if (t.status !== 'Completed' && t.due_date < today) overdue++;
    });

    document.getElementById('total-tasks').textContent = total;
    document.getElementById('total-completed').textContent = completed;
    document.getElementById('total-active').textContent = active;
    document.getElementById('total-overdue').textContent = overdue;
}

async function handleStatusChange(e) {
    const select = e.target;
    const id = select.dataset.id;
    const newStatus = select.value;

    // Update local class for color
    select.className = `status-select status-${newStatus.toLowerCase().replace(' ', '')}`;

    const updateData = { status: newStatus };

    if (newStatus === 'Completed') {
        const today = getTodayString();
        updateData.completed_date = today;
    } else {
        updateData.completed_date = null; // Reset if undone
    }

    const { error } = await supabase.from('tasks').update(updateData).eq('id', id);
    if (error) {
        console.error("Error updating status:", error);
        alert("Failed to update status");
    }
}

async function handleCommentChange(e) {
    const input = e.target;
    const id = input.dataset.id;
    const newComment = input.value;

    const { error } = await supabase.from('tasks').update({ comments: newComment }).eq('id', id);
    if (error) {
        console.error("Error updating comment:", error);
    }
}

function setupRealtime() {
    supabase
        .channel('public:tasks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
            console.log("Realtime update received:", payload);
            loadTasks(); // Reload to refresh data and summary cards easily
        })
        .subscribe();
}

// Modal Logic
function setupModal() {
    const modal = document.getElementById('task-modal');
    const closeBtn = document.querySelector('.close-modal');

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
}

function openModal(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('modal-title').textContent = task.task_title;
    document.getElementById('modal-desc').textContent = task.task_description || 'No description provided.';
    document.getElementById('modal-assignee').textContent = task.assigned_to;
    document.getElementById('modal-assigner').textContent = task.created_by;
    document.getElementById('modal-due').textContent = task.due_date;
    document.getElementById('modal-recurring').textContent = task.is_recurring ? 'Yes' : 'No';

    document.getElementById('task-modal').classList.add('show');
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
