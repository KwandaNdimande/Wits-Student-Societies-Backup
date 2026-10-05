// file-api.js
// Private file access. The browser never talks to Supabase storage directly
// for reading or deleting; it asks our server, which checks who is calling.
// Needs: Firebase already initialised on the page, and (for uploads)
// window.supabaseClient from the page's own Supabase setup.

const FILE_BUCKET_NAME = 'documents';

function fileApiGetToken() {
    return new Promise((resolve, reject) => {
        const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
            unsubscribe();
            if (!user) return reject(new Error('You are not signed in.'));
            try { resolve(await user.getIdToken()); } catch (e) { reject(e); }
        });
    });
}

async function fileApiPost(path, body) {
    const token = await fileApiGetToken();
    const res = await fetch(path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'File request failed');
    return data;
}

// kind: 'request' (a leader's request file) or 'library' (officer document library)
// Returns the storage path to save in Firestore.
async function uploadFileToServer(file, kind) {
    const { path, token } = await fileApiPost('/api/files/upload-url', {
        kind,
        fileName: file.name,
        size: file.size
    });

    const { error } = await window.supabaseClient.storage
        .from(FILE_BUCKET_NAME)
        .uploadToSignedUrl(path, token, file);

    if (error) throw new Error('Upload failed: ' + error.message);
    return path;
}

// Short-lived link (about 5 minutes) for viewing or downloading one file
async function getSignedFileUrl(path, options = {}) {
    const { url } = await fileApiPost('/api/files/sign', {
        path,
        download: !!options.download,
        fileName: options.fileName || ''
    });
    return url;
}

async function deleteFilesOnServer(paths) {
    const list = Array.isArray(paths) ? paths : [paths];
    if (list.length === 0) return;
    await fileApiPost('/api/files/delete', { paths: list });
}

// Opens a file in a new tab. The tab is opened first so pop-up blockers allow it.
async function openFileInNewTab(path) {
    if (!path) { alert('No file available to view.'); return; }
    const tab = window.open('', '_blank');
    try {
        const url = await getSignedFileUrl(path);
        if (tab) { tab.opener = null; tab.location.href = url; }
        else { window.location.href = url; }
    } catch (error) {
        if (tab) tab.close();
        console.error('View error:', error);
        alert('Could not open the file: ' + error.message);
    }
}

async function downloadFileFromServer(path, fileName) {
    if (!path) { alert('No file available to download.'); return; }
    try {
        const name = fileName || path.split('/').pop();
        const url = await getSignedFileUrl(path, { download: true, fileName: name });
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (error) {
        console.error('Download error:', error);
        alert('Could not download the file: ' + error.message);
    }
}
