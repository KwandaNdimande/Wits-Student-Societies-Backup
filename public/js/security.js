
// Shared front-end helpers: HTML escaping, the role guard, sign-out, and
// delegated handlers for file buttons. Load this before any page script.
//
// IMPORTANT: these guards only control what the browser shows. The real
// permission checks happen on the server and in Firestore rules.

// Escape any value before it is placed into an HTML string.
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function authGuardHomeFor(role) {
    return role === 'officer' ? '/officer/dashboard.html' : '/leader/dashboard.html';
}

// localStorage values are display hints only. Clear them when access ends.
function authGuardClearHints() {
    ['userUid', 'userRole', 'userName', 'userEmail', 'userSociety']
        .forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
}

function authGuardSetHints(uid, role, name) {
    try {
        localStorage.setItem('userUid', uid);
        localStorage.setItem('userRole', role);
        localStorage.setItem('userName', name);
    } catch (e) {}
}

// Resolves only for a signed-in, email-verified Firebase user whose Firestore
// role matches requiredRole (pass null to accept any role). Otherwise it
// redirects and never resolves, so page code chained after it never runs.
function requireRole(requiredRole) {
    const never = new Promise(function () {});
    return new Promise(function (resolve) {
        const unsubscribe = firebase.auth().onAuthStateChanged(async function (user) {
            unsubscribe();
            if (!user) {
                authGuardClearHints();
                window.location.replace('/login.html');
                return resolve(never);
            }
            if (!user.emailVerified) {
                window.location.replace('/verify-otp.html?resend=1');
                return resolve(never);
            }
            try {
                const snap = await firebase.firestore().collection('users').doc(user.uid).get();
                if (!snap.exists) throw new Error('No user profile');
                const profile = snap.data();
                const role = profile.role || 'leader'; // same default login.html uses

                if (requiredRole && role !== requiredRole) {
                    window.location.replace(authGuardHomeFor(role));
                    return resolve(never);
                }

                const name = ((profile.firstName || '') + ' ' + (profile.lastName || '')).trim();
                authGuardSetHints(user.uid, role, name);
                resolve({ user: user, role: role, profile: profile });
            } catch (err) {
                authGuardClearHints();
                window.location.replace('/login.html');
                resolve(never);
            }
        });
    });
}

// Signs out of Firebase, then clears the hints and returns to login.
async function appSignOut() {
    try { await firebase.auth().signOut(); } catch (e) {}
    authGuardClearHints();
    window.location.href = '/login.html';
}

// File View/Download buttons carry their values in data-* attributes, so a
// filename containing quotes cannot break out of the markup.
document.addEventListener('click', function (event) {
    if (!event.target || !event.target.closest) return;
    const btn = event.target.closest('[data-file-action]');
    if (!btn || btn.disabled) return;
    const path = btn.dataset.path || '';
    const name = btn.dataset.name || '';
    const action = btn.dataset.fileAction;
    if (action === 'view' && typeof viewFileFromSupabase === 'function') {
        viewFileFromSupabase(path, name);
    } else if (action === 'download' && typeof downloadFileFromSupabase === 'function') {
        downloadFileFromSupabase(path, name);
    }
});
