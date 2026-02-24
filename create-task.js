let currentUser = null;
let userRole = null;

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

    document.getElementById('user-greeting').textContent = `Hello, ${userRole}`;

    // Setup Form UI based on role
    if (userRole === 'Manager') {
        document.getElementById('assign-to-group').style.display = 'block';
    } else {
        // Associate cannot assign logic, handled below (auto self-assign)
    }

    // Set minimum due date to today
    document.getElementById('due-date').min = getTodayString();
    document.getElementById('due-date').value = getTodayString();

    // Toggle hint text
    const recurringToggle = document.getElementById('is-recurring');
    const recurringInfo = document.getElementById('recurring-info');

    recurringToggle.addEventListener('change', (e) => {
        recurringInfo.style.display = e.target.checked ? 'block' : 'none';
    });

    // Form Submission
    document.getElementById('create-task-form').addEventListener('submit', handleCreateTask);
});

async function handleCreateTask(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-desc').value;
    const dueDate = document.getElementById('due-date').value;
    const isRecurring = document.getElementById('is-recurring').checked;

    let assignedTo = currentUser.email;
    if (userRole === 'Manager') {
        assignedTo = document.getElementById('assign-to').value;
    }

    try {
        let tasksToInsert = [];

        if (isRecurring) {
            // Generate tasks for Mon-Sat starting from the selected due date week
            const selectedDate = new Date(dueDate);
            const generatedDates = generateMonToSatDates(selectedDate);

            for (let dateStr of generatedDates) {
                tasksToInsert.push({
                    created_by: currentUser.email,
                    assigned_to: assignedTo,
                    task_title: title,
                    task_description: desc,
                    due_date: dateStr,
                    status: 'Pending',
                    is_recurring: true
                });
            }
        } else {
            // Single task
            tasksToInsert.push({
                created_by: currentUser.email,
                assigned_to: assignedTo,
                task_title: title,
                task_description: desc,
                due_date: dueDate,
                status: 'Pending',
                is_recurring: false
            });
        }

        const { error } = await supabase.from('tasks').insert(tasksToInsert);

        if (error) {
            throw error;
        }

        // Redirect back to dashboard safely handling subdirectories
        const currentPath = window.location.pathname;
        const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
        window.location.href = window.location.origin + basePath + '/dashboard.html';

    } catch (error) {
        console.error("Error creating task:", error);
        alert("Failed to create task: " + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Task';
    }
}

/**
 * Generates 6 dates (Mon-Sat) based on the week of the given date.
 */
function generateMonToSatDates(baseDate) {
    const dates = [];
    const current = new Date(baseDate);
    // JS getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday

    // Find the Monday of this week
    let dayOfWeek = current.getDay();
    let diffToMonday = current.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday

    let monday = new Date(current.setDate(diffToMonday));

    // Generate Mon to Sat
    for (let i = 0; i < 6; i++) {
        let d = new Date(monday);
        d.setDate(monday.getDate() + i);
        // Format to YYYY-MM-DD local time
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        dates.push(d.toISOString().split('T')[0]);
    }

    // Filter out dates that are strictly BEFORE the originally selected due date
    // to match user intent (start from selected date)
    const baseDateStr = baseDate.toISOString().split('T')[0];
    return dates.filter(d => d >= baseDateStr);
}
