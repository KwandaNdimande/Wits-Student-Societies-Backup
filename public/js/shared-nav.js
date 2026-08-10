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
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
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
        @media (max-width: 768px) {
            .nav-links { justify-content: center; }
        }
        @media (max-width: 480px) {
            .nav-links {
                padding: 14px 16px;
                gap: 8px;
            }
            .nav-links a { font-size: 12px; padding: 6px 10px; }
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

function adjustSharedNavBodyPadding(navElement) {
    if (!navElement) return;
    const height = navElement.offsetHeight;
    if (height > 0) {
        document.body.style.paddingTop = `${height + 20}px`;
    }
}

function updateNavigation() {
    createSharedNavStyles();

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
    adjustSharedNavBodyPadding(navLinks);

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

function initSharedNav() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateNavigation);
    } else {
        updateNavigation();
    }
    window.addEventListener('resize', function() {
        const navLinks = document.querySelector('.nav-links');
        adjustSharedNavBodyPadding(navLinks);
    });
}

initSharedNav();
