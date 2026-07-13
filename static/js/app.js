// Core Orchestrator for CAP Studio Web Application

let currentUser = null;
let contactsList = [];
let templatesList = [];
let campaignsList = [];
let shareHistoryList = [];
let dailyChart = null;
let campaignChart = null;

// Routing and Page State
let currentSubView = "dashboard";

// Bulk upload duplicate resolution queue
let duplicateResolutionQueue = [];
let currentResolutionIndex = 0;
let importFileReference = null;
let importResolveMode = "ask";
let importStats = { imported: 0, updated: 0, skipped: 0 };

// Personalizer state
let selectedTemplateForShare = null;
let selectedContactsForShare = [];
let activeContactForPreview = null;
let personalizationOverrides = {};

// Initialize application on load
document.addEventListener("DOMContentLoaded", () => {
    checkAuthentication();
    setupTheme();
    setupNavigation();
    setupAuthForm();
});

// Theme Management
function setupTheme() {
    const savedTheme = localStorage.getItem("cap_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const target = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", target);
    localStorage.setItem("cap_theme", target);
    updateThemeIcon(target);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById("theme-icon");
    if (!icon) return;
    if (theme === "dark") {
        icon.className = "fa-solid fa-sun";
    } else {
        icon.className = "fa-solid fa-moon";
    }
}

// Authentication Check
async function checkAuthentication() {
    const user = await API.getMe();
    if (user) {
        currentUser = user;
        showAppView();
    } else {
        showLoginView();
    }
}

function fillDemoCreds(email, password) {
    document.getElementById("login-email").value = email;
    document.getElementById("login-password").value = password;
}

function setupAuthForm() {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;

            try {
                const data = await API.login(email, password);
                currentUser = data.user;
                showToast(`Welcome back, ${currentUser.name}!`, "success");
                showAppView();
            } catch (err) {
                showToast(err.message || "Invalid credentials.", "error");
            }
        });
    }

    const signupForm = document.getElementById("signup-form");
    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("signup-name").value;
            const email = document.getElementById("signup-email").value;
            const password = document.getElementById("signup-password").value;
            const role = document.getElementById("signup-role").value;

            try {
                const data = await API.signup(name, email, password, role);
                currentUser = data.user;
                showToast(`Account created! Welcome, ${currentUser.name}!`, "success");
                showAppView();
            } catch (err) {
                showToast(err.message || "Sign up failed.", "error");
            }
        });
    }

    document.getElementById("logout-btn").addEventListener("click", async () => {
        await API.logout();
        currentUser = null;
        showToast("Logged out successfully.", "success");
        showLoginView();
    });
}

function toggleAuthTab(tab) {
    const tabLogin = document.getElementById("tab-login");
    const tabSignup = document.getElementById("tab-signup");
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const demoBox = document.getElementById("demo-credentials-box");

    if (tab === "login") {
        tabLogin.classList.add("active");
        tabSignup.classList.remove("active");
        loginForm.classList.remove("hidden");
        signupForm.classList.add("hidden");
        demoBox.classList.remove("hidden");
    } else {
        tabLogin.classList.remove("active");
        tabSignup.classList.add("active");
        loginForm.classList.add("hidden");
        signupForm.classList.remove("hidden");
        demoBox.classList.add("hidden");
    }
}

function showLoginView() {
    document.getElementById("login-view").classList.remove("hidden");
    document.getElementById("app-view").classList.add("hidden");
}

function showAppView() {
    document.getElementById("login-view").classList.add("hidden");
    document.getElementById("app-view").classList.remove("hidden");

    // Display user profile info
    document.getElementById("user-display-name").innerText = currentUser.name;
    document.getElementById("user-display-role").innerText = currentUser.role.replace("_", " ");
    
    // Initials for avatar
    const initials = currentUser.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    document.getElementById("user-avatar-initials").innerText = initials;

    // Enforce role-based access in UI
    const adminElements = document.querySelectorAll(".admin-only");
    adminElements.forEach(el => {
        if (currentUser.role === "super_admin" || currentUser.role === "admin") {
            el.classList.remove("hidden");
        } else {
            el.classList.add("hidden");
        }
    });

    // Default route
    switchView("dashboard");
}

// Mobile Sidebar Toggle
function toggleSidebarMenu(show) {
    const sidebar = document.getElementById("app-sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (!sidebar || !overlay) return;
    
    if (show) {
        sidebar.classList.add("active");
        overlay.classList.add("active");
    } else {
        sidebar.classList.remove("active");
        overlay.classList.remove("active");
    }
}

// Global Nav Bar
function setupNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const viewName = item.getAttribute("data-view");
            switchView(viewName);
            // Close mobile sidebar overlay
            toggleSidebarMenu(false);
        });
    });

    // Sub search input filters
    document.getElementById("template-search").addEventListener("input", (e) => {
        filterTemplates(e.target.value);
    });
    document.getElementById("contact-search").addEventListener("input", (e) => {
        filterContacts(e.target.value);
    });
    document.getElementById("campaign-search").addEventListener("input", (e) => {
        filterCampaigns(e.target.value);
    });
    document.getElementById("history-search").addEventListener("input", (e) => {
        filterHistory(e.target.value);
    });

    // Sync sharing mode input trigger
    const radios = document.getElementsByName("sharing_mode");
    radios.forEach(r => {
        r.addEventListener("change", (e) => {
            const card = document.getElementById("api-credentials-card");
            if (e.target.value === "api") {
                card.classList.remove("hidden");
            } else {
                card.classList.add("hidden");
            }
        });
    });
}

function switchView(viewName) {
    currentSubView = viewName;
    
    // Update active state in sidebar
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        if (item.getAttribute("data-view") === viewName) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    // Set page title
    document.getElementById("page-title").innerText = viewName.charAt(0).toUpperCase() + viewName.slice(1);

    // Hide all sub-views, show active one
    const subViews = document.querySelectorAll(".sub-view");
    subViews.forEach(view => {
        if (view.id === `view-${viewName}`) {
            view.classList.remove("hidden");
        } else {
            view.classList.add("hidden");
        }
    });

    // Load fresh data for active page
    if (viewName === "dashboard") loadDashboardData();
    else if (viewName === "templates") loadTemplatesData();
    else if (viewName === "contacts") loadContactsData();
    else if (viewName === "campaigns") loadCampaignsData();
    else if (viewName === "history") loadHistoryData();
    else if (viewName === "settings") loadSettingsData();
}

// --- 1. DASHBOARD VIEW CONTROLLER ---
async function loadDashboardData() {
    try {
        const stats = await API.getAnalytics();
        
        // Update stats card numbers
        document.getElementById("stat-total-shares").innerText = stats.total_shares;
        document.getElementById("stat-total-contacts").innerText = stats.total_contacts;
        document.getElementById("stat-total-templates").innerText = stats.total_templates;
        document.getElementById("stat-top-campaign").innerText = stats.top_campaign || "Direct Share";

        // Render Leaderboards
        renderUserLeaderboard(stats.user_counts);
        renderTemplateLeaderboard(stats.template_counts);

        // Render charts
        renderDailyChart(stats.daily_counts);
        renderCampaignChart(stats.campaign_counts);

    } catch (err) {
        showToast("Failed to fetch dashboard data.", "error");
    }
}

function renderUserLeaderboard(userCounts) {
    const list = document.getElementById("user-leaderboard");
    list.innerHTML = "";
    
    const sorted = Object.entries(userCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) {
        list.innerHTML = `<li class="empty-state">No sharing history found.</li>`;
        return;
    }

    sorted.forEach(([name, count], index) => {
        const item = document.createElement("li");
        item.innerHTML = `
            <div>
                <strong>#${index + 1} ${name}</strong>
            </div>
            <span class="badge badge-admin">${count} shares</span>
        `;
        list.appendChild(item);
    });
}

function renderTemplateLeaderboard(templateCounts) {
    const list = document.getElementById("template-leaderboard");
    list.innerHTML = "";
    
    const sorted = Object.entries(templateCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) {
        list.innerHTML = `<li class="empty-state">No sharing history found.</li>`;
        return;
    }

    sorted.forEach(([name, count], index) => {
        const item = document.createElement("li");
        item.innerHTML = `
            <div>
                <strong>${name}</strong>
            </div>
            <span class="badge badge-user">${count} shares</span>
        `;
        list.appendChild(item);
    });
}

function renderDailyChart(dailyData) {
    const ctx = document.getElementById("dailySharesChart").getContext("2d");
    if (dailyChart) {
        dailyChart.destroy();
    }

    // Sort dates chronological
    const sortedDays = Object.entries(dailyData || {}).sort((a, b) => a[0].localeCompare(b[0])).slice(-7);
    const labels = sortedDays.map(x => x[0]);
    const counts = sortedDays.map(x => x[1]);

    dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ["No data"],
            datasets: [{
                label: 'Shares',
                data: counts.length ? counts : [0],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.3,
                fill: true,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderCampaignChart(campaignData) {
    const ctx = document.getElementById("campaignSharesChart").getContext("2d");
    if (campaignChart) {
        campaignChart.destroy();
    }

    const labels = Object.keys(campaignData || {});
    const counts = Object.values(campaignData || {});

    campaignChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ["No Campaign"],
            datasets: [{
                data: counts.length ? counts : [1],
                backgroundColor: ['#6366f1', '#06b6d4', '#10b981', '#f97316', '#a855f7'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15, color: '#94a3b8' } } }
        }
    });
}

// --- 2. TEMPLATES VIEW CONTROLLER ---
async function loadTemplatesData() {
    try {
        const list = await API.getTemplates(true);
        templatesList = list;
        renderTemplatesGrid(templatesList);
    } catch (err) {
        showToast("Failed to load templates.", "error");
    }
}

function renderTemplatesGrid(templates) {
    const grid = document.getElementById("templates-grid-container");
    grid.innerHTML = "";

    if (templates.length === 0) {
        grid.innerHTML = `<div class="empty-state text-center" style="grid-column: 1/-1;">No templates found. Upload one to start!</div>`;
        return;
    }

    templates.forEach(t => {
        const card = document.createElement("div");
        card.className = "template-card";
        
        let statusBadge = "";
        if (t.status === "archived") {
            statusBadge = `<span class="template-badge bg-warning">Archived</span>`;
        }

        const isAuthorizedAdmin = currentUser.role === "super_admin" || currentUser.role === "admin";
        
        const adminControls = isAuthorizedAdmin ? `
            <button class="btn btn-secondary" onclick="enterDesignStudio(${t.id})" title="Add dynamic placeholders"><i class="fa-solid fa-pen-nib"></i> Design</button>
            <button class="btn ${t.status === 'active' ? 'btn-danger' : 'btn-warning'}" onclick="toggleArchiveTemplate(${t.id}, '${t.status}')">
                <i class="fa-regular ${t.status === 'active' ? 'fa-trash-can' : 'fa-folder-open'}"></i>
            </button>
        ` : "";

        const shareBtn = t.status === "active" ? `
            <button class="btn btn-primary" onclick="enterPersonalizerPanel(${t.id})"><i class="fa-brands fa-whatsapp"></i> Share</button>
        ` : "";

        card.innerHTML = `
            <div class="template-thumbnail">
                <img src="${t.background_url}" alt="${t.name}">
                <span class="template-badge">${t.category}</span>
                ${statusBadge}
            </div>
            <div class="template-info">
                <h3>${t.name}</h3>
                <p>Fields: ${t.fields.map(f => f.name).join(", ")}</p>
                <div class="template-card-footer mt-15">
                    ${shareBtn}
                    ${adminControls}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterTemplates(query) {
    const q = query.toLowerCase();
    const filtered = templatesList.filter(t => 
        t.name.toLowerCase().includes(q) || 
        t.category.toLowerCase().includes(q)
    );
    renderTemplatesGrid(filtered);
}

// Create template submission modal logic
function openCreateTemplateModal() {
    document.getElementById("modal-create-template").classList.remove("hidden");
}

async function handleCreateTemplate(event) {
    event.preventDefault();
    const name = document.getElementById("tpl-name").value;
    const category = document.getElementById("tpl-category").value;
    const bgFile = document.getElementById("tpl-bg").files[0];

    if (!bgFile) {
        showToast("Please select a background image file.", "error");
        return;
    }

    try {
        showToast("Uploading background template image...", "info");
        const newTpl = await API.createTemplate(name, category, bgFile);
        closeModal("modal-create-template");
        document.getElementById("create-template-form").reset();
        
        // Auto navigate to designer editor view
        enterDesignStudio(newTpl.id);
    } catch (err) {
        showToast(err.message || "Failed to create template.", "error");
    }
}

async function toggleArchiveTemplate(id, currentStatus) {
    const targetStatus = currentStatus === "active" ? "archived" : "active";
    try {
        await API.updateTemplateStatus(id, targetStatus);
        showToast(`Template ${targetStatus === 'archived' ? 'archived' : 'activated'} successfully.`, "success");
        loadTemplatesData();
    } catch (err) {
        showToast("Failed to modify template status.", "error");
    }
}

// --- 3. CONTACTS VIEW CONTROLLER ---
async function loadContactsData() {
    try {
        const list = await API.getContacts();
        contactsList = list;
        renderContactsTable(contactsList);
    } catch (err) {
        showToast("Failed to load contacts list.", "error");
    }
}

function renderContactsTable(contacts) {
    const tbody = document.getElementById("contacts-table-body");
    tbody.innerHTML = "";

    if (contacts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">No contacts in database. Import a list to get started!</td></tr>`;
        return;
    }

    contacts.forEach(c => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td><code>+${c.mobile}</code></td>
            <td>${c.company || "-"}</td>
            <td>${c.designation || "-"}</td>
            <td><small>${c.notes || "-"}</small></td>
            <td>
                <div class="actions-btn-group">
                    <button class="btn-icon" onclick="openEditContactModal(${c.id})" title="Edit Contact"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button class="btn-icon delete" onclick="deleteContactRecord(${c.id})" title="Delete Contact"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterContacts(query) {
    const q = query.toLowerCase();
    const filtered = contactsList.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.company.toLowerCase().includes(q) || 
        c.designation.toLowerCase().includes(q) || 
        c.mobile.includes(q)
    );
    renderContactsTable(filtered);
}

// Contact Edit / Add Handlers
function openAddContactModal() {
    document.getElementById("contact-modal-title").innerText = "Add Contact";
    document.getElementById("contact-id-field").value = "";
    document.getElementById("add-contact-form").reset();
    document.getElementById("modal-add-contact").classList.remove("hidden");
}

function openEditContactModal(contactId) {
    const contact = contactsList.find(c => c.id === contactId);
    if (!contact) return;

    document.getElementById("contact-modal-title").innerText = "Edit Contact";
    document.getElementById("contact-id-field").value = contact.id;
    document.getElementById("c-name").value = contact.name;
    document.getElementById("c-mobile").value = contact.mobile;
    document.getElementById("c-company").value = contact.company || "";
    document.getElementById("c-designation").value = contact.designation || "";
    document.getElementById("c-notes").value = contact.notes || "";

    document.getElementById("modal-add-contact").classList.remove("hidden");
}

async function handleSaveContact(event) {
    event.preventDefault();
    const id = document.getElementById("contact-id-field").value;
    const contactData = {
        name: document.getElementById("c-name").value,
        mobile: document.getElementById("c-mobile").value,
        company: document.getElementById("c-company").value,
        designation: document.getElementById("c-designation").value,
        notes: document.getElementById("c-notes").value
    };

    try {
        if (id) {
            await API.updateContact(id, contactData);
            showToast("Contact updated successfully.", "success");
        } else {
            await API.createContact(contactData);
            showToast("Contact created successfully.", "success");
        }
        closeModal("modal-add-contact");
        loadContactsData();
    } catch (err) {
        showToast(err.message || "Failed to save contact.", "error");
    }
}

async function deleteContactRecord(contactId) {
    if (!confirm("Are you sure you want to delete this contact? This will delete their sharing metrics!")) return;
    try {
        await API.deleteContact(contactId);
        showToast("Contact deleted successfully.", "success");
        loadContactsData();
    } catch (err) {
        showToast("Failed to delete contact record.", "error");
    }
}

// Bulk Import Handlers
function openImportContactsModal() {
    document.getElementById("import-contacts-form").reset();
    document.getElementById("modal-import-contacts").classList.remove("hidden");
}

async function handleImportContacts(event) {
    event.preventDefault();
    const file = document.getElementById("import-file").files[0];
    const resolveMode = document.getElementById("import-duplicate-rule").value;

    if (!file) return;

    try {
        showToast("Processing bulk import file...", "info");
        const res = await API.importContacts(file, resolveMode);
        
        closeModal("modal-import-contacts");
        
        if (resolveMode === "ask" && res.duplicates && res.duplicates.length > 0) {
            // Queue duplicate records for user decision
            duplicateResolutionQueue = res.duplicates;
            currentResolutionIndex = 0;
            importFileReference = file;
            importResolveMode = resolveMode;
            importStats = {
                imported: res.imported,
                updated: res.updated,
                skipped: res.skipped
            };
            
            triggerNextDuplicatePrompt();
        } else {
            // Clean import complete
            showToast(`Import complete! Created: ${res.imported}, Updated: ${res.updated}, Skipped: ${res.skipped}`, "success");
            loadContactsData();
        }
    } catch (err) {
        showToast(err.message || "Failed to import contacts.", "error");
    }
}

function triggerNextDuplicatePrompt() {
    if (currentResolutionIndex >= duplicateResolutionQueue.length) {
        // Queue finished
        closeModal("modal-import-resolution");
        showToast(`Import session resolved! Created: ${importStats.imported}, Updated: ${importStats.updated}, Skipped: ${importStats.skipped}`, "success");
        loadContactsData();
        return;
    }

    const currentDup = duplicateResolutionQueue[currentResolutionIndex];
    const existing = currentDup.existing_data;
    const imported = currentDup.imported_data;

    document.getElementById("res-mobile-display").innerText = existing.mobile;
    
    // Existing values
    document.getElementById("res-existing-name").innerText = existing.name;
    document.getElementById("res-existing-company").innerText = existing.company || "-";
    document.getElementById("res-existing-designation").innerText = existing.designation || "-";
    
    // Imported values
    document.getElementById("res-imported-name").innerText = imported.name;
    document.getElementById("res-imported-company").innerText = imported.company || "-";
    document.getElementById("res-imported-designation").innerText = imported.designation || "-";

    document.getElementById("modal-import-resolution").classList.remove("hidden");
}

async function resolveImportDuplicate(action) {
    const currentDup = duplicateResolutionQueue[currentResolutionIndex];
    const existing = currentDup.existing_data;
    const imported = currentDup.imported_data;

    try {
        if (action === "update") {
            await API.updateContact(existing.id, {
                name: imported.name,
                mobile: existing.mobile,
                company: imported.company,
                designation: imported.designation,
                notes: imported.notes
            });
            importStats.updated++;
        } else if (action === "overwrite") {
            await API.deleteContact(existing.id);
            await API.createContact({
                name: imported.name,
                mobile: existing.mobile,
                company: imported.company,
                designation: imported.designation,
                notes: imported.notes
            });
            importStats.imported++;
        } else {
            // "skip"
            importStats.skipped++;
        }
        
        currentResolutionIndex++;
        triggerNextDuplicatePrompt();
    } catch (err) {
        showToast("Error resolving duplicate decision.", "error");
    }
}

// --- 4. CAMPAIGNS VIEW CONTROLLER ---
async function loadCampaignsData() {
    try {
        const [camps, tpls] = await Promise.all([API.getCampaigns(), API.getTemplates()]);
        campaignsList = camps;
        templatesList = tpls;
        renderCampaignsGrid(campaignsList);
    } catch (err) {
        showToast("Failed to fetch campaigns.", "error");
    }
}

function renderCampaignsGrid(campaigns) {
    const grid = document.getElementById("campaigns-grid-container");
    grid.innerHTML = "";

    if (campaigns.length === 0) {
        grid.innerHTML = `<div class="empty-state text-center" style="grid-column: 1/-1;">No campaigns created yet.</div>`;
        return;
    }

    campaigns.forEach(c => {
        const card = document.createElement("div");
        card.className = "campaign-card";
        
        const isAuthorizedAdmin = currentUser.role === "super_admin" || currentUser.role === "admin";
        
        const statusBadge = c.status === "active" ? 
            `<span class="badge badge-user">Active</span>` : 
            `<span class="badge badge-status-failed">Inactive</span>`;

        const actionButtons = isAuthorizedAdmin ? `
            <button class="btn btn-secondary btn-block mt-10" onclick="openEditCampaignModal(${c.id})">
                <i class="fa-regular fa-pen-to-square"></i> Edit Campaign
            </button>
        ` : "";

        // Calculate mapped template names
        const linkedTemplates = c.template_ids.map(id => {
            const found = templatesList.find(t => t.id === id);
            return found ? found.name : "Unknown Template";
        }).join(", ") || "None";

        card.innerHTML = `
            <div class="campaign-card-header">
                <h3>${c.name}</h3>
                ${statusBadge}
            </div>
            <div class="campaign-dates">
                <i class="fa-regular fa-calendar"></i> ${c.start_date} to ${c.end_date}
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted);">Templates: ${linkedTemplates}</p>
            ${actionButtons}
        `;
        grid.appendChild(card);
    });
}

function filterCampaigns(query) {
    const q = query.toLowerCase();
    const filtered = campaignsList.filter(c => c.name.toLowerCase().includes(q));
    renderCampaignsGrid(filtered);
}

// Campaign Modal Logic
function openCreateCampaignModal() {
    document.getElementById("campaign-modal-title").innerText = "Create Campaign";
    document.getElementById("campaign-id-field").value = "";
    document.getElementById("create-campaign-form").reset();

    // Populate Templates checkbox list
    const container = document.getElementById("campaign-templates-list-cb");
    container.innerHTML = "";
    templatesList.forEach(t => {
        const lbl = document.createElement("label");
        lbl.className = "checkbox-container";
        lbl.innerHTML = `
            <input type="checkbox" name="camp_templates_cbs" value="${t.id}">
            <span class="checkmark"></span>
            ${t.name} (${t.category})
        `;
        container.appendChild(lbl);
    });

    document.getElementById("modal-create-campaign").classList.remove("hidden");
}

function openEditCampaignModal(campaignId) {
    const c = campaignsList.find(camp => camp.id === campaignId);
    if (!c) return;

    document.getElementById("campaign-modal-title").innerText = "Edit Campaign";
    document.getElementById("campaign-id-field").value = c.id;
    document.getElementById("camp-name").value = c.name;
    document.getElementById("camp-start").value = c.start_date;
    document.getElementById("camp-end").value = c.end_date;
    document.getElementById("camp-status").value = c.status;

    // Populate checklist with active checkboxes
    const container = document.getElementById("campaign-templates-list-cb");
    container.innerHTML = "";
    templatesList.forEach(t => {
        const isChecked = c.template_ids.includes(t.id) ? "checked" : "";
        const lbl = document.createElement("label");
        lbl.className = "checkbox-container";
        lbl.innerHTML = `
            <input type="checkbox" name="camp_templates_cbs" value="${t.id}" ${isChecked}>
            <span class="checkmark"></span>
            ${t.name} (${t.category})
        `;
        container.appendChild(lbl);
    });

    document.getElementById("modal-create-campaign").classList.remove("hidden");
}

async function handleSaveCampaign(event) {
    event.preventDefault();
    const id = document.getElementById("campaign-id-field").value;
    
    // Get checked templates
    const cbs = document.getElementsByName("camp_templates_cbs");
    const templateIds = [];
    cbs.forEach(cb => {
        if (cb.checked) templateIds.push(parseInt(cb.value));
    });

    const campaignData = {
        name: document.getElementById("camp-name").value,
        start_date: document.getElementById("camp-start").value,
        end_date: document.getElementById("camp-end").value,
        status: document.getElementById("camp-status").value,
        template_ids: templateIds
    };

    try {
        if (id) {
            await API.updateCampaign(id, campaignData);
            showToast("Campaign updated successfully.", "success");
        } else {
            await API.createCampaign(campaignData);
            showToast("Campaign created successfully.", "success");
        }
        closeModal("modal-create-campaign");
        loadCampaignsData();
    } catch (err) {
        showToast("Failed to save campaign.", "error");
    }
}

// --- 5. HISTORY (SHARE LOGS) VIEW CONTROLLER ---
async function loadHistoryData() {
    try {
        const history = await API.request("/api/share/history", { method: "GET" });
        shareHistoryList = Array.isArray(history) ? history : [];
        renderHistoryTable(shareHistoryList);
    } catch (err) {
        console.error("Share history error:", err);
        showToast("Failed to fetch share logs.", "error");
        shareHistoryList = [];
        renderHistoryTable([]);
    }
}

function renderHistoryTable(logs) {
    const tbody = document.getElementById("history-table-body");
    tbody.innerHTML = "";

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding:2rem;opacity:0.6;">
            <i class="fa-solid fa-clock-rotate-left" style="font-size:2rem;display:block;margin-bottom:0.5rem;"></i>
            No sharing history logs recorded yet.
        </td></tr>`;
        return;
    }

    logs.forEach(l => {
        const tr = document.createElement("tr");
        
        const dateStr = new Date(l.share_timestamp).toLocaleString();
        const lastEvent = l.last_event ? new Date(l.last_event).toLocaleDateString() : "—";
        const eventCount = l.event_count || 0;

        const channelBadge = l.channel === "api" ? 
            `<span class="badge badge-admin"><i class="fa-solid fa-code"></i> API</span>` : 
            `<span class="badge badge-secondary"><i class="fa-solid fa-arrow-up-right-from-square"></i> Manual</span>`;

        const statusColors = {
            sent: "#3b82f6",
            delivered: "#22c55e",
            read: "#a855f7",
            failed: "#ef4444",
            opened: "#f59e0b",
            clicked: "#06b6d4"
        };
        const statusColor = statusColors[l.delivery_status] || "#6b7280";
        const statusBadge = `<span class="badge" style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}40;">
            ${l.delivery_status || "sent"}
        </span>`;

        const eventBadge = eventCount > 0 
            ? `<span class="badge" style="background:#f59e0b20;color:#f59e0b;border:1px solid #f59e0b40;cursor:pointer;" onclick="viewShareEvents(${l.id})">
                <i class="fa-solid fa-chart-line"></i> ${eventCount} event${eventCount > 1 ? 's' : ''}
               </span>`
            : `<span style="opacity:0.4;font-size:0.75rem;">No events</span>`;

        tr.innerHTML = `
            <td><small>${dateStr}</small></td>
            <td>
                <strong>${l.contact_name || "Unknown"}</strong><br>
                <code style="font-size: 0.75rem;">+${l.contact_mobile || ""}</code>
            </td>
            <td>${l.user_name || "System"}</td>
            <td>${l.template_name || "N/A"}</td>
            <td>${l.campaign_name || "<span style='opacity:0.5'>Direct Share</span>"}</td>
            <td>${channelBadge}</td>
            <td>${statusBadge}</td>
            <td>${eventBadge}<br><small style="opacity:0.5;">Last: ${lastEvent}</small></td>
            <td>
                <div style="display:flex;gap:4px;align-items:center;">
                    <a href="${l.generated_image_url}" target="_blank" class="btn btn-secondary" style="padding:4px 8px;font-size:0.7rem;" title="View Image">
                        <i class="fa-regular fa-eye"></i>
                    </a>
                    <button class="btn btn-secondary" style="padding:4px 8px;font-size:0.7rem;color:#f59e0b;" onclick="viewShareEvents(${l.id})" title="View Event Timeline">
                        <i class="fa-solid fa-timeline"></i>
                    </button>
                    <button class="btn btn-danger" style="padding:4px 8px;font-size:0.7rem;" onclick="deleteShareEntry(${l.id})" title="Delete Log">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function viewShareEvents(shareId) {
    try {
        const events = await API.request(`/api/share/${shareId}/events`, { method: "GET" });
        const share = shareHistoryList.find(s => s.id === shareId);
        
        const eventIcons = {
            sent: { icon: "fa-paper-plane", color: "#3b82f6" },
            delivered: { icon: "fa-circle-check", color: "#22c55e" },
            read: { icon: "fa-eye", color: "#a855f7" },
            failed: { icon: "fa-circle-xmark", color: "#ef4444" },
            opened: { icon: "fa-envelope-open", color: "#f59e0b" },
            clicked: { icon: "fa-hand-pointer", color: "#06b6d4" },
            viewed: { icon: "fa-magnifying-glass", color: "#8b5cf6" },
            deleted: { icon: "fa-trash", color: "#6b7280" }
        };

        let timelineHtml = `<div style="margin-bottom:1rem;opacity:0.7;">
            Share to <strong>${share ? share.contact_name : "Contact #" + shareId}</strong>
        </div>`;

        if (!events || events.length === 0) {
            timelineHtml += `<p style="opacity:0.5;text-align:center;">No tracking events recorded yet.</p>`;
        } else {
            timelineHtml += `<div style="position:relative;padding-left:1.5rem;">
                <div style="position:absolute;left:0.6rem;top:0;bottom:0;width:2px;background:rgba(255,255,255,0.1);"></div>`;
            events.forEach(e => {
                const cfg = eventIcons[e.event_type] || { icon: "fa-circle", color: "#6b7280" };
                const ts = new Date(e.event_timestamp).toLocaleString();
                const meta = e.metadata && typeof e.metadata === "object" 
                    ? Object.entries(e.metadata).filter(([k,v]) => v && k !== "user_agent")
                        .map(([k,v]) => `<span style="opacity:0.6;font-size:0.72rem;">${k}: ${v}</span>`).join(" · ")
                    : "";
                timelineHtml += `
                <div style="position:relative;margin-bottom:1rem;padding:0.75rem;background:rgba(255,255,255,0.04);border-radius:8px;border-left:3px solid ${cfg.color}40;">
                    <div style="position:absolute;left:-1.8rem;top:50%;transform:translateY(-50%);width:1.2rem;height:1.2rem;background:${cfg.color};border-radius:50%;display:flex;align-items:center;justify-content:center;">
                        <i class="fa-solid ${cfg.icon}" style="font-size:0.55rem;color:white;"></i>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <strong style="color:${cfg.color};text-transform:capitalize;">${e.event_type}</strong>
                        <small style="opacity:0.5;">${ts}</small>
                    </div>
                    ${meta ? `<div style="margin-top:0.25rem;">${meta}</div>` : ""}
                </div>`;
            });
            timelineHtml += `</div>`;
        }

        // Show in a simple alert-style modal
        const overlay = document.createElement("div");
        overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);`;
        overlay.innerHTML = `
            <div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:1.5rem;width:90%;max-width:500px;max-height:80vh;overflow-y:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h3 style="margin:0;"><i class="fa-solid fa-timeline" style="color:#f59e0b;margin-right:0.5rem;"></i>Event Timeline</h3>
                    <button onclick="this.closest('.overlay-modal').remove()" style="background:none;border:none;color:white;font-size:1.2rem;cursor:pointer;opacity:0.7;">✕</button>
                </div>
                ${timelineHtml}
            </div>`;
        overlay.classList.add("overlay-modal");
        overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);

    } catch (err) {
        showToast("Failed to load event timeline.", "error");
    }
}

async function deleteShareEntry(shareId) {
    if (!confirm("Permanently delete this share log entry and all its tracking events?")) return;
    try {
        await API.request(`/api/share/${shareId}`, { method: "DELETE" });
        showToast("Share log deleted successfully.", "success");
        loadHistoryData();
    } catch (err) {
        showToast("Failed to delete share log.", "error");
    }
}

function filterHistory(query) {
    const q = query.toLowerCase();
    const filtered = shareHistoryList.filter(l => 
        (l.contact_name && l.contact_name.toLowerCase().includes(q)) || 
        (l.user_name && l.user_name.toLowerCase().includes(q)) || 
        (l.template_name && l.template_name.toLowerCase().includes(q)) || 
        (l.campaign_name && l.campaign_name.toLowerCase().includes(q))
    );
    renderHistoryTable(filtered);
}



// --- 6. SETTINGS VIEW CONTROLLER ---
async function loadSettingsData() {
    try {
        const settings = await API.getSettings();
        
        // Update input views
        const sharingMode = settings.sharing_mode || "manual";
        const radios = document.getElementsByName("sharing_mode");
        radios.forEach(r => {
            if (r.value === sharingMode) r.checked = true;
        });

        // Trigger settings box visibility
        const card = document.getElementById("api-credentials-card");
        if (sharingMode === "api") {
            card.classList.remove("hidden");
        } else {
            card.classList.add("hidden");
        }

        document.getElementById("settings-phone-id").value = settings.meta_phone_id || "";
        document.getElementById("settings-access-token").value = settings.meta_access_token || "";

        // DB Status Indicator
        const indicator = document.getElementById("db-connection-indicator");
        const title = document.getElementById("db-connection-title");
        const desc = document.getElementById("db-connection-desc");
        
        // SQLite vs Supabase detection
        if (settings.is_supabase) {
            title.innerText = "Cloud DB (Supabase) Active";
            desc.innerText = "Connected to Supabase PostgreSQL cloud instance and Supabase Blob Storage.";
            indicator.className = "db-indicator active";
        } else {
            title.innerText = "Local DB (SQLite) Active";
            desc.innerText = "Running in default zero-config SQLite state. Provide Supabase environment variables in .env to sync with cloud.";
            indicator.className = "db-indicator active";
        }

    } catch (err) {
        showToast("Failed to fetch settings configuration.", "error");
    }
}

async function saveSettingsConfig() {
    const activeRadio = Array.from(document.getElementsByName("sharing_mode")).find(r => r.checked);
    const settingsData = {
        sharing_mode: activeRadio ? activeRadio.value : "manual",
        meta_phone_id: document.getElementById("settings-phone-id").value,
        meta_access_token: document.getElementById("settings-access-token").value
    };

    try {
        await API.saveSettings(settingsData);
        showToast("Configuration saved successfully.", "success");
        loadSettingsData();
    } catch (err) {
        showToast("Failed to save settings.", "error");
    }
}


// --- 7. DESIGN STUDIO & PERSONALIZATION OVERLAY PORTALS ---

// Enter full page design workspace
function enterDesignStudio(templateId) {
    const template = templatesList.find(t => t.id === templateId);
    if (!template) return;
    
    activeTemplate = template;
    
    // Hide standard layout, show fullscreen overlay
    document.getElementById("app-view").classList.add("hidden");
    document.getElementById("editor-layout-view").classList.remove("hidden");
    
    document.getElementById("editor-template-name").innerText = template.name;
    document.getElementById("editor-template-category").innerText = template.category;

    // Load background canvas Designer
    initDesignerCanvas(template.background_url);
}

function exitEditor() {
    document.getElementById("editor-layout-view").classList.add("hidden");
    document.getElementById("app-view").classList.remove("hidden");
    loadTemplatesData();
}

async function saveEditorLayout() {
    if (!designerCanvas || !activeTemplate) return;
    
    // Compile fabric coordinates
    const objects = designerCanvas.getObjects();
    const fieldsData = [];
    
    objects.forEach(obj => {
        if (obj === designerCanvas.backgroundImage) return;
        fieldsData.push(getPercentCoords(obj));
    });

    try {
        showToast("Saving template layouts...", "info");
        await API.saveTemplateFields(activeTemplate.id, fieldsData);
        showToast("Template layout saved successfully!", "success");
        exitEditor();
    } catch (err) {
        showToast("Failed to save template fields.", "error");
    }
}

// Enter Personalization Panel
async function enterPersonalizerPanel(templateId) {
    try {
        const [tpl, contacts] = await Promise.all([API.getTemplate(templateId), API.getContacts()]);
        selectedTemplateForShare = tpl;
        contactsList = contacts;
        selectedContactsForShare = [];

        // Full Screen panel override
        document.getElementById("app-view").classList.add("hidden");
        document.getElementById("personalize-layout-view").classList.remove("hidden");

        document.getElementById("personalize-template-name").innerText = tpl.name;

        // Render sharing contacts selector list
        renderShareContactsList(contactsList);
        
        // Reset selections
        document.getElementById("select-all-contacts-cb").checked = false;
        document.getElementById("selected-contacts-count").innerText = "0 selected";
        
        // Default to first contact if available
        if (contactsList.length > 0) {
            selectContactForPreview(contactsList[0].id);
        } else {
            // Render without specific contact
            activeContactForPreview = null;
            personalizationOverrides = {};
            renderOverridesSidebar(tpl.fields, null);
            initPreviewCanvas(tpl, null);
        }

    } catch (err) {
        showToast("Failed to open template customizer.", "error");
    }
}

function exitPersonalizer() {
    document.getElementById("personalize-layout-view").classList.add("hidden");
    document.getElementById("app-view").classList.remove("hidden");
    loadTemplatesData();
}

function renderShareContactsList(contacts) {
    const container = document.getElementById("share-contacts-list");
    container.innerHTML = "";

    if (contacts.length === 0) {
        container.innerHTML = `<div class="empty-state text-center mt-20">No contacts found. Please add contacts to share.</div>`;
        return;
    }

    contacts.forEach(c => {
        const isChecked = selectedContactsForShare.includes(c.id) ? "checked" : "";
        const isActiveClass = activeContactForPreview && activeContactForPreview.id === c.id ? "active" : "";

        const item = document.createElement("div");
        item.className = `share-contact-item ${isActiveClass}`;
        item.innerHTML = `
            <label class="checkbox-container" onclick="event.stopPropagation()">
                <input type="checkbox" name="share_contact_cb" value="${c.id}" ${isChecked} onchange="toggleSelectContact(${c.id}, this.checked)">
                <span class="checkmark"></span>
            </label>
            <div class="share-contact-avatar">${c.name.substring(0, 2).toUpperCase()}</div>
            <div class="share-contact-info" onclick="selectContactForPreview(${c.id})">
                <span class="share-contact-name">${c.name}</span>
                <span class="share-contact-phone">+${c.mobile}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

function filterShareContacts(query) {
    const q = query.toLowerCase();
    const filtered = contactsList.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.company.toLowerCase().includes(q) || 
        c.mobile.includes(q)
    );
    renderShareContactsList(filtered);
}

function toggleSelectContact(contactId, isChecked) {
    if (isChecked) {
        if (!selectedContactsForShare.includes(contactId)) {
            selectedContactsForShare.push(contactId);
        }
    } else {
        selectedContactsForShare = selectedContactsForShare.filter(id => id !== contactId);
    }
    
    // Sync counts
    document.getElementById("selected-contacts-count").innerText = `${selectedContactsForShare.length} selected`;
}

function toggleSelectAllContacts(isChecked) {
    const checkboxes = document.getElementsByName("share_contact_cb");
    selectedContactsForShare = [];

    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const cId = parseInt(cb.value);
        if (isChecked) {
            selectedContactsForShare.push(cId);
        }
    });

    document.getElementById("selected-contacts-count").innerText = `${selectedContactsForShare.length} selected`;
}

function selectContactForPreview(contactId) {
    const contact = contactsList.find(c => c.id === contactId);
    if (!contact) return;

    activeContactForPreview = contact;
    personalizationOverrides = {}; // Reset overrides

    // Add active layout highlight
    const items = document.querySelectorAll(".share-contact-item");
    items.forEach(el => el.classList.remove("active"));
    
    // Auto check if not already checked for safety
    if (!selectedContactsForShare.includes(contactId)) {
        selectedContactsForShare.push(contactId);
        document.getElementById("selected-contacts-count").innerText = `${selectedContactsForShare.length} selected`;
        
        // Re-render list to show checked
        renderShareContactsList(contactsList);
    }

    // Populate profile cards
    document.getElementById("preview-contact-name").innerText = contact.name;
    document.getElementById("preview-contact-mobile").innerText = `+${contact.mobile}`;
    document.getElementById("preview-contact-company").innerText = contact.company ? `${contact.designation} at ${contact.company}` : "No Company Profile";

    // Populate overrides panel
    renderOverridesSidebar(selectedTemplateForShare.fields, contact);

    // Initialize Canvas preview
    initPreviewCanvas(selectedTemplateForShare, contact);
}

function renderOverridesSidebar(fields, contact) {
    const container = document.getElementById("override-fields-box");
    container.innerHTML = "";

    fields.forEach(f => {
        if (f.type !== "text") return; // Keep it text simple override for demo
        
        const group = document.createElement("div");
        group.className = "form-group";
        
        const fieldKey = f.name;
        let defaultVal = "";
        if (contact) {
            if (fieldKey === "Name") defaultVal = contact.name;
            else if (fieldKey === "Mobile") defaultVal = contact.mobile;
            else if (fieldKey === "Company") defaultVal = contact.company;
            else if (fieldKey === "Designation") defaultVal = contact.designation;
            else defaultVal = contact[fieldKey.toLowerCase()] || "";
        }

        group.innerHTML = `
            <label>${f.name} Value</label>
            <input type="text" value="${defaultVal}" oninput="updatePersonalizationOverride('${f.name}', this.value)">
        `;
        container.appendChild(group);
    });
}

function updatePersonalizationOverride(fieldName, value) {
    personalizationOverrides[fieldName] = value;
    // Re-render Preview canvas live
    initPreviewCanvas(selectedTemplateForShare, activeContactForPreview, personalizationOverrides);
}

// Generate image and trigger client download
async function generateAndDownloadImage() {
    if (!selectedTemplateForShare) return;
    
    showToast("Generating high-resolution image...", "info");
    const base64 = await renderHighResBase64(selectedTemplateForShare, activeContactForPreview, personalizationOverrides);
    
    const link = document.createElement("a");
    link.download = `creative_${selectedTemplateForShare.name.replace(/\s+/g, '_')}.png`;
    link.href = base64;
    link.click();
    showToast("Image downloaded successfully!", "success");
}

// Bulk sharing WhatsApp loops
async function initiateBulkWhatsAppSend() {
    if (selectedContactsForShare.length === 0) {
        showToast("Please select at least one contact to share.", "error");
        return;
    }

    const total = selectedContactsForShare.length;

    // Single Contact Share Bypass: Instant click-to-chat link popup
    if (total === 1) {
        const cId = selectedContactsForShare[0];
        const contact = contactsList.find(c => c.id === cId);
        if (!contact) return;

        showToast(`Preparing creative for ${contact.name}...`, "info");
        const targetOverrides = activeContactForPreview && activeContactForPreview.id === cId ? personalizationOverrides : {};
        const base64Image = await renderHighResBase64(selectedTemplateForShare, contact, targetOverrides);

        // Copy the generated creative directly to the user's clipboard
        await copyImageToClipboard(base64Image);

        try {
            const res = await API.shareCreative(contact.id, selectedTemplateForShare.id, null, base64Image);
            if (res.channel === "manual" && res.whatsapp_url) {
                window.open(res.whatsapp_url, "_blank");
                showToast("WhatsApp Web opened! Just press Ctrl+V inside the chat box to paste and send the image.", "success");
            } else {
                showToast("Creative shared via Business API successfully!", "success");
            }
        } catch (err) {
            showToast(`Failed to share: ${err.message}`, "error");
        }
        loadHistoryData();
        return;
    }

    // Confirm execution for multiple bulk contacts
    if (!confirm(`Confirm: You are sharing this creative with ${total} contact(s) via WhatsApp?`)) return;

    // Reset progress spinner modal
    const logEl = document.getElementById("sharing-progress-log");
    logEl.innerHTML = "";
    document.getElementById("sharing-progress-title").innerText = "Preparing creative batch...";
    document.getElementById("sharing-progress-subtitle").innerText = `0 / ${selectedContactsForShare.length} creatives processed`;
    document.getElementById("sharing-progress-bar").style.width = "0%";
    document.getElementById("sharing-progress-footer").style.display = "none";

    openModal("modal-sharing-progress");

    let count = 0;

    for (let cId of selectedContactsForShare) {
        const contact = contactsList.find(c => c.id === cId);
        if (!contact) continue;

        appendProgressLog(`[${count+1}/${total}] Rendering creative for ${contact.name}...`);
        
        // Generate high resolution creative output
        // Calculate dynamic overrides if preview matches target. Otherwise compile fresh from record.
        const targetOverrides = activeContactForPreview && activeContactForPreview.id === cId ? personalizationOverrides : {};
        const base64Image = await renderHighResBase64(selectedTemplateForShare, contact, targetOverrides);

        appendProgressLog(`[${count+1}/${total}] Sending creative for ${contact.name} via WhatsApp...`);

        try {
            const res = await API.shareCreative(contact.id, selectedTemplateForShare.id, null, base64Image);
            
            if (res.channel === "manual" && res.whatsapp_url) {
                // For manual mode, we open a tab to wa.me click to chat
                window.open(res.whatsapp_url, "_blank");
                appendProgressLog(`<span style="color: #6366f1;">[SUCCESS] WhatsApp Web URL opened for manual share to ${contact.name}.</span>`);
            } else {
                appendProgressLog(`<span style="color: #10b981;">[SUCCESS] Direct Business API dispatch submitted for ${contact.name}.</span>`);
            }
        } catch (err) {
            appendProgressLog(`<span style="color: #ef4444;">[FAILED] Share failed for ${contact.name}: ${err.message}</span>`);
        }

        count++;
        // Update widgets
        document.getElementById("sharing-progress-title").innerText = "Processing sharing dispatch...";
        document.getElementById("sharing-progress-subtitle").innerText = `${count} / ${total} creatives processed`;
        document.getElementById("sharing-progress-bar").style.width = `${(count / total) * 100}%`;
        
        // Introduce small 1s gap to prevent pop-up blocker issues or API load spikes
        await new Promise(r => setTimeout(r, 1000));
    }

    // Loop finished
    appendProgressLog("<span style='font-weight: bold; color: #10b981;'>All creative sharing jobs completed!</span>");
    document.getElementById("sharing-progress-title").innerText = "Creative Share Jobs Complete!";
    document.getElementById("sharing-progress-footer").style.display = "block";
    
    // Force reload share history in background
    loadHistoryData();
}

function appendProgressLog(msg) {
    const logEl = document.getElementById("sharing-progress-log");
    const div = document.createElement("div");
    div.innerHTML = msg;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight; // Auto-scroll
}


// --- 8. UI HELPERS (MODALS & TOASTS) ---
function openModal(modalId) {
    document.getElementById(modalId).classList.remove("hidden");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add("hidden");
}

function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let iconClass = "fa-solid fa-circle-info";
    if (type === "success") iconClass = "fa-solid fa-circle-check";
    else if (type === "error") iconClass = "fa-solid fa-triangle-exclamation";
    
    toast.innerHTML = `
        <i class="${iconClass}"></i>
        <div>${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = "slideIn 0.3s reverse forwards";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function togglePasswordVisibility(inputId, btnId) {
    const passwordInput = document.getElementById(inputId);
    const toggleBtnIcon = document.querySelector(`#${btnId} i`);
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleBtnIcon.className = "fa-regular fa-eye-slash";
    } else {
        passwordInput.type = "password";
        toggleBtnIcon.className = "fa-regular fa-eye";
    }
}

async function copyImageToClipboard(base64Data) {
    try {
        const res = await fetch(base64Data);
        const blob = await res.blob();
        await navigator.clipboard.write([
            new ClipboardItem({
                [blob.type]: blob
            })
        ]);
        showToast("Image copied to clipboard! Paste (Ctrl+V) in the chat window.", "success");
    } catch (err) {
        console.error("Clipboard copy failed:", err);
        showToast("Could not copy image to clipboard automatically. You can download and drag it.", "warning");
    }
}


