// scripts/migrate-email-verified.js
// One-time clean-up for Phase C (server-side OTP).
//
//   node scripts/migrate-email-verified.js            -> DRY RUN (shows what would change)
//   node scripts/migrate-email-verified.js --apply    -> makes the changes
//
// What it does:
//   1. Marks existing accounts as email-verified in Firebase Auth when they were
//      already verified before (isEmailVerified === true) or are officers,
//      so they are not forced through the new OTP step.
//   2. Deletes old emailVerifications records, which stored codes as plain text.

require('dotenv').config();
const fs = require('fs');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
}
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  console.log(APPLY ? '*** APPLYING CHANGES ***\n' : '*** DRY RUN (no changes made) ***\n');

  let toVerify = 0, alreadyOk = 0, notVerified = 0, noAuthAccount = 0;

  const users = await db.collection('users').get();
  for (const doc of users.docs) {
    const u = doc.data();
    const shouldBeVerified = u.isEmailVerified === true || u.role === 'officer';

    if (!shouldBeVerified) { notVerified++; continue; }

    try {
      const record = await admin.auth().getUser(doc.id);
      if (record.emailVerified) { alreadyOk++; continue; }

      toVerify++;
      console.log((APPLY ? 'Verifying:    ' : 'Would verify: ') + record.email);
      if (APPLY) await admin.auth().updateUser(doc.id, { emailVerified: true });
    } catch (err) {
      noAuthAccount++;
      console.warn('No Firebase Auth account for user doc ' + doc.id);
    }
  }

  const codes = await db.collection('emailVerifications').get();
  console.log('\nOld verification records found: ' + codes.size);
  if (APPLY && codes.size > 0) {
    const batch = db.batch();
    codes.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log('Deleted old verification records.');
  }

  console.log('\nSummary');
  console.log('  Accounts marked verified:       ' + toVerify);
  console.log('  Already verified:               ' + alreadyOk);
  console.log('  Left unverified (must use OTP): ' + notVerified);
  console.log('  Missing Auth account:           ' + noAuthAccount);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
