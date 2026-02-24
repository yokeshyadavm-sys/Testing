// >>> IMPORTANT: REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS <<<
const SUPABASE_URL = "https://sqxhyttacorsejczhryc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxeGh5dHRhY29yc2VqY3pocnljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDM1ODMsImV4cCI6MjA4NzQ3OTU4M30.GyrZlAJkRlfLHimHU_F7JEropvP_oyYvTSpLNcmXcVA";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ALLOWED_USERS = [
    'yokeshyadavm@gmail.com',
    'bpm@lawhands.org'
];

/**
 * Checks if the user is authenticated and authorized.
 * Redirects to login page if not.
 * @returns {Promise<Object|null>} User object with role, or null if unauthorized
 */
async function checkAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');

        if (error || !session) {
            if (!isLoginPage) {
                window.location.replace('index.html');
            }
            return null;
        }

        const email = session.user.email;

        // Strict access check
        if (!ALLOWED_USERS.includes(email)) {
            await supabase.auth.signOut();
            if (!isLoginPage) {
                window.location.replace('index.html?error=unauthorized');
            }
            return null;
        }

        // Role determination
        const role = email === 'bpm@lawhands.org' ? 'Manager' : 'Associate';

        return { session, user: session.user, role };
    } catch (err) {
        console.error("Auth check failed:", err);
        return null;
    }
}

// Global logout handler
async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});
