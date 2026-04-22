/**
 * Global Auth Utility for Winjob
 * Handles JWT token storage, retrieval, and authenticated fetch requests.
 */

const Auth = {
    // Keys for localStorage
    TOKEN_KEY: 'token',
    REFRESH_TOKEN_KEY: 'refreshToken',
    USER_KEY: 'user',

    /**
     * Save tokens and user info on login
     */
    login(data) {
        if (data.accessToken) localStorage.setItem(this.TOKEN_KEY, data.accessToken);
        if (data.refreshToken) localStorage.setItem(this.REFRESH_TOKEN_KEY, data.refreshToken);
        if (data.user) localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
    },

    /**
     * Clear tokens and user info on logout
     */
    async logout() {
        const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
        try {
            if (refreshToken) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });
            }
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            localStorage.removeItem(this.TOKEN_KEY);
            localStorage.removeItem(this.REFRESH_TOKEN_KEY);
            localStorage.removeItem(this.USER_KEY);
            window.location.href = '/login.html';
        }
    },

    /**
     * Get the current access token
     */
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    },

    /**
     * Get the current user info
     */
    getUser() {
        const user = localStorage.getItem(this.USER_KEY);
        return user ? JSON.parse(user) : null;
    },

    /**
     * Refresh the access token
     */
    async refreshToken() {
        const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
        if (!refreshToken) return null;

        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            const data = await response.json();
            if (data.success && data.accessToken) {
                localStorage.setItem(this.TOKEN_KEY, data.accessToken);
                return data.accessToken;
            } else {
                // Refresh failed, logout
                this.logout();
                return null;
            }
        } catch (err) {
            console.error('Token refresh error:', err);
            return null;
        }
    },

    /**
     * Global fetch wrapper with automatic token handling
     */
    async fetchWithAuth(url, options = {}) {
        let token = this.getToken();

        // Initialize headers
        options.headers = options.headers || {};
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        let response = await fetch(url, options);

        // If unauthorized (401), try refreshing token
        if (response.status === 401) {
            console.warn('Access token expired. Attempting refresh...');
            const newToken = await this.refreshToken();
            
            if (newToken) {
                // Retry the original request with the new token
                options.headers['Authorization'] = `Bearer ${newToken}`;
                response = await fetch(url, options);
            } else {
                // Refresh failed
                window.location.href = '/login.html';
            }
        }

        return response;
    },

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return !!this.getToken();
    }
};

// Export to global scope for vanilla JS usage
window.Auth = Auth;
