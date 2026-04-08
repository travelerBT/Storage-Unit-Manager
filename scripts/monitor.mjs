#!/usr/bin/env node
/**
 * Console monitor — launches Chrome with remote debugging and streams
 * all console output from localhost:5173 to this terminal.
 *
 * Usage:  node scripts/monitor.mjs
 */

import { spawn } from 'child_process'
import CDP from 'chrome-remote-interface'

const URL = 'http://localhost:5173/'
const DEBUG_PORT = 9222
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const LEVEL_COLOR = {
  log:     '\x1b[37m',   // white
  info:    '\x1b[36m',   // cyan
  warning: '\x1b[33m',   // yellow
  error:   '\x1b[31m',   // red
  debug:   '\x1b[35m',   // magenta
}
const RESET = '\x1b[0m'
const DIM   = '\x1b[2m'

function ts() {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

function formatArg(arg) {
  if (arg.type === 'string')  return arg.value ?? ''
  if (arg.type === 'number')  return String(arg.value)
  if (arg.type === 'boolean') return String(arg.value)
  if (arg.type === 'undefined') return 'undefined'
  if (arg.type === 'null')    return 'null'
  if (arg.value !== undefined) return String(arg.value)
  if (arg.description)        return arg.description
  return `[${arg.type}]`
}

function printConsole(type, args, url, line) {
  const color = LEVEL_COLOR[type] ?? LEVEL_COLOR.log
  const label = type.padEnd(7).toUpperCase()
  const msg   = args.map(formatArg).join(' ')
  const loc   = url ? `${DIM}  ${url.replace(URL, '')}:${line}${RESET}` : ''
  console.log(`${DIM}${ts()}${RESET} ${color}${label}${RESET} ${msg}${loc}`)
}

// ── Launch Chrome ────────────────────────────────────────────────────────────
console.log(`Launching Chrome → ${URL}`)
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--user-data-dir=/tmp/chrome-monitor-debug',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  URL,
], { stdio: 'ignore', detached: false })

chrome.on('error', (e) => { console.error('Chrome launch failed:', e.message); process.exit(1) })

// Give Chrome a moment to start its debug endpoint
await new Promise(r => setTimeout(r, 1500))

// ── Connect via CDP ──────────────────────────────────────────────────────────
let client
try {
  client = await CDP({ port: DEBUG_PORT })
} catch (e) {
  console.error('Could not connect to Chrome DevTools Protocol:', e.message)
  console.error('Make sure the dev server is running: npm run dev')
  chrome.kill()
  process.exit(1)
}

const { Runtime, Log, Page, Network } = client

await Promise.all([
  Runtime.enable(),
  Log.enable(),
  Page.enable(),
  Network.enable(),
])

console.log(`\x1b[32mConnected — streaming console from ${URL}\x1b[0m`)
console.log(`${'─'.repeat(60)}`)

// ── Console API calls (console.log / warn / error / etc.) ───────────────────
Runtime.consoleAPICalled(({ type, args, stackTrace }) => {
  const frame = stackTrace?.callFrames?.[0]
  printConsole(type, args, frame?.url, frame?.lineNumber)
})

// ── Uncaught exceptions ──────────────────────────────────────────────────────
Runtime.exceptionThrown(({ exceptionDetails }) => {
  const e = exceptionDetails
  const msg = e.exception?.description ?? e.text ?? 'Unknown error'
  const color = LEVEL_COLOR.error
  console.log(`${DIM}${ts()}${RESET} ${color}UNCAUGHT${RESET} ${msg}`)
})

// ── Network errors ───────────────────────────────────────────────────────────
Network.loadingFailed(({ requestId, errorText, blockedReason }) => {
  if (errorText === 'net::ERR_ABORTED') return // ignore user-cancelled
  console.log(`${DIM}${ts()}${RESET} ${LEVEL_COLOR.error}NET ERR ${RESET} ${errorText}${blockedReason ? ` (${blockedReason})` : ''}`)
})

// ── Structural browser log entries (CSP, deprecations, etc.) ────────────────
Log.entryAdded(({ entry }) => {
  if (entry.level === 'verbose') return
  printConsole(entry.level, [{ type: 'string', value: entry.text }], entry.url, entry.lineNumber)
})

// ── Page navigations ─────────────────────────────────────────────────────────
Page.frameNavigated(({ frame }) => {
  if (frame.parentId) return // ignore sub-frames
  console.log(`${DIM}${ts()}${RESET} \x1b[34mNAVIGATE\x1b[0m ${frame.url}`)
})

// ── Cleanup ───────────────────────────────────────────────────────────────────
async function shutdown() {
  console.log('\nShutting down…')
  await client.close()
  chrome.kill()
  process.exit(0)
}

process.on('SIGINT',  shutdown)
process.on('SIGTERM', shutdown)
