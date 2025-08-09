import {
  formatRedacted,
  isLoggable,
  isRedacted,
  type RedactedString
} from "./Loggable"

export interface LogBuilder {
  add(
    name: string,
    value: any
  ): this
  addRedacted(
    name: string,
    value: string | RedactedString,
    hint?: string
  ): this
  addIf(
    condition: boolean,
    name: string,
    value: any
  ): this
  addObject(
    name: string,
    obj: Record<string, any>
  ): this
  end(): string
}

export interface LogBuilderCtor {
  create(
    obj: string | object,
    debug?: boolean
  ): LogBuilder
}

/**
 * Configuration for log formatting
 */
export interface LogFormatConfig {
  maxArrayItems?: number
  maxStringLength?: number
  dateFormat?: Intl.DateTimeFormatOptions
  includeNull?: boolean
  includeUndefined?: boolean
}

class LogBuilderImpl
  implements LogBuilder {
  private sb: string[] = []
  private readonly config: Required<LogFormatConfig>
  private hasContent = false
  
  private constructor(
    obj: string | object,
    private readonly debug: boolean
  ) {
    const name = typeof obj === "object" ? obj.constructor.name : obj
    this.sb.push(`[${ name }]:{`)
    
    this.config = {
      maxArrayItems: 10,
      maxStringLength: 200,
      dateFormat: {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      },
      includeNull: false,
      includeUndefined: false
    }
  }
  
  static create(
    obj: string | object,
    debug: boolean = false
  ): LogBuilder {
    return new LogBuilderImpl(obj, debug)
  }
  
  add(
    name: string,
    value: any
  ): this {
    if (!this.shouldInclude(value)) {
      return this
    }
    
    this.addSeparator()
    this.sb.push(`'${ name }':${ this.formatValue(value) }`)
    return this
  }
  
  addRedacted(
    name: string,
    value: string | RedactedString,
    hint?: string
  ): this {
    this.addSeparator()
    
    if (isRedacted(value)) {
      this.sb.push(`'${ name }':'${ formatRedacted(value) }'`)
    } else {
      const redactedValue = { __redacted: true as const, value, hint: hint ?? "" }
      this.sb.push(`'${ name }':'${ formatRedacted(redactedValue) }'`)
    }
    return this
  }
  
  addIf(
    condition: boolean,
    name: string,
    value: any
  ): this {
    return condition ? this.add(name, value) : this
  }
  
  addObject(
    name: string,
    obj: Record<string, any>
  ): this {
    if (obj === null || obj === undefined) {
      return this.add(name, obj)
    }
    
    this.addSeparator()
    this.sb.push(`'${ name }':${ this.formatObject(obj) }`)
    return this
  }
  
  end(): string {
    this.sb.push("}")
    return this.sb.join("")
  }
  
  private shouldInclude(value: any): boolean {
    if (value === null) return this.config.includeNull
    if (value === undefined) return this.config.includeUndefined
    return true
  }
  
  private addSeparator(): void {
    if (this.hasContent) {
      this.sb.push(",")
    }
    this.hasContent = true
  }
  
  private formatValue(value: any): string {
    try {
      if (isRedacted(value)) {
        return `'${ formatRedacted(value) }'`
      }
      
      if (typeof value === "string") {
        return `'${ this.truncateString(this.escapeString(value)) }'`
      }
      
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value)
      }
      
      if (value instanceof Date) {
        return `'${ value.toLocaleString("en-US", this.config.dateFormat) }'`
      }
      
      if (isLoggable(value)) {
        return this.debug ? value.toDebug() : value.toInfo()
      }
      
      if (isArray(value)) {
        return this.formatArray(value)
      }
      
      if (isArrayLike(value)) {
        return this.formatArray(Array.from(value))
      }
      
      if (typeof value === "object" && value !== null) {
        return this.formatObject(value)
      }
      
      return JSON.stringify(value)
    } catch (error) {
      return `[Error formatting value: ${ error instanceof Error ? error.message : 'Unknown error' }]`
    }
  }
  
  private formatArray(arr: any[]): string {
    const items = arr.slice(0, this.config.maxArrayItems)
    const formatted = items.map(item => this.formatValue(item)).join(",")
    const truncated = arr.length > this.config.maxArrayItems ? "..." : ""
    return `[${ formatted }${ truncated }]`
  }
  
  private formatObject(obj: Record<string, any>): string {
    try {
      const entries = Object.entries(obj).slice(0, 5) // Limit object properties
      const formatted = entries.map(([key, val]) => `'${ key }':${ this.formatValue(val) }`).join(",")
      const truncated = Object.keys(obj).length > 5 ? "..." : ""
      return `{${ formatted }${ truncated }}`
    } catch {
      return `{[Object ${ obj.constructor?.name || 'Unknown' }]}`
    }
  }
  
  private truncateString(str: string): string {
    if (str.length <= this.config.maxStringLength) {
      return str
    }
    return str.slice(0, this.config.maxStringLength) + "..."
  }
  
  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
  }
}

function isArray(value: any): value is Array<any> {
  return Array.isArray(value)
}

function isArrayLike(value: any): value is ArrayLike<any> {
  return value != null &&
    typeof value === "object" &&
    typeof value.length === "number" &&
    value.length >= 0 &&
    !isArray(value)
}

export const LogBuilder: LogBuilderCtor = LogBuilderImpl
