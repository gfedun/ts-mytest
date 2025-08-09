import util from "util"

export const symbolLoggable: unique symbol = Symbol.for("cla/Inspectable/Loggable")

export const isLoggable = (u: unknown): u is Loggable =>
  typeof u === "object" && u !== null && symbolLoggable in u

/**
 * Interface for objects that can provide structured logging output
 */
export interface Loggable {
  readonly [symbolLoggable]: () => string
  /** Returns debug-level representation with detailed information */
  toDebug(msg?: string): string
  /** Returns info-level representation with essential information */
  toInfo(msg?: string): string
}

/**
 * Marker interface for strings that should be redacted in logs
 */
export interface RedactedString {
  readonly __redacted: true
  readonly value: string
  readonly hint?: string
}

/**
 * Creates a redacted string that will be masked in logs
 */
export function redacted(
  value: string,
  hint?: string
): RedactedString {
  return {
    __redacted: true,
    value,
    hint: hint as string | undefined
  } as RedactedString
}

/**
 * Type guard to check if a value is a redacted string
 */
export function isRedacted(value: unknown): value is RedactedString {
  return typeof value === "object" &&
    value !== null &&
    "__redacted" in value &&
    (value as any).__redacted === true
}

/**
 * Formats redacted value for logging
 */
export function formatRedacted(redactedValue: RedactedString): string {
  const maskedLength = Math.min(redactedValue.value.length, 8)
  const mask = "*".repeat(maskedLength)
  return redactedValue.hint
    ? `[REDACTED:${ redactedValue.hint }:${ mask }]`
    : `[REDACTED:${ mask }]`
}

/**
 * Abstract base class providing common Loggable functionality
 */
export abstract class AbstractLoggable
  implements Loggable {
  readonly [symbolLoggable]: () => string
  
  toDebug(msg?: string): string {
    const debugOutput = this.doToDebug()
    return msg ? `${ debugOutput } - ${ msg }` : debugOutput
  }
  
  toInfo(msg?: string): string {
    const infoOutput = this.doToInfo()
    return msg ? `${ infoOutput } - ${ msg }` : infoOutput
  }
  
  protected abstract doToDebug(): string
  protected abstract doToInfo(): string
  
  [util.inspect.custom](): string {
    return this.toString()
  }
  
  toString(): string {
    return this.toInfo()
  }
}
