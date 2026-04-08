import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import sgMail from '@sendgrid/mail'
import twilio from 'twilio'

admin.initializeApp()

// ─── Config ───────────────────────────────────────────────────────────────────
// Set these via: firebase functions:config:set sendgrid.key="SG.xxx" twilio.sid="ACxxx" etc.

function getSendGridKey() {
  return functions.config().sendgrid?.key ?? process.env.SENDGRID_API_KEY ?? ''
}
function getTwilioConfig() {
  const cfg = functions.config().twilio ?? {}
  return {
    sid: cfg.sid ?? process.env.TWILIO_SID ?? '',
    token: cfg.token ?? process.env.TWILIO_TOKEN ?? '',
    from: cfg.from ?? process.env.TWILIO_FROM ?? '',
  }
}

// ─── Set custom claims on new user registration ───────────────────────────────

export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  // Default role is tenant; update via admin SDK after business assignment
  await admin.auth().setCustomUserClaims(user.uid, { role: 'tenant' })
  await admin.firestore().collection('users').doc(user.uid).set({
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    role: 'tenant',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
})

// ─── Set custom claims via callable (called by admin / owner) ─────────────────

export const setUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated')
  const callerClaims = context.auth.token
  if (!['super_admin', 'business_owner'].includes(callerClaims.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Insufficient role')
  }
  const { uid, role, businessId, facilityIds } = data as {
    uid: string; role: string; businessId?: string; facilityIds?: string[]
  }
  const claims: Record<string, unknown> = { role }
  if (businessId) claims.businessId = businessId
  if (facilityIds) claims.facilityIds = facilityIds
  await admin.auth().setCustomUserClaims(uid, claims)
  await admin.firestore().collection('users').doc(uid).update({ role, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
  return { success: true }
})

// ─── Send email notification ──────────────────────────────────────────────────

export const sendEmailNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated')
  const { to, subject, html } = data as { to: string; subject: string; html: string }
  const key = getSendGridKey()
  if (!key) throw new functions.https.HttpsError('failed-precondition', 'SendGrid not configured')
  sgMail.setApiKey(key)
  await sgMail.send({ to, from: 'noreply@storagemanager.app', subject, html })
  return { success: true }
})

// ─── Send SMS notification ────────────────────────────────────────────────────

export const sendSmsNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated')
  const { to, body } = data as { to: string; body: string }
  const cfg = getTwilioConfig()
  if (!cfg.sid) throw new functions.https.HttpsError('failed-precondition', 'Twilio not configured')
  const client = twilio(cfg.sid, cfg.token)
  await client.messages.create({ to, from: cfg.from, body })
  return { success: true }
})

// ─── Cron: mark overdue invoices ──────────────────────────────────────────────

export const markOverdueInvoices = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  const db = admin.firestore()
  const now = admin.firestore.Timestamp.now()
  const snap = await db.collection('invoices')
    .where('status', '==', 'pending')
    .where('dueDate', '<', now)
    .get()
  const batch = db.batch()
  snap.docs.forEach((d) => {
    batch.update(d.ref, { status: 'overdue', updatedAt: admin.firestore.FieldValue.serverTimestamp() })
  })
  await batch.commit()
  functions.logger.info(`Marked ${snap.size} invoices as overdue`)
})

// ─── Cron: send rent reminders 3 days before due ──────────────────────────────

export const sendRentReminders = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  const db = admin.firestore()
  const key = getSendGridKey()
  if (!key) return

  sgMail.setApiKey(key)

  const now = new Date()
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const startTs = admin.firestore.Timestamp.fromDate(now)
  const endTs = admin.firestore.Timestamp.fromDate(in3Days)

  const snap = await db.collection('invoices')
    .where('status', '==', 'pending')
    .where('dueDate', '>=', startTs)
    .where('dueDate', '<=', endTs)
    .get()

  for (const invDoc of snap.docs) {
    const invoice = invDoc.data()
    const tenantSnap = await db.collection('users').doc(invoice.tenantId).get()
    const tenant = tenantSnap.data()
    if (!tenant?.email) continue
    await sgMail.send({
      to: tenant.email,
      from: 'noreply@storagemanager.app',
      subject: 'Rent reminder',
      html: `<p>Hi ${tenant.displayName ?? 'there'},</p><p>Your rent invoice of <strong>$${invoice.totalDue}</strong> is due on ${invoice.dueDate.toDate().toLocaleDateString()}.</p>`,
    })
  }
  functions.logger.info(`Sent ${snap.size} rent reminders`)
})
