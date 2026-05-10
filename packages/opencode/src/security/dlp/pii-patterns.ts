import type { Severity } from "../types"

/** PII pattern with optional post-match validation. */
export interface PIIPattern {
  readonly id: string
  readonly name: string
  readonly regex: RegExp
  readonly severity: Severity
  readonly description: string
  readonly category: "email" | "phone" | "ssn" | "creditCard" | "ipAddress"
  readonly validate?: (value: string) => boolean
}

/** Example/placeholder domains to suppress. */
const EXAMPLE_DOMAINS = /@(example|test|localhost|invalid|domain)\.(com|org|net|edu|gov|io)$/i

/** Stripe test credit card numbers. */
const STRIPE_TEST_CARDS = new Set([
  "4111111111111111", "4242424242424242", "4000056655665556",
  "5555555555554444", "5105105105105100",
  "378282246310005", "371449635398431",
  "6011111111111117", "6011000990139424",
  "30569309025904", "38520000023237",
  "3566002020360505",
])

/** Known invalid SSN patterns. */
function isValidSSN(value: string): boolean {
  const clean = value.replace(/-/g, "")
  if (clean.length !== 9) return true
  // Cannot start with 000, 666, or 900-999
  if (clean.startsWith("000") || clean.startsWith("666") || clean[0] === "9") return false
  // Cannot have 00 in groups 2 or 3
  if (clean.slice(3, 5) === "00") return false
  if (clean.slice(5) === "0000") return false
  return true
}

/** Luhn check for credit card numbers. */
function luhnCheck(value: string): boolean {
  const clean = value.replace(/\D/g, "")
  if (clean.length < 13 || clean.length > 19) return false
  if (STRIPE_TEST_CARDS.has(clean)) return false
  let sum = 0
  let alternate = false
  for (let i = clean.length - 1; i >= 0; i--) {
    let n = parseInt(clean[i], 10)
    if (alternate) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alternate = !alternate
  }
  return sum % 10 === 0
}

/** Check if a phone number looks sequential/patterned. */
function isPatternedPhone(value: string): boolean {
  const clean = value.replace(/\D/g, "")
  // Sequential digits
  if (/^(.)\1+$/.test(clean)) return true
  // 123-456-7890 pattern
  if (/^1234567890/.test(clean)) return true
  if (/^0123456789/.test(clean)) return true
  return false
}

/** Check if IP is private/reserved. */
function isPrivateIP(value: string): boolean {
  const parts = value.split(".")
  if (parts.length !== 4) return false
  const first = parseInt(parts[0], 10)
  const second = parseInt(parts[1], 10)
  // Loopback: 127.x.x.x
  if (first === 127) return true
  // Private: 10.x.x.x
  if (first === 10) return true
  // Private: 172.16-31.x.x
  if (first === 172 && second >= 16 && second <= 31) return true
  // Private: 192.168.x.x
  if (first === 192 && second === 168) return true
  // Link-local: 169.254.x.x
  if (first === 169 && second === 254) return true
  return false
}

export const PII_PATTERNS: PIIPattern[] = [
  {
    id: "pii-email",
    name: "Email Address",
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    severity: "warning",
    description: "Email address detected in outbound context",
    category: "email",
    validate: (value) => !EXAMPLE_DOMAINS.test(value),
  },
  {
    id: "pii-phone-us",
    name: "US Phone Number",
    regex: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s][0-9]{3}[-.\s][0-9]{4}/g,
    severity: "warning",
    description: "US phone number detected in outbound context",
    category: "phone",
    validate: (value) => !isPatternedPhone(value),
  },
  {
    id: "pii-phone-intl",
    name: "International Phone Number",
    regex: /\+\d{1,3}[-.\s]\d{1,4}[-.\s]\d{1,4}[-.\s]\d{1,9}/g,
    severity: "warning",
    description: "International phone number detected in outbound context",
    category: "phone",
  },
  {
    id: "pii-ssn",
    name: "Social Security Number",
    regex: /\b[0-9]{3}[-][0-9]{2}[-][0-9]{4}\b/g,
    severity: "critical",
    description: "Social Security Number detected in outbound context",
    category: "ssn",
    validate: (value) => isValidSSN(value),
  },
  {
    id: "pii-credit-card",
    name: "Credit Card Number",
    regex: /\b(?:\d{4}[-.\s]?){3,4}\d{4}\b/g,
    severity: "critical",
    description: "Credit card number detected in outbound context",
    category: "creditCard",
    validate: (value) => luhnCheck(value),
  },
  {
    id: "pii-ip-address",
    name: "IP Address",
    regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    severity: "info",
    description: "IP address detected in outbound context",
    category: "ipAddress",
    validate: (value) => !isPrivateIP(value),
  },
]

/**
 * Create a safe snippet with the matched value redacted.
 * Shows 5 chars before and after the match, with `[REDACTED]` replacing the match.
 */
export function createSnippet(line: string, matchStart: number, matchEnd: number): string {
  const before = line.slice(Math.max(0, matchStart - 5), matchStart)
  const after = line.slice(matchEnd, Math.min(line.length, matchEnd + 5))
  return `${before}[REDACTED]${after}`
}
