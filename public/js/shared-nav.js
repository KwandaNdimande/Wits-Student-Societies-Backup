const sharedNavUserName = localStorage.getItem('userName') || 'Guest';
const sharedNavUserRole = localStorage.getItem('userRole') || '';

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
        @media (max-width: 768px) {
            .nav-links { 
                justify-content: center;
                padding: 14px 16px;
                gap: 8px;
                min-height: 60px;
            }
            .nav-links a { 
                font-size: 12px; 
                padding: 6px 12px; 
            }
            body {
                padding-top: 0 !important; /* Let JS control it */
            }
        }
        @media (max-width: 480px) {
            .nav-links {
                padding: 12px 12px;
                gap: 6px;
                min-height: 55px;
            }
            .nav-links a { 
                font-size: 11px; 
                padding: 5px 10px; 
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

    const userInfoHtml = `<div class="nav-user-info">${sharedNavUserName}${sharedNavUserRole ? ' · ' + capitalizeRole(sharedNavUserRole) : ''}</div>`;
    const links = getSharedNavLinks();
    const linksHtml = links.map(link => {
        const activeClass = isSharedNavActiveLink(link.href) ? ' class="active"' : '';
        return `<a href="${link.href}"${activeClass}>${link.label}</a>`;
    }).join('');
    const logoutHtml = `<a href="/login.html" class="logout-link">Logout</a>`;

    navLinks.innerHTML = `${userInfoHtml}${linksHtml}${logoutHtml}`;

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
                localStorage.removeItem('userUid');
                localStorage.removeItem('userRole');
                localStorage.removeItem('userName');
                window.location.href = '/login.html';
            }
        });
    }
}

// ================================================================
// INITIALIZATION
// ================================================================

function initSharedNav() {
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