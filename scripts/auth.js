/**
 * auth.js - Frontend Auth Utility
 * Centralized logic for tokens, user info, and auto-refresh
 */

const Auth = {
    // --- Token Management ---
    getAccessToken: () => localStorage.getItem('accessToken'),
    getRefreshToken: () => localStorage.getItem('refreshToken'),

    setTokens: (accessToken, refreshToken) => {
        if (accessToken) localStorage.setItem('accessToken', accessToken);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    },

    // --- User Info ---
    setUser: (user) => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
            // Keep email in sessionStorage for backward compatibility with navbar
            sessionStorage.setItem('email', user.email);
        }
    },

    getUser: () => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    isLoggedIn: () => !!Auth.getAccessToken(),

    // --- Logout ---
    logout: async () => {
        const refreshToken = Auth.getRefreshToken();
        try {
            if (refreshToken) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });
            }
        } catch (err) {
            console.error('Logout API failed:', err);
        }

        // Cleanup
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('token'); // Cleanup legacy key
        localStorage.removeItem('userRole'); // Cleanup role key
        sessionStorage.removeItem('email');
        sessionStorage.removeItem('authToken'); // Cleanup old keys
        localStorage.removeItem('mentorToken'); // Cleanup old keys
        
        // Redirect based on current role if possible, or back to index
        window.location.href = '/index.html';
    },

    // --- API Wrapper ---
    /**
     * fetchWithAuth - Wrapper for fetch that handles JWT logic and automatic Refresh
     */
    fetchWithAuth: async (url, options = {}) => {
        let accessToken = Auth.getAccessToken();

        // 1. Prepare headers
        const headers = {
            ...options.headers,
            'Authorization': accessToken ? `Bearer ${accessToken}` : ''
        };

        // 2. Perform original request
        let response = await fetch(url, { ...options, headers });

        // 3. If 401 Unauthorized, try to refresh token once
        if (response.status === 401) {
            console.warn('Access token expired or missing, attempting refresh...');
            const refreshToken = Auth.getRefreshToken();

            if (!refreshToken) {
                console.error('No refresh token found. Logging out.');
                Auth.logout();
                return response; 
            }

            try {
                const refreshRes = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });

                const data = await refreshRes.json();

                if (refreshRes.ok && data.success && data.accessToken) {
                    console.log('Token refreshed successfully!');
                    Auth.setTokens(data.accessToken);

                    // Retry original request with NEW token
                    headers['Authorization'] = `Bearer ${data.accessToken}`;
                    return await fetch(url, { ...options, headers });
                } else {
                    console.error('Refresh token invalid or expired. Logging out.');
                    Auth.logout();
                    return response;
                }
            } catch (err) {
                console.error('Network error during token refresh:', err);
                Auth.logout();
                return response;
            }
        }

        return response;
    }
};

// Expose globally
window.Auth = Auth;
