import type { Option } from "effect/Option";
import * as O from "effect/Option";

/**
 * Type definitions for Maybe.match handlers using Haskell-style naming conventions.
 *
 * @template T - The type of value contained in the Maybe
 * @template U - The return type of both handlers
 */
export interface MatchHandlers<T, U> {
  /** Handler called when the Maybe contains nothing (None case) */
  onNothing: () => U;
  /** Handler called when the Maybe contains a value (Some case) */
  onJust: (value: T) => U;
}

/**
 * Type definition for the match function that provides pattern matching on Maybe values.
 * Uses Haskell-style naming conventions: onNothing/onJust instead of onNone/onSome.
 */
export type MatchFunction = <A, B>(
  maybe: Maybe<A>,
  handlers: MatchHandlers<A, B>
) => B;

/**
 * Maybe class providing both static functional methods and instance methods for optional values.
 * Wraps Effect.Option with a more object-oriented interface while maintaining
 * full backward compatibility with the existing functional Maybe API.
 *
 * Uses Haskell-style naming conventions (just/nothing) for consistency.
 *
 * @template T - The type of value contained in the Maybe
 */
export class Maybe<T> {
  /**
   * Private constructor to ensure controlled instantiation through static factory methods.
   * @param _option - The underlying Effect.Option instance
   */
  private constructor(private readonly _option: Option<T>) {}
  
  /**
   * Gets the wrapped value directly.
   * WARNING: This will throw an error if the Maybe is Nothing.
   * Use only when you're certain the Maybe contains a value, or prefer getOrElse/getOrUndefined for safer access.
   * @returns The wrapped value
   * @throws Error if this is Nothing
   */
  get value(): T {
    return this.getOrThrow("Attempted to access value of Nothing");
  }
  
  // Static Factory Methods
  
  /**
   * Creates a Maybe containing a value (Just case).
   * @param value - The value to wrap
   * @returns A Maybe containing the value
   */
  static just<T>(value: T): Maybe<T> {
    return new Maybe(O.some(value));
  }
  
  /**
   * Creates an empty Maybe (Nothing case).
   * @returns An empty Maybe
   */
  static nothing<T = any>(): Maybe<T> {
    return new Maybe(O.none());
  }
  
  /**
   * Creates a Maybe from a nullable value.
   * @param value - The nullable value
   * @returns Just(value) if value is not null/undefined, Nothing otherwise
   */
  static fromNullable<T>(value: T | null | undefined): Maybe<NonNullable<T>> {
    return new Maybe(O.fromNullable(value));
  }
  
  /**
   * Creates a conditional Maybe factory based on a boolean condition.
   * @param condition - The condition to check
   * @returns A function that returns Just(value) if condition is true, Nothing otherwise
   */
  static fromBoolean<T>(condition: boolean): (value: T) => Maybe<T> {
    return (value: T) => condition ? Maybe.just(value) : Maybe.nothing<T>();
  }
  
  /**
   * Lifts a predicate into a Maybe-returning function.
   * @param predicate - The predicate function
   * @returns A function that returns Just(value) if predicate passes, Nothing otherwise
   */
  static liftPredicate<T>(predicate: (a: T) => boolean): (a: T) => Maybe<T> {
    return (a: T) => predicate(a) ? Maybe.just(a) : Maybe.nothing<T>();
  }
  
  /**
   * Combines multiple Maybes into a single Maybe containing an array.
   * Returns Just([...values]) if all Maybes are Just, Nothing if any is Nothing.
   * @param maybes - Array of Maybe values
   * @returns Maybe containing array of all values, or Nothing
   */
  static all<T>(maybes: Maybe<T>[]): Maybe<T[]> {
    const options = maybes.map(maybe => maybe._option);
    return new Maybe(O.all(options));
  }
  
  /**
   * Returns the first Just value from an array of Maybes.
   * @param maybes - Array of Maybe values
   * @returns The first Just value, or Nothing if all are Nothing
   */
  static firstJustOf<T>(maybes: Maybe<T>[]): Maybe<T> {
    const options = maybes.map(maybe => maybe._option);
    return new Maybe(O.firstSomeOf(options));
  }
  
  /**
   * Pattern match on a Maybe value using Haskell-style naming conventions.
   * @param maybe - The Maybe value to pattern match on
   * @param handlers - Object containing handlers for both cases
   * @returns The result of calling the appropriate handler
   */
  static match<T, U>(
    maybe: Maybe<T>,
    handlers: MatchHandlers<T, U>
  ): U {
    return maybe.match(handlers);
  }
  
  // Static functional versions for backward compatibility
  static mapC = <T, U>(f: (value: T) => U) => (maybe: Maybe<T>): Maybe<U> => maybe.map(f);
  static map = <T, U>(
    maybe: Maybe<T>,
    f: (value: T) => U
  ): Maybe<U> => maybe.map(f);
  
  static flatMapC = <T, U>(f: (value: T) => Maybe<U>) => (maybe: Maybe<T>): Maybe<U> => maybe.flatMap(f);
  static flatMap = <T, U>(
    maybe: Maybe<T>,
    f: (value: T) => Maybe<U>
  ): Maybe<U> => maybe.flatMap(f);
  
  static filterC = <T>(predicate: (value: T) => boolean) => (maybe: Maybe<T>): Maybe<T> => maybe.filter(predicate);
  static filter = <T>(
    maybe: Maybe<T>,
    predicate: (value: T) => boolean
  ): Maybe<T> => maybe.filter(predicate);
  
  static getOrElseC = <T, U>(defaultValue: U) => (maybe: Maybe<T>): T | U => maybe.getOrElse(defaultValue);
  static getOrElse = <T, U>(
    maybe: Maybe<T>,
    defaultValue: U
  ): T | U => maybe.getOrElse(defaultValue);
  
  static isJust = <T>(maybe: Maybe<T>): boolean => maybe.isJust();
  static isNothing = <T>(maybe: Maybe<T>): boolean => maybe.isNothing();
  
  static tapC = <T>(f: (value: T) => void) => (maybe: Maybe<T>): Maybe<T> => maybe.tap(f);
  static tap = <T>(
    maybe: Maybe<T>,
    f: (value: T) => void
  ): Maybe<T> => maybe.tap(f);
  
  static forEachC = <T>(f: (value: T) => void) => (maybe: Maybe<T>): void => maybe.forEach(f);
  static forEach = <T>(
    maybe: Maybe<T>,
    f: (value: T) => void
  ): void => maybe.forEach(f);
  
  static containsC = <T>(value: T) => (maybe: Maybe<T>): boolean => maybe.contains(value);
  static contains = <T>(
    maybe: Maybe<T>,
    value: T
  ): boolean => maybe.contains(value);
  
  static existsC = <T>(predicate: (value: T) => boolean) => (maybe: Maybe<T>): boolean => maybe.exists(predicate);
  static exists = <T>(
    maybe: Maybe<T>,
    predicate: (value: T) => boolean
  ): boolean => maybe.exists(predicate);
  
  static orElseC = <T, U>(alternative: Maybe<U>) => (maybe: Maybe<T>): Maybe<T | U> => maybe.orElse(alternative);
  static orElse = <T, U>(
    maybe: Maybe<T>,
    alternative: Maybe<U>
  ): Maybe<T | U> => maybe.orElse(alternative);
  
  static toArray = <T>(maybe: Maybe<T>): T[] => maybe.toArray();
  static getOrNull = <T>(maybe: Maybe<T>): T | null => maybe.getOrNull();
  static getOrUndefined = <T>(maybe: Maybe<T>): T | undefined => maybe.getOrUndefined();
  static getOrThrow = <T>(
    maybe: Maybe<T>,
    errorMessage?: string
  ): T => maybe.getOrThrow(errorMessage);
  
  // Direct (non-curried) static methods for better backward compatibility
  static getValue<T>(maybe: Maybe<T>): T | undefined {
    return maybe.getOrUndefined();
  }
  
  static getValueOrThrow<T>(
    maybe: Maybe<T>,
    errorMessage?: string
  ): T {
    return maybe.getOrThrow(errorMessage);
  }
  
  static getValueOrElse<T, U>(
    maybe: Maybe<T>,
    defaultValue: U
  ): T | U {
    return maybe.getOrElse(defaultValue);
  }
  
  static getValueOrNull<T>(maybe: Maybe<T>): T | null {
    return maybe.getOrNull();
  }
  
  // Effect interop
  static gen = O.gen;
  static Do = O.Do;
  static bind = O.bind;
  static bindTo = O.bindTo;
  static let_ = O.let;
  
  // Query Methods
  
  /**
   * Checks if this Maybe contains a value.
   * @returns true if this is Just, false if Nothing
   */
  isJust(): boolean {
    return O.isSome(this._option);
  }
  
  /**
   * Checks if this Maybe is empty.
   * @returns true if this is Nothing, false if Just
   */
  isNothing(): boolean {
    return O.isNone(this._option);
  }
  
  // Transformation Methods
  
  /**
   * Transforms the value inside this Maybe using the provided function.
   * @param f - The transformation function
   * @returns A new Maybe with the transformed value, or Nothing if this is Nothing
   */
  map<U>(f: (value: T) => U): Maybe<U> {
    return new Maybe(O.map(this._option, f));
  }
  
  /**
   * Applies a function that returns a Maybe to the value inside this Maybe.
   * @param f - The function that returns a Maybe
   * @returns The result of the function, or Nothing if this is Nothing
   */
  flatMap<U>(f: (value: T) => Maybe<U>): Maybe<U> {
    return new Maybe(O.flatMap(this._option, (value) => f(value)._option));
  }
  
  /**
   * Filters the value based on a predicate.
   * @param predicate - The predicate function
   * @returns This Maybe if predicate passes, Nothing otherwise
   */
  filter(predicate: (value: T) => boolean): Maybe<T> {
    return new Maybe(O.filter(this._option, predicate));
  }
  
  // Extraction Methods
  
  /**
   * Gets the value or returns a default.
   * @param defaultValue - The default value to return if Nothing
   * @returns The contained value or the default
   */
  getOrElse<U>(defaultValue: U): T | U {
    return O.getOrElse(this._option, () => defaultValue);
  }
  
  /**
   * Gets the value or throws an error.
   * @param errorMessage - Optional error message
   * @returns The contained value
   * @throws Error if this is Nothing
   */
  getOrThrow(errorMessage?: string): T {
    return O.match(this._option, {
      onNone: () => {
        throw new Error(errorMessage || "Maybe is Nothing, expected Just");
      },
      onSome: (value) => value
    });
  }
  
  /**
   * Gets the value or returns null.
   * @returns The contained value or null
   */
  getOrNull(): T | null {
    return O.getOrNull(this._option);
  }
  
  /**
   * Gets the value or returns undefined.
   * @returns The contained value or undefined
   */
  getOrUndefined(): T | undefined {
    return O.getOrUndefined(this._option);
  }
  
  // Pattern Matching
  
  /**
   * Pattern matches on this Maybe using Haskell-style naming.
   * @param handlers - Object containing handlers for both cases
   * @returns The result of calling the appropriate handler
   */
  match<U>(handlers: MatchHandlers<T, U>): U {
    return O.match(this._option, {
      onNone: handlers.onNothing,
      onSome: handlers.onJust
    });
  }
  
  // Utility Methods
  
  /**
   * Returns this Maybe if it's Just, otherwise returns the alternative.
   * @param alternative - The alternative Maybe
   * @returns This Maybe or the alternative
   */
  orElse<U>(alternative: Maybe<U>): Maybe<T | U> {
    return new Maybe(O.orElse(this._option, () => alternative._option));
  }
  
  /**
   * Executes a side effect if this Maybe contains a value.
   * @param f - The side effect function
   * @returns This Maybe (for chaining)
   */
  tap(f: (value: T) => void): Maybe<T> {
    if (O.isSome(this._option)) {
      f(this._option.value);
    }
    return this;
  }
  
  /**
   * Executes a side effect if this Maybe contains a value.
   * @param f - The side effect function
   */
  forEach(f: (value: T) => void): void {
    if (O.isSome(this._option)) {
      f(this._option.value);
    }
  }
  
  /**
   * Converts this Maybe to an array.
   * @returns Array containing the value if Just, empty array if Nothing
   */
  toArray(): T[] {
    return O.match(this._option, {
      onNone: () => [],
      onSome: (value) => [value]
    });
  }
  
  /**
   * Checks if this Maybe contains a specific value.
   * @param value - The value to check for
   * @returns true if this Maybe contains the value
   */
  contains(value: T): boolean {
    return O.contains(this._option, value);
  }
  
  /**
   * Creates a function that checks if this Maybe contains a value equal to the provided value
   * using a custom equality function.
   * @param predicate - The equality function
   * @returns A function that takes a value and returns true if this Maybe contains an equal value
   */
  containsWith(predicate: (
    value: T,
    other: T
  ) => boolean): (other: T) => boolean {
    return (other: T) => O.exists(this._option, (value) => predicate(value, other));
  }
  
  /**
   * Checks if the value in this Maybe satisfies a predicate.
   * @param predicate - The predicate function
   * @returns true if this Maybe contains a value that satisfies the predicate
   */
  exists(predicate: (value: T) => boolean): boolean {
    return O.exists(this._option, predicate);
  }
  
  // Integration Methods
  
  /**
   * String representation of this Maybe.
   * @returns String representation
   */
  toString(): string {
    return this.match({
      onNothing: () => "Nothing",
      onJust: (value) => `Just(${ String(value) })`
    });
  }
  
  /**
   * Gets the underlying Effect.Option instance.
   * @returns The wrapped Option
   */
  valueOf(): Option<T> {
    return this._option;
  }
  
  // Applicative Functor Methods (missing from Haskell compliance)
  
  /**
   * Instance version of applicative apply.
   * @param maybeF - Maybe containing a function
   * @returns A new Maybe with the function applied, or Nothing if either is Nothing
   */
  ap<U>(maybeF: Maybe<(value: T) => U>): Maybe<U> {
    if (maybeF.isNothing()) {
      return Maybe.nothing<U>();
    }
    if (this.isNothing()) {
      return Maybe.nothing<U>();
    }
    return maybeF.flatMap(f => this.map(f));
  }
  
  /**
   * MonadPlus mplus - combines two Maybe values, preferring the first Just.
   * Equivalent to Haskell's mplus or <|> operator.
   * @param other - Alternative Maybe
   * @returns First Maybe if Just, otherwise the alternative
   */
  mplus<U>(other: Maybe<U>): Maybe<T | U> {
    return this.orElse(other);
  }
  
  // Static Applicative and MonadPlus Methods
  
  /**
   * Applicative apply - applies a function wrapped in a Maybe to a value wrapped in a Maybe.
   * Equivalent to Haskell's <*> operator.
   */
  static apply<T, U>(maybeF: Maybe<(value: T) => U>): (maybe: Maybe<T>) => Maybe<U> {
    return (maybe: Maybe<T>) => {
      if (maybeF.isNothing() || maybe.isNothing()) {
        return Maybe.nothing<U>();
      }
      return maybe.map(maybeF.getOrThrow());
    };
  }
  
  /**
   * Lifts a binary function to work with two Maybe values.
   * Equivalent to Haskell's liftA2.
   */
  static liftA2<A, B, C>(f: (
    a: A,
    b: B
  ) => C): (ma: Maybe<A>) => (mb: Maybe<B>) => Maybe<C> {
    return (ma: Maybe<A>) => (mb: Maybe<B>) => {
      if (ma.isNothing() || mb.isNothing()) {
        return Maybe.nothing<C>();
      }
      return Maybe.just(f(ma.getOrThrow(), mb.getOrThrow()));
    };
  }
  
  /**
   * MonadPlus mzero - represents failure/empty value.
   */
  static mzero<T>(): Maybe<T> {
    return Maybe.nothing<T>();
  }
  
  /**
   * Static version of mplus.
   */
  static mplus<A, B>(ma: Maybe<A>): (mb: Maybe<B>) => Maybe<A | B> {
    return (mb: Maybe<B>) => ma.mplus(mb);
  }
  
  /**
   * Guard function - returns Just(unit) if condition is true, Nothing otherwise.
   * Equivalent to Haskell's guard.
   */
  static guard(condition: boolean): Maybe<undefined> {
    return condition ? Maybe.just(undefined) : Maybe.nothing<undefined>();
  }
  
  /**
   * Conditional execution - executes action if condition is true.
   * Equivalent to Haskell's when.
   */
  static when<T>(
    condition: boolean,
    action: () => Maybe<T>
  ): Maybe<undefined> {
    return condition ? action().map(() => undefined) : Maybe.just(undefined);
  }
  
  /**
   * Conditional execution - executes action if condition is false.
   * Equivalent to Haskell's unless.
   */
  static unless<T>(
    condition: boolean,
    action: () => Maybe<T>
  ): Maybe<undefined> {
    return Maybe.when(!condition, action);
  }
}
