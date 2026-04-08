
(function () {
    'use strict';

    const PB_URL = "http://pocketbase-ibyjaiyoq2lcp9zjrljbd7wa.176.112.158.3.sslip.io";
    const pb = new PocketBase(PB_URL);
    window.pb = pb;

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function $(id) { return document.getElementById(id); }

    function show(el) { if (el) el.classList.remove('hidden'); }
    function hide(el) { if (el) el.classList.add('hidden'); }

    function debounce(fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    function statusLabel(status) {
        return status === 'in_use' ? 'In Use' : 'Available';
    }

    function csvCell(value) {
        const str = String(value ?? '').replace(/"/g, '""');
        if (/^[=+\-@\t\r]/.test(str)) return `"'${str}"`;
        return `"${str}"`;
    }

    function buildDeviceCard(dev, options) {
        const { isPro, canEdit } = options;
        const assignee = dev.expand?.assigned_to;
        const assigneeEmail = assignee ? assignee.email : 'None';

        const card = document.createElement('div');
        card.className = 'device-card animate-fade-in';

        const title = document.createElement('h3');
        title.style.marginBottom = '0.5rem';
        title.textContent = dev.name;
        card.appendChild(title);

        const badge = document.createElement('span');
        badge.className = `status-badge status-${dev.status}`;
        badge.textContent = statusLabel(dev.status);
        card.appendChild(badge);

        const details = document.createElement('div');
        details.style.cssText = 'margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border-color);';

        const userLine = document.createElement('div');
        userLine.style.cssText = 'font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.5rem;';
        userLine.innerHTML = '<strong>Current User:</strong> ';
        const userSpan = document.createElement('span');
        userSpan.textContent = assigneeEmail;
        userLine.appendChild(userSpan);
        details.appendChild(userLine);

        if (isPro) {
            const proLine = document.createElement('div');
            proLine.style.cssText = 'font-size:0.85rem;color:#10B981;margin-bottom:0.5rem;';
            proLine.innerHTML = '<strong>[PRO] DB ID Tracker:</strong> ';
            const idSpan = document.createElement('span');
            idSpan.textContent = assignee?.id || 'Unassigned';
            proLine.appendChild(idSpan);
            details.appendChild(proLine);
        }

        const notesLine = document.createElement('div');
        notesLine.style.cssText = 'font-size:0.85rem;color:var(--text-secondary);margin-bottom:1rem;';
        notesLine.innerHTML = '<strong>Notes:</strong> ';
        if (dev.notes) {
            const noteSpan = document.createElement('span');
            noteSpan.textContent = dev.notes;
            notesLine.appendChild(noteSpan);
        } else {
            notesLine.insertAdjacentHTML('beforeend', '<em>No notes provided</em>');
        }
        details.appendChild(notesLine);
        card.appendChild(details);

        if (canEdit) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary edit-device-btn';
            btn.style.cssText = 'padding:0.5rem 1rem;width:100%;font-size:0.9rem;';
            btn.textContent = 'Edit Device';
            btn.dataset.deviceId = dev.id;
            card.appendChild(btn);
        }

        return card;
    }

    const state = {
        adminUsers: [],
        allDevices: [],
        proEventsAttached: false
    };

    async function loadAdminUsers() {
        if (state.adminUsers.length > 0) return;
        try {
            const res = await fetch('/api/admin/users');
            if (!res.ok) throw new Error('Failed to fetch users');
            state.adminUsers = await res.json();
        } catch (e) {
            console.error('Failed to fetch users:', e);
        }
    }

    function buildUserOptions(container, selectedId) {
        container.innerHTML = '';
        const def = document.createElement('option');
        def.value = '';
        def.textContent = '-- Nobody --';
        container.appendChild(def);
        state.adminUsers.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.email;
            if (u.id === selectedId) opt.selected = true;
            container.appendChild(opt);
        });
    }

    function getDeviceById(id) {
        return state.allDevices.find(d => d.id === id) || null;
    }

    function authGuard() {
        const path = window.location.pathname;
        const isPublic = path.endsWith('index.html') || path.endsWith('register.html') || path === '/' || path === '';

        if (!pb.authStore.isValid && !isPublic) {
            window.location.href = 'index.html';
            return;
        }
        if (pb.authStore.isValid && isPublic) {
            window.location.href = 'dashboard.html';
            return;
        }

        initLoginForm();
        initRegisterForm();
        initLogout();
    }

    function initLoginForm() {
        const form = $('login-form');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = $('login-email').value.trim();
            const pass = $('login-password').value;
            if (!email || !pass) return;

            const btn = form.querySelector('button[type="submit"]');
            btn.textContent = 'Connecting...';
            btn.disabled = true;
            try {
                await pb.collection('users').authWithPassword(email, pass);
                window.location.href = 'dashboard.html';
            } catch (err) {
                alert('Login failed: ' + err.message);
                btn.textContent = 'Log In';
                btn.disabled = false;
            }
        });
    }


    function initRegisterForm() {
        const form = $('register-form');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = $('reg-email').value.trim();
            const pass = $('reg-password').value;
            const passConfirm = $('reg-password-confirm').value;
            if (!email || !pass || !passConfirm) return;

            if (pass !== passConfirm) { alert('Passwords do not match!'); return; }
            if (pass.length < 8) { alert('Password must be at least 8 characters.'); return; }

            const btn = form.querySelector('button[type="submit"]');
            btn.textContent = 'Registering...';
            btn.disabled = true;
            try {
                await pb.collection('users').create({
                    email,
                    password: pass,
                    passwordConfirm: passConfirm,
                    role: 'user',
                    is_pro: false
                });
                await pb.collection('users').authWithPassword(email, pass);
                window.location.href = 'dashboard.html';
            } catch (err) {
                alert('Registration failed: ' + err.message);
                btn.textContent = 'Create Account';
                btn.disabled = false;
            }
        });
    }

    function initLogout() {
        const btn = $('logout-btn');
        if (!btn) return;
        const emailEl = $('user-email');
        if (emailEl) emailEl.textContent = pb.authStore.model?.email || 'Unknown';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            pb.authStore.clear();
            window.location.href = 'index.html';
        });
    }

    function setupNav() {
        const user = pb.authStore.model;
        if (!user) return;

        if (user.role === 'admin') show($('admin-link'));

        const proLink = $('pro-link');
        if (proLink) {
            show(proLink);
            if (user.is_pro) {
                proLink.textContent = '\u2728 PRO Activated';
                proLink.href = '#';
            } else {
                proLink.href = 'pro.html';
            }
        }
    }

    async function initDashboard() {
        setupNav();
        await loadAdminUsers();

        const assignSelect = $('edit-device-assigned');
        if (assignSelect) buildUserOptions(assignSelect, '');

        $('device-list').addEventListener('click', onDashboardDeviceClick);
        $('update-device-form').addEventListener('submit', onDeviceUpdate);

        const user = pb.authStore.model;
        if (user.is_pro) {
            show($('pro-banner-display'));
            show($('pro-toolbar'));
        }

        await fetchAndRenderDevices();
    }

    function onDashboardDeviceClick(e) {
        const btn = e.target.closest('.edit-device-btn');
        if (!btn) return;
        const dev = getDeviceById(btn.dataset.deviceId);
        if (!dev) return;
        openNoteModal(dev);
    }

    function openNoteModal(dev) {
        $('edit-device-id').value = dev.id;
        const nameEl = $('edit-device-name');
        if (nameEl) nameEl.value = dev.name || '';
        $('edit-device-status').value = dev.status;
        $('edit-device-notes').value = dev.notes || '';
        const assignEl = $('edit-device-assigned');
        if (assignEl) buildUserOptions(assignEl, dev.assigned_to || '');
        show($('note-modal'));
    }

    async function onDeviceUpdate(e) {
        e.preventDefault();
        const id = $('edit-device-id').value;
        const status = $('edit-device-status').value;
        const notes = $('edit-device-notes').value;
        const assigned = $('edit-device-assigned').value || null;
        const nameEl = $('edit-device-name');

        const data = { status, notes, assigned_to: assigned };
        if (nameEl && nameEl.value.trim()) data.name = nameEl.value.trim();

        try {
            await pb.collection('devices').update(id, data);
            hide($('note-modal'));
            await fetchAndRenderDevices();
        } catch (err) {
            alert('Update failed: ' + err.message);
        }
    }

    async function fetchAndRenderDevices() {
        const list = $('device-list');
        list.innerHTML = '<p>Loading objects...</p>';

        try {
            state.allDevices = await pb.collection('devices').getFullList({
                expand: 'assigned_to',
                sort: '-created'
            });
            renderDevices(state.allDevices);

            if (pb.authStore.model.is_pro && !state.proEventsAttached) {
                $('pro-search').addEventListener('input', debounce(applyProFilters, 250));
                $('pro-filter').addEventListener('change', applyProFilters);
                $('pro-export-btn').addEventListener('click', exportProCSV);
                state.proEventsAttached = true;
            }
        } catch (err) {
            list.innerHTML = `<p style="color:var(--danger)">Failed to load devices: ${escapeHTML(err.message)}</p>`;
        }
    }

    function applyProFilters() {
        const query = $('pro-search').value.toLowerCase();
        const statusFilter = $('pro-filter').value;

        const filtered = state.allDevices.filter(d => {
            const text = (d.name + ' ' + (d.notes || '')).toLowerCase();
            return text.includes(query) && (statusFilter === 'all' || d.status === statusFilter);
        });
        renderDevices(filtered);
    }

    function exportProCSV() {
        const header = ['ID', 'Device Name', 'Status', 'Assigned Email', 'Notes', 'Created At'];
        const rows = [header.map(h => csvCell(h)).join(',')];

        state.allDevices.forEach(d => {
            const email = d.expand?.assigned_to?.email || 'Unassigned';
            rows.push([d.id, d.name, d.status, email, d.notes || '', d.created].map(c => csvCell(c)).join(','));
        });

        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nexus_inventory_${Date.now()}.csv`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function renderDevices(records) {
        const list = $('device-list');
        const frag = document.createDocumentFragment();
        const user = pb.authStore.model;
        const isPro = user.is_pro;
        const canEdit = user.role === 'admin' || user.role === 'employee';

        if (isPro) {
            const total = records.length;
            const inUse = records.filter(r => r.status === 'in_use').length;
            const utilization = total === 0 ? 0 : Math.round((inUse / total) * 100);

            const stats = document.createElement('div');
            stats.className = 'animate-fade-in';
            stats.style.cssText = 'grid-column:1/-1;background:rgba(16,185,129,0.1);border:1px solid var(--secondary);padding:1.5rem;border-radius:12px;margin-bottom:2rem;display:flex;justify-content:space-around;';
            stats.innerHTML = `
                <div style="text-align:center;">
                    <div style="font-size:2rem;font-weight:bold;color:var(--secondary);">${total}</div>
                    <div style="color:var(--text-secondary);font-size:0.9rem;">Total Devices</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:2rem;font-weight:bold;color:var(--danger);">${inUse}</div>
                    <div style="color:var(--text-secondary);font-size:0.9rem;">Active In-Use</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:2rem;font-weight:bold;color:#A78BFA;">${utilization}%</div>
                    <div style="color:var(--text-secondary);font-size:0.9rem;">Utilization Rate</div>
                </div>`;
            frag.appendChild(stats);
        }

        if (records.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'No devices in inventory.';
            frag.appendChild(p);
        } else {
            for (const dev of records) {
                frag.appendChild(buildDeviceCard(dev, { isPro, canEdit }));
            }
        }

        list.innerHTML = '';
        list.appendChild(frag);
    }

    async function initAdmin() {
        setupNav();
        if (pb.authStore.model.role !== 'admin') {
            alert('You do not have administrative privileges.');
            window.location.href = 'dashboard.html';
            return;
        }

        $('admin-user-list').addEventListener('click', onAdminUserAction);
        $('admin-device-list').addEventListener('change', onAdminDeviceAssign);
        $('admin-device-list').addEventListener('click', onAdminDeviceAction);
        $('add-device-form').addEventListener('submit', onAddDevice);

        await fetchAndRenderAdminUsers();
        await fetchAndRenderAdminDevices();
    }

    async function onAdminUserAction(e) {
        const btn = e.target.closest('.update-role-btn');
        if (!btn || btn.disabled) return;
        const userId = btn.dataset.userId;
        const newRole = $(`role-${userId}`).value;
        try {
            await pb.collection('users').update(userId, { role: newRole });
            alert('Role updated successfully!');
            await fetchAndRenderAdminUsers();
        } catch (err) {
            alert('Failed to update role: ' + err.message);
        }
    }

    async function onAdminDeviceAssign(e) {
        const select = e.target.closest('.assign-device-select');
        if (!select) return;
        const deviceId = select.dataset.deviceId;
        const userId = select.value;
        try {
            await pb.collection('devices').update(deviceId, {
                assigned_to: userId || null,
                status: userId ? 'in_use' : 'available'
            });
            await fetchAndRenderAdminDevices();
        } catch (err) {
            alert('Assignment failed: ' + err.message);
        }
    }

    async function onAdminDeviceAction(e) {
        const btn = e.target.closest('.delete-device-btn');
        if (!btn) return;
        if (!confirm('Are you sure you want to delete this device?')) return;
        try {
            await pb.collection('devices').delete(btn.dataset.deviceId);
            await fetchAndRenderAdminDevices();
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    }

    async function onAddDevice(e) {
        e.preventDefault();
        const name = $('new-device-name').value.trim();
        const status = $('new-device-status').value;
        if (!name) return;

        try {
            await pb.collection('devices').create({ name, status, notes: '' });
            $('add-device-form').reset();
            await fetchAndRenderAdminDevices();
        } catch (err) {
            alert('Create failed: ' + err.message);
        }
    }

    async function fetchAndRenderAdminUsers() {
        const tbody = $('admin-user-list');
        tbody.innerHTML = '<tr><td colspan="4">Loading users...</td></tr>';

        try {
            const res = await fetch('/api/admin/users');
            if (!res.ok) throw new Error('Failed to fetch from backend');
            state.adminUsers = await res.json();

            const frag = document.createDocumentFragment();
            for (const user of state.adminUsers) {
                const isSelf = user.id === pb.authStore.model.id;
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-color)';

                const tdEmail = document.createElement('td');
                tdEmail.style.padding = '1rem';
                tdEmail.textContent = user.email;
                tr.appendChild(tdEmail);

                const tdRole = document.createElement('td');
                tdRole.style.padding = '1rem';
                const select = document.createElement('select');
                select.id = `role-${user.id}`;
                select.disabled = isSelf;
                select.style.cssText = 'padding:0.25rem;border-radius:4px;';
                ['user', 'employee', 'admin'].forEach(role => {
                    const opt = document.createElement('option');
                    opt.value = role;
                    opt.textContent = role.charAt(0).toUpperCase() + role.slice(1);
                    if (user.role === role) opt.selected = true;
                    select.appendChild(opt);
                });
                tdRole.appendChild(select);
                tr.appendChild(tdRole);

                const tdPro = document.createElement('td');
                tdPro.style.cssText = `padding:1rem;color:${user.is_pro ? 'var(--secondary)' : 'var(--text-secondary)'};`;
                tdPro.textContent = user.is_pro ? 'Yes' : 'No';
                tr.appendChild(tdPro);

                const tdAction = document.createElement('td');
                tdAction.style.padding = '1rem';
                const btn = document.createElement('button');
                btn.className = 'btn btn-primary btn-sm update-role-btn';
                btn.style.cssText = 'padding:0.25rem 0.5rem;font-size:0.8rem;';
                btn.textContent = 'Update Role';
                btn.disabled = isSelf;
                btn.dataset.userId = user.id;
                tdAction.appendChild(btn);
                tr.appendChild(tdAction);

                frag.appendChild(tr);
            }

            tbody.innerHTML = '';
            tbody.appendChild(frag);
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" style="color:var(--danger);">Error: ${escapeHTML(err.message)}</td></tr>`;
        }
    }

    async function fetchAndRenderAdminDevices() {
        const tbody = $('admin-device-list');
        tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

        try {
            const records = await pb.collection('devices').getFullList({
                expand: 'assigned_to',
                sort: '-created'
            });

            const frag = document.createDocumentFragment();
            for (const dev of records) {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-color)';

                const tdName = document.createElement('td');
                tdName.style.padding = '1rem';
                const strong = document.createElement('strong');
                strong.textContent = dev.name;
                tdName.appendChild(strong);
                tr.appendChild(tdName);

                const tdStatus = document.createElement('td');
                tdStatus.style.padding = '1rem';
                const badge = document.createElement('span');
                badge.className = `status-badge status-${dev.status}`;
                badge.textContent = statusLabel(dev.status);
                tdStatus.appendChild(badge);
                tr.appendChild(tdStatus);

                const tdInfo = document.createElement('td');
                tdInfo.style.cssText = 'padding:1rem;color:var(--text-secondary);font-size:0.9rem;';

                const selectWrap = document.createElement('div');
                selectWrap.style.marginBottom = '0.5rem';
                const assignSelect = document.createElement('select');
                assignSelect.className = 'assign-device-select';
                assignSelect.dataset.deviceId = dev.id;
                assignSelect.style.cssText = 'padding:0.25rem;border-radius:4px;width:100%;';

                const defOpt = document.createElement('option');
                defOpt.value = '';
                defOpt.textContent = '-- Unassigned --';
                assignSelect.appendChild(defOpt);
                state.adminUsers.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u.id;
                    opt.textContent = u.email;
                    if (dev.assigned_to === u.id) opt.selected = true;
                    assignSelect.appendChild(opt);
                });
                selectWrap.appendChild(assignSelect);
                tdInfo.appendChild(selectWrap);

                const notesDiv = document.createElement('div');
                notesDiv.textContent = 'Notes: ' + (dev.notes || '-');
                tdInfo.appendChild(notesDiv);
                tr.appendChild(tdInfo);

                const tdDel = document.createElement('td');
                tdDel.style.padding = '1rem';
                const delBtn = document.createElement('button');
                delBtn.className = 'btn btn-danger btn-sm delete-device-btn';
                delBtn.style.cssText = 'padding:0.25rem 0.5rem;font-size:0.8rem;';
                delBtn.textContent = 'Delete';
                delBtn.dataset.deviceId = dev.id;
                tdDel.appendChild(delBtn);
                tr.appendChild(tdDel);

                frag.appendChild(tr);
            }

            tbody.innerHTML = '';
            tbody.appendChild(frag);
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" style="color:var(--danger);">Error: ${escapeHTML(err.message)}</td></tr>`;
        }
    }

    async function initProfile() {
        setupNav();
        const user = pb.authStore.model;
        $('profile-email').value = user.email || '';
        $('profile-name').value = user.name || '';

        const avatarImg = $('avatar-img');
        if (user.avatar) {
            avatarImg.src = pb.files.getUrl(user, user.avatar, { thumb: '100x100' });
        }

        const avatarInput = $('avatar-input');
        avatarInput.addEventListener('change', () => {
            if (avatarInput.files[0]) {
                avatarImg.src = URL.createObjectURL(avatarInput.files[0]);
            }
        });

        $('profile-edit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = $('profile-msg');
            msg.style.color = 'var(--text-secondary)';
            msg.textContent = 'Saving...';

            const form = new FormData();
            form.append('name', $('profile-name').value.trim());
            if (avatarInput.files.length > 0) {
                form.append('avatar', avatarInput.files[0]);
            }

            try {
                await pb.collection('users').update(user.id, form);
                msg.style.color = 'var(--success)';
                msg.textContent = 'Profile updated successfully!';
                const updated = await pb.collection('users').getOne(user.id);
                if (updated.avatar) {
                    avatarImg.src = pb.files.getUrl(updated, updated.avatar, { thumb: '100x100' });
                }
            } catch (err) {
                msg.style.color = 'var(--danger)';
                msg.textContent = 'Update failed: ' + err.message;
            }
        });

        await fetchAndRenderMyDevices();
    }

    async function fetchAndRenderMyDevices() {
        const list = $('my-devices-list');
        list.innerHTML = '<p>Loading objects...</p>';

        try {
            const userId = pb.authStore.model.id.replace(/[^a-zA-Z0-9]/g, '');
            const records = await pb.collection('devices').getFullList({
                filter: `assigned_to="${userId}"`,
                sort: '-created'
            });

            const frag = document.createDocumentFragment();
            if (records.length === 0) {
                const p = document.createElement('p');
                p.textContent = 'You have no devices assigned to you.';
                frag.appendChild(p);
            } else {
                for (const dev of records) {
                    frag.appendChild(buildDeviceCard(dev, { isPro: false, canEdit: false }));
                }
            }

            list.innerHTML = '';
            list.appendChild(frag);
        } catch (err) {
            list.innerHTML = `<p style="color:var(--danger)">Failed to load devices: ${escapeHTML(err.message)}</p>`;
        }
    }

    window.initDashboard = initDashboard;
    window.initAdmin = initAdmin;
    window.initProfile = initProfile;

    document.addEventListener('DOMContentLoaded', authGuard);
})();
