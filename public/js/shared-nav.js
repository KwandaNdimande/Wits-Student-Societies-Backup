let sharedNavUserName = localStorage.getItem('userName') || 'Guest';
let sharedNavUserRole = localStorage.getItem('userRole') || '';
let sharedNotificationEvents = [];
let sharedNotificationError = '';
let sharedNotificationOutsideClickReady = false;

function capitalizeRole(role) {
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
}

function getSharedNavLinks() {
    const leaderLinks = [
        { href: '/leader/dashboard.html', label: 'Dashboard' },
        { href: '/leader/announcements.html', label: 'Announcements' },
        { href: '/leader/my-requests.html', label: 'My Requests' },
        { href: '/leader/new-request.html', label: 'New Request' },
        { href: '/leader/documents.html', label: 'Documents' },
        { href: '/chatbot.html', label: 'SGO Assistant' }
    ];

    const officerLinks = [
        { href: '/officer/dashboard.html', label: 'Dashboard' },
        { href: '/officer/announcements.html', label: 'Announcements' },
        { href: '/officer/all-requests.html', label: 'All Requests' },
        { href: '/officer/societies.html', label: 'Manage Societies' },
        { href: '/officer/reports.html', label: 'Reports' },
        { href: '/officer/documents.html', label: 'Documents' }
    ];

    return sharedNavUserRole === 'officer' ? officerLinks : leaderLinks;
}

function getSharedNotificationIds(role) {
    return role === 'officer'
        ? { button: 'officerNotificationBell', badge: 'officerNotificationCount', dropdown: 'officerNotificationDropdown' }
        : { button: 'notificationBell', badge: 'notificationCount', dropdown: 'notificationDropdown' };
}

function getSharedNotificationMarkup(role) {
    const ids = getSharedNotificationIds(role);
    return `
        <div class="nav-bell">
            <button id="${ids.button}" class="nav-bell-btn" type="button" aria-label="Notifications" aria-haspopup="true" aria-expanded="false" aria-controls="${ids.dropdown}">
                <span aria-hidden="true">🔔</span>
                <span id="${ids.badge}" class="notification-badge hidden">0</span>
            </button>
            <div id="${ids.dropdown}" class="notification-dropdown" role="region" aria-label="Notifications">
                <div class="notification-item empty">Loading notifications...</div>
            </div>
        </div>
    `;
}

function getSharedTimestampMs(timestamp) {
    if (!timestamp) return 0;
    if (typeof timestamp === 'number') return timestamp;
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
    if (typeof timestamp === 'string') return Date.parse(timestamp) || 0;
    if (timestamp.seconds) return timestamp.seconds * 1000 + Math.round((timestamp.nanoseconds || 0) / 1e6);
    return 0;
}

function collectSharedNotificationEvents(requests, role, lastSeen) {
    const events = [];
    requests.forEach(request => {
        if (role === 'officer') {
            const timestamp = getSharedTimestampMs(request.submittedAt);
            if (timestamp > lastSeen) events.push({ request, timestamp });
            return;
        }

        (request.statusHistory || []).forEach(entry => {
            const timestamp = getSharedTimestampMs(entry.timestamp);
            if (entry.actorRole === 'officer' && timestamp > lastSeen) {
                events.push({ request, entry, timestamp });
            }
        });
    });
    return events.sort((a, b) => b.timestamp - a.timestamp);
}

function renderSharedNotifications() {
    if (!sharedNavUserRole) return;
    const ids = getSharedNotificationIds(sharedNavUserRole);
    const badge = document.getElementById(ids.badge);
    const dropdown = document.getElementById(ids.dropdown);
    if (!dropdown) return;

    if (sharedNotificationError) {
        if (badge) badge.classList.add('hidden');
        dropdown.innerHTML = `<div class="notification-item empty">${escapeHtml(sharedNotificationError)}</div>`;
        return;
    }

    if (badge) {
        if (sharedNotificationEvents.length > 0) {
            badge.textContent = String(sharedNotificationEvents.length);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    if (sharedNotificationEvents.length === 0) {
        const emptyMessage = sharedNavUserRole === 'officer' ? 'No new submissions.' : 'No new request updates.';
        dropdown.innerHTML = `<div class="notification-item empty">${emptyMessage}</div>`;
        return;
    }

    dropdown.innerHTML = sharedNotificationEvents.slice(0, 5).map(event => {
        const request = event.request;
        const title = request.itemName || request.name || (sharedNavUserRole === 'officer' ? 'New Request' : 'Request');
        const href = sharedNavUserRole === 'officer'
            ? `/officer/all-requests.html?openRequest=${encodeURIComponent(request.id)}`
            : `/leader/my-requests.html?openRequest=${encodeURIComponent(request.id)}`;
        const meta = `${request.societyName || (sharedNavUserRole === 'officer' ? 'Leader' : '')} · ${new Date(event.timestamp).toLocaleString()}`;
        const detail = sharedNavUserRole === 'officer'
            ? 'New submission received.'
            : `${event.entry.status || 'Updated'}${event.entry.note ? ` — ${event.entry.note}` : ''}`;

        return `
            <a class="notification-item" href="${escapeHtml(href)}">
                <div class="title">${escapeHtml(title)}</div>
                <div class="meta">${escapeHtml(meta)}</div>
                <div class="note">${escapeHtml(detail)}</div>
            </a>
        `;
    }).join('');
}

async function loadSharedNotifications(uid, role) {
    sharedNotificationError = '';
    sharedNotificationEvents = [];
    renderSharedNotifications();

    try {
        const requests = firebase.firestore().collection('requests');
        const snapshot = role === 'leader'
            ? await requests.where('submittedBy', '==', uid).get()
            : await requests.get();
        const requestData = [];
        snapshot.forEach(doc => requestData.push({ id: doc.id, ...doc.data() }));
        const lastSeenKey = role === 'officer' ? 'officerNotificationsLastSeen' : 'leaderNotificationsLastSeen';
        const lastSeen = Number(localStorage.getItem(lastSeenKey) || 0);
        sharedNotificationEvents = collectSharedNotificationEvents(requestData, role, Number.isFinite(lastSeen) ? lastSeen : 0);
        renderSharedNotifications();
    } catch (error) {
        console.error('Error loading shared notifications:', error);
        sharedNotificationError = 'Could not load notifications. Please try again.';
        renderSharedNotifications();
    }
}

function closeSharedNotificationDropdown() {
    if (!sharedNavUserRole) return;
    const ids = getSharedNotificationIds(sharedNavUserRole);
    const button = document.getElementById(ids.button);
    const dropdown = document.getElementById(ids.dropdown);
    if (dropdown) dropdown.classList.remove('active');
    if (button) button.setAttribute('aria-expanded', 'false');
}

function toggleSharedNotificationDropdown() {
    if (!sharedNavUserRole) return;
    const ids = getSharedNotificationIds(sharedNavUserRole);
    const button = document.getElementById(ids.button);
    const badge = document.getElementById(ids.badge);
    const dropdown = document.getElementById(ids.dropdown);
    if (!button || !dropdown) return;

    const isOpen = dropdown.classList.toggle('active');
    button.setAttribute('aria-expanded', String(isOpen));
    if (!isOpen) return;

    const lastSeenKey = sharedNavUserRole === 'officer' ? 'officerNotificationsLastSeen' : 'leaderNotificationsLastSeen';
    try {
        localStorage.setItem(lastSeenKey, String(Date.now()));
        if (badge) badge.classList.add('hidden');
    } catch (error) {
        console.error('Could not update notification read state:', error);
    }
}

function initSharedNotifications() {
    if (sharedNotificationOutsideClickReady) return;
    sharedNotificationOutsideClickReady = true;

    document.addEventListener('click', event => {
        if (event.target?.closest?.('.nav-bell')) return;
        closeSharedNotificationDropdown();
    });

    if (!window.firebase || !firebase.apps.length) {
        console.error('Firebase is not available for shared notifications.');
        sharedNotificationError = 'Notifications are unavailable.';
        return;
    }

    firebase.auth().onAuthStateChanged(async user => {
        if (!user) return;
        if (!user.emailVerified) {
            sharedNotificationError = 'Verify your email to view notifications.';
            renderSharedNotifications();
            return;
        }

        try {
            const userSnapshot = await firebase.firestore().collection('users').doc(user.uid).get();
            if (!userSnapshot.exists) throw new Error('No user profile found for the signed-in account.');
            const profile = userSnapshot.data();
            const role = profile.role || 'leader';
            if (role !== 'officer' && role !== 'leader') throw new Error(`Unsupported account role: ${role}`);

            sharedNavUserRole = role;
            sharedNavUserName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
                || profile.email || user.email || 'Name not recorded';
            if (typeof authGuardSetHints === 'function') {
                authGuardSetHints(user.uid, role, sharedNavUserName);
            }

            updateNavigation();
            await loadSharedNotifications(user.uid, role);
        } catch (error) {
            console.error('Error initializing shared navigation:', error);
            sharedNotificationError = 'Could not verify your account for notifications.';
            renderSharedNotifications();
        }
    });
}

function createSharedNavStyles() {
    if (document.getElementById('shared-nav-styles')) return;

    const style = document.createElement('style');
    style.id = 'shared-nav-styles';
    style.textContent = `
        /* ================================================================
           FIX: Ensure body has enough padding to clear the fixed nav
           ================================================================ */
        body {
            margin: 0;
            padding-top: 0; /* Will be set dynamically by JavaScript */
            transition: padding-top 0.15s ease;
        }

        .nav-links {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
            justify-content: flex-start;
            padding: 16px 24px;
            background: rgba(11, 31, 58, 0.96);
            backdrop-filter: saturate(180%) blur(16px);
            -webkit-backdrop-filter: saturate(180%) blur(16px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
            min-height: 70px; /* Ensures nav always has a minimum height */
        }
        .nav-links .nav-user-info {
            width: 100%;
            color: #8FA6CC;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .nav-links a {
            color: #E2E8F0;
            text-decoration: none;
            padding: 8px 16px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            background: transparent;
        }
        .nav-links a:hover {
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
            border-color: rgba(255, 255, 255, 0.28);
        }
        .nav-links a.active {
            background: #fff;
            color: #0B1F3A;
            border-color: #fff;
        }
        .nav-links a.logout-link {
            border-color: rgba(220, 53, 69, 0.4);
            color: #f8d7da;
        }
        .nav-links a.logout-link:hover {
            background: rgba(220, 53, 69, 0.2);
            border-color: #dc3545;
            color: #fff;
        }
        .nav-bell {
            position: relative;
            display: inline-flex;
            align-items: center;
        }
        .nav-bell-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #8FA6CC;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 999px;
            padding: 8px 12px;
            cursor: pointer;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
        }
        .nav-bell-btn:hover {
            background: rgba(255,255,255,0.12);
        }
        .nav-bell-btn:focus-visible {
            outline: 2px solid #8FA6CC;
            outline-offset: 2px;
        }
        .notification-badge {
            min-width: 18px;
            height: 18px;
            padding: 0 6px;
            border-radius: 999px;
            background: #E53935;
            color: #fff;
            font-size: 11px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .notification-badge.hidden {
            display: none;
        }
        .notification-dropdown {
            position: absolute;
            top: calc(100% + 10px);
            left: 0;
            width: 320px;
            max-width: calc(100vw - 24px);
            background: #fff;
            color: #0B1F3A;
            border: 1px solid #E1E7F0;
            border-radius: 14px;
            box-shadow: 0 18px 48px rgba(0,0,0,0.16);
            z-index: 1000;
            display: none;
        }
        .notification-dropdown.active {
            display: block;
        }
        .notification-item {
            display: block;
            padding: 14px 16px;
            border-bottom: 1px solid #E1E7F0;
            cursor: pointer;
            color: #3D4A63;
            text-decoration: none;
        }
        .notification-item:last-child {
            border-bottom: none;
        }
        .notification-item:hover {
            background: #F4F7FB;
            color: #3D4A63;
        }
        .notification-item .title {
            font-weight: 700;
            color: #0B1F3A;
            margin-bottom: 5px;
        }
        .notification-item .meta {
            font-size: 12px;
            color: #5A6B87;
        }
        .notification-item .note {
            margin-top: 8px;
            font-size: 13px;
            color: #3D4A63;
        }
        .notification-item.empty {
            cursor: default;
            color: #5A6B87;
        }
    @media (max-width: 768px) {
    .nav-links {
        justify-content: center;
        padding: 12px 12px;
        gap: 6px;
        min-height: 60px;
    }

    .nav-links .nav-user-info {
        text-align: center;
        margin-bottom: 6px;
        width: 100%;
    }

    .nav-links a {
        font-size: 12px;
        padding: 7px 10px;
        white-space: nowrap;
    }

    body {
        padding-top: 0;
    }
}

@media (max-width: 480px) {
    .nav-links {
        padding: 10px 8px;
        gap: 5px;
    }

    .nav-links .nav-user-info {
        font-size: 12px;
        margin-bottom: 5px;
    }

    .nav-links a {
        font-size: 11px;
        padding: 6px 8px;
    }
}
    `;
    document.head.appendChild(style);
}

function isSharedNavActiveLink(href) {
    const current = window.location.pathname.toLowerCase();
    const normalized = href.toLowerCase();
    if (current === normalized) return true;
    return false;
}

// ================================================================
// AUTO-NAV-PADDING FIX: Dynamically adjusts body padding
// ================================================================

function applyNavPadding(navElement) {
    if (!navElement) {
        // Fallback: if nav not found, use a safe default
        document.body.style.paddingTop = '80px';
        return;
    }

    // Get the actual height of the navigation (including padding, border, etc.)
    const navHeight = navElement.offsetHeight;

    // Add a small buffer (10px) for visual comfort
    const paddingTop = navHeight + 10;

    // Apply the padding to the body
    document.body.style.paddingTop = paddingTop + 'px';

    // Also ensure body margin is removed (already done via CSS)
    document.body.style.marginTop = '0';
}

// ================================================================
// ORIGINAL FUNCTION (replaced with enhanced version above)
// ================================================================

function adjustSharedNavBodyPadding(navElement) {
    applyNavPadding(navElement);
}

// ================================================================
// UPDATE NAVIGATION
// ================================================================

function updateNavigation() {
    createSharedNavStyles();

    // Redirect officer if trying to access chatbot
    if (window.location.pathname.toLowerCase().endsWith('/chatbot.html') && sharedNavUserRole === 'officer') {
        window.location.href = '/officer/dashboard.html';
        return;
    }

    let navLinks = document.querySelector('.nav-links');
    if (!navLinks) {
        navLinks = document.createElement('div');
        navLinks.className = 'nav-links';
        document.body.insertBefore(navLinks, document.body.firstChild);
    }

        const userInfoHtml = `<div class="nav-user-info">${escapeHtml(sharedNavUserName)}${escapeHtml(sharedNavUserRole ? ' · ' + capitalizeRole(sharedNavUserRole) : '')}</div>`;

    const links = getSharedNavLinks();
    const linksHtml = links.map(link => {
        const activeClass = isSharedNavActiveLink(link.href) ? ' class="active"' : '';
        return `<a href="${link.href}"${activeClass}>${link.label}</a>`;
    }).join('');
    const logoutHtml = `<a href="/login.html" class="logout-link">Logout</a>`;

    navLinks.innerHTML = `${userInfoHtml}${linksHtml}${sharedNavUserRole ? getSharedNotificationMarkup(sharedNavUserRole) : ''}${logoutHtml}`;

    const notificationButton = navLinks.querySelector('.nav-bell-btn');
    if (notificationButton) {
        notificationButton.addEventListener('click', toggleSharedNotificationDropdown);
        renderSharedNotifications();
    }

    // Apply the padding fix AFTER the nav is fully rendered
    // Use requestAnimationFrame to ensure the browser has painted the nav
    requestAnimationFrame(() => {
        applyNavPadding(navLinks);
    });

    // Also apply after a slight delay to catch any layout shifts
    setTimeout(() => {
        applyNavPadding(navLinks);
    }, 50);

    // Logout handler
    const logoutLink = navLinks.querySelector('a.logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', function(event) {
            event.preventDefault();
            if (confirm('Are you sure you want to log out?')) {
                appSignOut(); // signs out of Firebase, clears the saved details, goes to login
            }
        });
    }
}

// ================================================================
// INITIALIZATION
// ================================================================

function initSharedNav() {
    initSharedNotifications();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateNavigation);
    } else {
        updateNavigation();
    }

    // Recalculate padding on window resize (debounced)
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                applyNavPadding(navLinks);
            }
        }, 150);
    });

    // Also recalculate if the DOM changes (e.g., dynamic content loads)
    // Use MutationObserver to watch for changes to the nav
    const observer = new MutationObserver(function() {
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            applyNavPadding(navLinks);
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });
}

// Start the navigation system
initSharedNav();