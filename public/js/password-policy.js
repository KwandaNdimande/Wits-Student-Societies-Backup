// password-policy.js
// One place that defines what a good password is. The register page uses it
// for the live checklist and strength bar.
//
// IMPORTANT: browser checks only help honest users. The real enforcement is
// the Firebase Authentication password policy (set in the Firebase console),
// which must use the same rules as below.

(function (root) {
    const MIN_LENGTH = 8;
    const MAX_LENGTH = 128;

    // The most commonly used passwords, plus ones people at a university pick.
    const COMMON = new Set([
        '123456', '1234567', '12345678', '123456789', '1234567890', '111111', '000000', '121212',
        '123123', '654321', '666666', '112233', '123321', '987654321', '12341234', '11111111',
        'password', 'passw0rd', 'pass', 'pass123', 'password1', 'password12', 'password123',
        'qwerty', 'qwerty123', 'qwertyuiop', 'qwertyui', 'asdfgh', 'asdfghjkl', 'zxcvbnm',
        '1q2w3e4r', '1qaz2wsx', 'abc123', 'abcd1234', 'abcdef', 'abcdefgh', 'abc12345',
        'letmein', 'welcome', 'welcome1', 'login', 'admin', 'administrator', 'root', 'user',
        'iloveyou', 'monkey', 'dragon', 'football', 'baseball', 'superman', 'batman',
        'sunshine', 'princess', 'master', 'shadow', 'trustno1', 'freedom', 'whatever',
        'starwars', 'hello', 'hello123', 'secret', 'changeme', 'default', 'test', 'test123',
        'summer', 'winter', 'spring', 'autumn', 'ilovegod', 'jesus', 'blessed', 'ubuntu',
        'wits', 'witsuni', 'wits1234', 'witsuniversity', 'witsstudent', 'student', 'student123',
        'students', 'university', 'johannesburg', 'joburg', 'southafrica', 'mzansi', 'sgo',
        'societies', 'society', 'leader', 'officer', 'sgo1234', 'wits2024', 'wits2025', 'wits2026'
    ]);

    // Turn look-alike characters back into letters: p@ssw0rd -> password
    function leetVariants(p) {
        const a = p.replace(/@/g, 'a').replace(/4/g, 'a').replace(/0/g, 'o')
                   .replace(/3/g, 'e').replace(/\$/g, 's').replace(/5/g, 's').replace(/7/g, 't');
        return [a.replace(/[1!|]/g, 'i'), a.replace(/[1!|]/g, 'l')];
    }

    function isCommonPassword(password) {
        const lower = String(password).toLowerCase();
        const candidates = [lower].concat(leetVariants(lower));
        for (const c of candidates) {
            if (COMMON.has(c)) return true;
            // "Welcome2026!" -> "welcome"
            const trimmed = c.replace(/^[^a-z0-9]+/, '').replace(/[^a-z]+$/, '');
            if (trimmed.length >= 3 && COMMON.has(trimmed)) return true;
        }
        return false;
    }

    // context: { email, firstName, lastName } (all optional)
    function containsPersonalInfo(password, context) {
        const lower = String(password).toLowerCase();
        const tokens = [];
        const email = String((context && context.email) || '').toLowerCase();
        if (email.includes('@')) tokens.push(email.split('@')[0]); // often the student number
        tokens.push(String((context && context.firstName) || '').toLowerCase());
        tokens.push(String((context && context.lastName) || '').toLowerCase());
        return tokens.some(t => t.length >= 4 && lower.includes(t) ||
                                (t.length === 3 && /^[a-z]+$/.test(t) && lower === t));
    }

    function check(password, context) {
        const pw = String(password || '');
        const rules = [
            { id: 'length',    label: `At least ${MIN_LENGTH} characters`,        met: pw.length >= MIN_LENGTH },
            { id: 'lower',     label: 'A lowercase letter (a-z)',                 met: /[a-z]/.test(pw) },
            { id: 'upper',     label: 'An uppercase letter (A-Z)',                met: /[A-Z]/.test(pw) },
            { id: 'number',    label: 'A number (0-9)',                           met: /[0-9]/.test(pw) },
            { id: 'common',    label: 'Not a common password',                    met: pw.length > 0 && !isCommonPassword(pw) },
            { id: 'personal',  label: 'Does not contain your name or student number', met: pw.length > 0 && !containsPersonalInfo(pw, context) }
        ];

        const problems = [];
        if (!rules[0].met) problems.push(`Password must be at least ${MIN_LENGTH} characters`);
        if (pw.length > MAX_LENGTH) problems.push(`Password must be at most ${MAX_LENGTH} characters`);
        if (!rules[1].met) problems.push('Password needs a lowercase letter');
        if (!rules[2].met) problems.push('Password needs an uppercase letter');
        if (!rules[3].met) problems.push('Password needs a number');
        if (pw.length > 0 && !rules[4].met) problems.push('That password is too common. Choose something less guessable');
        if (pw.length > 0 && !rules[5].met) problems.push('Password must not contain your name or student number');

        const ok = pw.length > 0 && pw.length <= MAX_LENGTH && rules.every(r => r.met);

        // 0 = empty, 1 = weak, 2 = good, 3 = strong
        let score = 0;
        if (pw.length > 0) score = !ok ? 1 : (pw.length >= 12 ? 3 : 2);
        const labels = ['', 'Weak', 'Good', 'Strong'];

        return { ok, rules, problems, score, label: labels[score] };
    }

    root.PasswordPolicy = { check, isCommonPassword, MIN_LENGTH, MAX_LENGTH };
})(typeof window !== 'undefined' ? window : globalThis);
