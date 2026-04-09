import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import sgMail from '@sendgrid/mail'
import twilio from 'twilio'
import { GoogleGenerativeAI } from '@google/generative-ai'

admin.initializeApp()

// ─── Config ───────────────────────────────────────────────────────────────────
// Set these via: firebase functions:config:set sendgrid.key="SG.xxx" twilio.sid="ACxxx" etc.

function getSendGridKey() {
  return process.env.SENDGRID_API_KEY ?? ''
}
function getTwilioConfig() {
  return {
    sid:  process.env.TWILIO_SID  ?? '',
    token: process.env.TWILIO_TOKEN ?? '',
    from:  process.env.TWILIO_FROM  ?? '',
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

// ─── Create business + elevate caller to business_owner ──────────────────────

export const setupBusiness = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated')

  const uid = context.auth.uid
  const { name, email = '', phone = '', address = '' } = data as {
    name: string; email?: string; phone?: string; address?: string
  }

  if (!name?.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'Business name is required')
  }

  const firestore = admin.firestore()
  const now = admin.firestore.FieldValue.serverTimestamp()

  // Create the business document via Admin SDK (bypasses Firestore security rules)
  const businessRef = firestore.collection('businesses').doc()
  await businessRef.set({
    name: name.trim(),
    email,
    phone,
    address,
    ownerId: uid,
    subscriptionStatus: 'trial',
    createdAt: now,
    updatedAt: now,
  })

  const businessId = businessRef.id

  // Link businessId to the user document and set role
  await firestore.collection('users').doc(uid).update({
    businessId,
    role: 'business_owner',
    updatedAt: now,
  })

  // Elevate custom claims so Firestore rules recognize the new role immediately
  await admin.auth().setCustomUserClaims(uid, { role: 'business_owner', businessId })

  return { businessId }
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

// ─── Analyze floor plan with Gemini Vision ────────────────────────────────────

interface DetectedUnit {
  id: string
  designation: string
  bbox: { x: number; y: number; w: number; h: number }  // normalized 0–1
}

export const analyzeFloorPlan = functions
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated')
    }

    const { imageBase64, mimeType, floorNumber } = data as {
      imageBase64: string
      mimeType: string
      floorNumber: number
    }

    if (!imageBase64 || !mimeType) {
      throw new functions.https.HttpsError('invalid-argument', 'imageBase64 and mimeType are required')
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `You are analyzing a storage facility floor plan for floor ${floorNumber}.

Identify every individual rentable storage unit, locker, or room visible in the image.

For each unit:
1. Assign a designation based on visible labels (e.g. "101", "A-12") or create a logical scheme like "${floorNumber}01", "${floorNumber}02", etc.
2. Determine bounding box coordinates as fractions of the image size: x (left edge 0–1), y (top edge 0–1), w (width 0–1), h (height 0–1).

Return ONLY a single valid JSON object with no markdown fences:
{
  "units": [
    {
      "designation": "101",
      "bbox": { "x": 0.05, "y": 0.10, "w": 0.08, "h": 0.12 }
    }
  ],
  "notes": "Brief description of what was detected"
}`

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: prompt },
        ],
      }],
      // Disable thinking tokens so the model responds quickly (no typing support yet)
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as never,
    })

    const text = result.response.text().trim()

    // Strip any accidental markdown fences
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let parsed: { units: DetectedUnit[]; notes?: string }
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      throw new functions.https.HttpsError(
        'internal',
        `Gemini returned invalid JSON: ${text.slice(0, 200)}`
      )
    }

    // Attach stable temp IDs
    const units: DetectedUnit[] = (parsed.units ?? []).map((u, i) => ({
      id: `temp_${floorNumber}_${i}`,
      designation: u.designation ?? `${floorNumber}${String(i + 1).padStart(2, '0')}`,
      bbox: u.bbox ?? { x: 0, y: 0, w: 0.1, h: 0.1 },
    }))

    return { units, notes: parsed.notes ?? '' }
  })
