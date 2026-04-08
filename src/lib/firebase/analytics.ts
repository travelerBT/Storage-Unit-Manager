import { getAnalytics, isSupported } from 'firebase/analytics'
import { app } from './app'

// Analytics is only available in browser environments with the correct config
export const analyticsPromise = isSupported().then((yes) =>
  yes ? getAnalytics(app) : null,
)
