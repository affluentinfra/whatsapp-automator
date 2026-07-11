// API Client Wrapper for CAP REST APIs

const API = {
    // Base request handler
    async request(endpoint, options = {}) {
        options.credentials = "same-origin"; // Pass cookies on same-origin requests
        
        // Prepare headers
        options.headers = options.headers || {};

        // Auto convert object to JSON unless it's FormData
        if (options.body && !(options.body instanceof FormData) && typeof options.body === "object") {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(endpoint, options);
            
            // Auto logout on unauthorized (session expired)
            if (response.status === 401 && endpoint !== "/api/auth/login" && endpoint !== "/api/auth/me" && endpoint !== "/api/auth/signup") {
                localStorage.removeItem("cap_user_info");
                window.location.reload();
                throw new Error("Session expired. Please log in again.");
            }

            const data = await response.json();
            if (!response.ok) {
                const err = new Error(data.error || "An error occurred");
                err.status = response.status;
                err.data = data;
                throw err;
            }
            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },

    // --- AUTH ---
    async getMe() {
        try {
            const data = await this.request("/api/auth/me");
            if (data && data.user) {
                localStorage.setItem("cap_user_info", JSON.stringify(data.user));
                return data.user;
            }
        } catch (e) {
            // Silence auth me error
        }
        localStorage.removeItem("cap_user_info");
        return null;
    },

    async login(email, password) {
        const data = await this.request("/api/auth/login", {
            method: "POST",
            body: { email, password }
        });
        localStorage.setItem("cap_user_info", JSON.stringify(data.user));
        return data;
    },

    async signup(name, email, password, role) {
        const data = await this.request("/api/auth/signup", {
            method: "POST",
            body: { name, email, password, role }
        });
        localStorage.setItem("cap_user_info", JSON.stringify(data.user));
        return data;
    },

    async logout() {
        try {
            await this.request("/api/auth/logout", { method: "POST" });
        } catch (e) {}
        localStorage.removeItem("cap_user_info");
    },

    getUser() {
        const userStr = localStorage.getItem("cap_user_info");
        return userStr ? JSON.parse(userStr) : null;
    },

    // --- TEMPLATES ---
    async getTemplates(includeArchived = false) {
        return await this.request(`/api/templates?include_archived=${includeArchived}`);
    },

    async getTemplate(id) {
        return await this.request(`/api/templates/${id}`);
    },

    async createTemplate(name, category, backgroundFile) {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("category", category);
        formData.append("background", backgroundFile);

        return await this.request("/api/templates", {
            method: "POST",
            body: formData
        });
    },

    async saveTemplateFields(templateId, fields) {
        return await this.request(`/api/templates/${templateId}/fields`, {
            method: "POST",
            body: fields
        });
    },

    async updateTemplateStatus(templateId, status) {
        return await this.request(`/api/templates/${templateId}/status`, {
            method: "PUT",
            body: { status }
        });
    },

    // --- CONTACTS ---
    async getContacts() {
        return await this.request("/api/contacts");
    },

    async createContact(contactData) {
        return await this.request("/api/contacts", {
            method: "POST",
            body: contactData
        });
    },

    async updateContact(id, contactData) {
        return await this.request(`/api/contacts/${id}`, {
            method: "PUT",
            body: contactData
        });
    },

    async deleteContact(id) {
        return await this.request(`/api/contacts/${id}`, {
            method: "DELETE"
        });
    },

    async importContacts(file, resolveMode = "ask") {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("resolve_mode", resolveMode);

        return await this.request("/api/contacts/import", {
            method: "POST",
            body: formData
        });
    },

    // --- CAMPAIGNS ---
    async getCampaigns() {
        return await this.request("/api/campaigns");
    },

    async createCampaign(campaignData) {
        return await this.request("/api/campaigns", {
            method: "POST",
            body: campaignData
        });
    },

    async updateCampaign(id, campaignData) {
        return await this.request(`/api/campaigns/${id}`, {
            method: "PUT",
            body: campaignData
        });
    },

    // --- SHARING ---
    async shareCreative(contactId, templateId, campaignId, imageBase64) {
        return await this.request("/api/share", {
            method: "POST",
            body: {
                contact_id: contactId,
                template_id: templateId,
                campaign_id: campaignId,
                image_base64: imageBase64
            }
        });
    },

    // --- ANALYTICS ---
    async getAnalytics() {
        return await this.request("/api/analytics");
    },

    // --- SETTINGS ---
    async getSettings() {
        return await this.request("/api/settings");
    },

    async saveSettings(settingsData) {
        return await this.request("/api/settings", {
            method: "POST",
            body: settingsData
        });
    }
};
