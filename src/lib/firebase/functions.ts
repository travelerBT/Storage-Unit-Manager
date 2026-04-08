import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from './app'

export const functions = getFunctions(app)

export function callFunction<TData, TResult>(name: string) {
  return httpsCallable<TData, TResult>(functions, name)
}
