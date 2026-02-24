document.addEventListener('DOMContentLoaded', async () => {
    const errorDiv = document.getElementById('auth-error');

    // Check URL parameters for redirect errors
    const urlParams = new URLSearchParams(window.location.search);
    const errorMsg = urlParams.get('error');
    if (errorMsg === 'unauthorized') {
        errorDiv.textContent = "Access Denied. Your email is not authorized for this ERP.";
        errorDiv.style.display = 'block';
        // Clean URL after showing error
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check if we already have an active authorized session
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const email = session.user.email;
            if (ALLOWED_USERS.includes(email)) {
                window.location.replace('dashboard.html');
                return;
            } else {
                await supabase.auth.signOut();
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
                // Pre-check if email is in ALLOWED_USERS before even calling Supabase to save time/requests
                if (!ALLOWED_USERS.includes(email)) {
                    throw new Error("Access Denied. Your email is not authorized for this ERP.");
                }

                const { data, error } = await supabase.auth.signInWithPassword({
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
