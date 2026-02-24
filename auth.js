const LOCAL_ALLOWED_USERS = [
    'yokeshyadavm@gmail.com',
    'bpm@lawhands.org'
];

document.addEventListener('DOMContentLoaded', async () => {
    const errorDiv = document.getElementById('auth-error');

    if (typeof supabase === 'undefined') {
        errorDiv.textContent = "Error: Database connection failed (Supabase is not defined). Please hard-refresh your browser (Ctrl+F5) or disable tracking blockers.";
        errorDiv.style.display = 'block';
        return;
    }

    // Check URL parameters for redirect errors
    const urlParams = new URLSearchParams(window.location.search);
    const errorMsg = urlParams.get('error');
    if (errorMsg === 'unauthorized') {
        errorDiv.textContent = "Access Denied. Your email is not authorized for this ERP.";
        errorDiv.style.display = 'block';
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check if we already have an active authorized session
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            const email = session.user.email;
            if (LOCAL_ALLOWED_USERS.includes(email)) {
                window.location.replace('dashboard.html');
                return;
            } else {
                await window.supabaseClient.auth.signOut();
                errorDiv.textContent = "Access Denied. Your email is not authorized.";
                errorDiv.style.display = 'block';
            }
        }
    } catch (err) {
        console.error("Session check error on login:", err);
    }

    // Handle Email/Password Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const loginBtn = document.getElementById('login-btn');

            loginBtn.disabled = true;
            loginBtn.textContent = 'Signing in...';
            errorDiv.style.display = 'none';

            try {
                if (!LOCAL_ALLOWED_USERS.includes(email)) {
                    throw new Error("Access Denied. Your email is not authorized for this ERP.");
                }

                const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password,
                });

                if (error) {
                    throw error;
                }

                // If successful, redirect to dashboard
                const currentPath = window.location.pathname;
                const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                window.location.replace(window.location.origin + basePath + '/dashboard.html');

            } catch (error) {
                console.error("Login error:", error);
                errorDiv.textContent = error.message || "Error signing in.";
                errorDiv.style.display = 'block';
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In';
            }
        });
    }
});
