import { Maybe } from '@/maybe/Maybe';
import type { Either as EffectEither } from "effect/Either";
import * as E from "effect/Either";
import * as O from "effect/Option";

/**
 * EitherImpl - A wrapper class that provides instance methods for Either operations
 */
export class EitherImpl<L, R> {
  constructor(private readonly _inner: EffectEither<R, L>) {}
  
  // Instance methods - the main feature we're adding
  isLeft(): this is Either<L, never> {
    return E.isLeft(this._inner);
  }
  
  isRight(): this is Either<never, R> {
    return E.isRight(this._inner);
  }
  
  getLeft(): Maybe<L> {
    const option = E.getLeft(this._inner);
    return O.isSome(option) ? Maybe.just(option.value) : Maybe.nothing<L>();
  }
  
  getRight(): Maybe<R> {
    const option = E.getRight(this._inner);
    return O.isSome(option) ? Maybe.just(option.value) : Maybe.nothing<R>();
  }
  
  // Property accessors for backward compatibility with existing code
  get left(): L {
    const option = E.getLeft(this._inner);
    return O.getOrThrow(option)
  }
  
  get right(): R {
    const option = E.getRight(this._inner);
    return O.getOrThrow(option)
  }
  
  map<U>(fn: (r: R) => U): Either<L, U> {
    return new EitherImpl(E.map(this._inner, fn));
  }
  
  mapLeft<U>(fn: (l: L) => U): Either<U, R> {
    return new EitherImpl(E.mapLeft(this._inner, fn));
  }
  
  flatMap<U>(fn: (r: R) => Either<L, U>): Either<L, U> {
    return new EitherImpl(E.flatMap(this._inner, (r) => fn(r)._inner));
  }
  
  match<U>(handlers: { onLeft: (l: L) => U; onRight: (r: R) => U }): U {
    return E.match(this._inner, handlers);
  }
  
  getOrElse<U>(defaultValue: U): R | U {
    return E.getOrElse(this._inner, () => defaultValue);
  }
  
  getOrThrow(): R {
    return E.getOrThrow(this._inner);
  }
  
  getOrThrowWith(onLeft: (l: L) => unknown): R {
    return E.getOrThrowWith(this._inner, onLeft);
  }
  
  flip(): EitherImpl<R, L> {
    return new EitherImpl(E.flip(this._inner));
  }
  
  merge(): L | R {
    return E.merge(this._inner);
  }
  
  // Utility method to access the inner EffectEither for interop
  get inner(): EffectEither<R, L> {
    return this._inner;
  }
  
  // toString for debugging
  toString(): string {
    return this.match({
      onLeft: (l) => `Left(${ l })`,
      onRight: (r) => `Right(${ r })`
    });
  }
  
  // Applicative Functor Methods (missing from Haskell compliance)
  
  /**
   * Applicative apply - applies a function wrapped in an Either to a value wrapped in an Either.
   * Equivalent to Haskell's <*> operator for Either.
   * @param eitherF - Either containing a function
   * @returns A new Either with the function applied, or Left if either is Left
   */
  ap<U>(eitherF: EitherImpl<L, (value: R) => U>): Either<L, U> {
    if (this.isLeft()) {
      return new EitherImpl(this._inner as any);
    }
    if (eitherF.isLeft()) {
      return new EitherImpl(eitherF._inner as any);
    }
    return this.map(eitherF.getOrThrow());
  }
  
  // Bifunctor Methods (missing from Haskell compliance)
  
  /**
   * Bifunctor bimap - maps over both Left and Right values.
   * Equivalent to Haskell's bimap.
   * @param leftF - Function to apply to Left values
   * @param rightF - Function to apply to Right values
   * @returns Either with appropriate function applied
   */
  bimap<U, V>(
    leftF: (l: L) => U,
    rightF: (r: R) => V
  ): Either<U, V> {
    return new EitherImpl(E.mapBoth(this._inner, { onLeft: leftF, onRight: rightF }));
  }
  
  /**
   * Maps over the Left value only (first component).
   * Equivalent to Haskell's first.
   * @param f - Function to apply to Left value
   * @returns Either with Left value transformed
   */
  first<U>(f: (l: L) => U): Either<U, R> {
    return this.mapLeft(f);
  }
  
  /**
   * Maps over the Right value only (second component).
   * Equivalent to Haskell's second.
   * @param f - Function to apply to Right value
   * @returns Either with Right value transformed
   */
  second<U>(f: (r: R) => U): Either<L, U> {
    return this.map(f);
  }
  
  // MonadError Methods (missing from Haskell compliance)
  
  /**
   * Throws an error into the Either context.
   * Equivalent to Haskell's throwError.
   * @param error - The error value to throw
   * @returns A Left containing the error
   */
  static throwError<L, R>(error: L): Either<L, R> {
    return new EitherImpl(E.left(error)) as unknown as EitherImpl<L, R>;
  }
  
  /**
   * Catches and handles errors in Either computations.
   * Equivalent to Haskell's catchError.
   * @param handler - Function to handle the error
   * @returns Either with error handled, or original Right value
   */
  catchError<L2>(handler: (error: L) => Either<L2, R>): Either<L2, R> {
    if (this.isLeft()) {
      return handler(this.left as L);
    }
    return new EitherImpl(this._inner as any);
  }
  
  // Alternative Methods (missing from Haskell compliance)
  
  /**
   * Alternative empty - represents a neutral element for the alternative operation.
   * For Either, this is typically a Left with some default error.
   * @param defaultError - The default error value
   * @returns A Left containing the default error
   */
  static empty<L, R>(defaultError: L): Either<L, R> {
    return Either.left(defaultError) as unknown as EitherImpl<L, R>;
  }
  
  /**
   * Alternative choice operator - returns the first Right, or combines Lefts.
   * Equivalent to Haskell's <|> operator.
   * @param other - Alternative Either
   * @returns First Either if Right, otherwise the alternative
   */
  alt<L2>(other: EitherImpl<L2, R>): Either<L | L2, R> {
    if (this.isRight()) {
      return new EitherImpl(this._inner as any);
    }
    return new EitherImpl(other._inner as any);
  }
}

// Type alias for the public API
export type Either<L, R> = EitherImpl<L, R>;

// Static factory functions and utilities
export const Either = {
  // Factory functions that return EitherImpl instances
  left: <L, R = never>(value: L): Either<L, R> =>
    new EitherImpl(E.left(value)) as unknown as EitherImpl<L, R>,
  
  right: <R, L = never>(value: R): Either<L, R> =>
    new EitherImpl(E.right(value)) as unknown as EitherImpl<L, R>,
  
  try_: <R>(thunk: () => R): Either<unknown, R> =>
    new EitherImpl(E.try(thunk)),
  
  fromNullable: <R>(value: R | null | undefined): Either<null | undefined, R> => {
    if (value == null) {
      return new EitherImpl(E.left(value as null | undefined)) as unknown as EitherImpl<null | undefined, R>;
    }
    return new EitherImpl(E.right(value)) as unknown as EitherImpl<null | undefined, R>;
  },
  
  fromMaybe: <R>(maybe: Maybe<R>): Either<void, R> => {
    if (Maybe.isJust(maybe)) {
      return new EitherImpl(E.right(maybe.value)) as unknown as EitherImpl<void, R>;
    }
    return new EitherImpl(E.left(undefined as void)) as unknown as EitherImpl<void, R>;
  },
  
  fromEffectOption: <R>(option: O.Option<R>): Either<void, R> => {
    if (O.isSome(option)) {
      return new EitherImpl(E.right(option.value)) as unknown as EitherImpl<void, R>;
    }
    return new EitherImpl(E.left(undefined as void)) as unknown as EitherImpl<void, R>;
  },
  
  liftPredicate: <R, L>(
    predicate: (r: R) => boolean,
    onFalse: (r: R) => L
  ) => (value: R): EitherImpl<L, R> =>
    new EitherImpl(E.liftPredicate(predicate, onFalse)(value)),
  
  // Static methods for backward compatibility
  isLeft: <L, R>(either: Either<L, R> | EffectEither<R, L>): boolean => {
    if (either instanceof EitherImpl) {
      return either.isLeft();
    }
    return E.isLeft(either);
  },
  
  isRight: <L, R>(either: Either<L, R> | EffectEither<R, L>): boolean => {
    if (either instanceof EitherImpl) {
      return either.isRight();
    }
    return E.isRight(either);
  },
  
  getLeft: <L, R>(either: Either<L, R> | EffectEither<R, L>): Maybe<L> => {
    if (either instanceof EitherImpl) {
      return either.getLeft();
    }
    const option = E.getLeft(either);
    return O.isSome(option) ? Maybe.just(option.value) : Maybe.nothing<L>();
  },
  
  getRight: <L, R>(either: Either<L, R> | EffectEither<R, L>): Maybe<R> => {
    if (either instanceof EitherImpl) {
      return either.getRight();
    }
    const option = E.getRight(either);
    return O.isSome(option) ? Maybe.just(option.value) : Maybe.nothing<R>();
  },
  
  match: <L, R, U>(
    either: Either<L, R> | EffectEither<R, L>,
    handlers: { onLeft: (l: L) => U; onRight: (r: R) => U }
  ): U => {
    if (either instanceof EitherImpl) {
      return either.match(handlers);
    }
    return E.match(either, handlers);
  },
  
  map: <L, R, U>(
    either: Either<L, R> | EffectEither<R, L>,
    fn: (r: R) => U
  ): Either<L, U> => {
    if (either instanceof EitherImpl) {
      return either.map(fn);
    }
    return new EitherImpl(E.map(either, fn));
  },
  
  flatMap: <L, R, U>(
    either: Either<L, R> | EffectEither<R, L>,
    fn: (r: R) => Either<L, U>
  ): Either<L, U> => {
    if (either instanceof EitherImpl) {
      return either.flatMap(fn);
    }
    return new EitherImpl(E.flatMap(either, (r) => {
      const result = fn(r);
      return result instanceof EitherImpl ? result.inner : result;
    }));
  },
  
  getOrElse: <L, R, U>(
    either: Either<L, R> | EffectEither<R, L>,
    defaultValue: U
  ): R | U => {
    if (either instanceof EitherImpl) {
      return either.getOrElse(defaultValue);
    }
    return E.getOrElse(either, () => defaultValue);
  },
  
  getOrThrow: <L, R>(either: Either<L, R> | EffectEither<R, L>): R => {
    if (either instanceof EitherImpl) {
      return either.getOrThrow();
    }
    return E.getOrThrow(either);
  },
  
  getOrThrowWith: <L, R>(
    either: Either<L, R> | EffectEither<R, L>,
    onLeft: (l: L) => unknown
  ): R => {
    if (either instanceof EitherImpl) {
      return either.getOrThrowWith(onLeft);
    }
    return E.getOrThrowWith(either, onLeft);
  },
  
  mapLeft: <L, R, U>(
    either: Either<L, R> | EffectEither<R, L>,
    fn: (l: L) => U
  ): Either<U, R> => {
    if (either instanceof EitherImpl) {
      return either.mapLeft(fn);
    }
    return new EitherImpl(E.mapLeft(either, fn));
  },
  
  mapBoth: <L, R, U, V>(
    either: Either<L, R> | EffectEither<R, L>,
    options: { onLeft: (l: L) => U; onRight: (r: R) => V }
  ): Either<U, V> => {
    if (either instanceof EitherImpl) {
      return new EitherImpl(E.mapBoth(either.inner, options));
    }
    return new EitherImpl(E.mapBoth(either, options));
  },
  
  orElse: <L, R, U>(
    either: Either<L, R> | EffectEither<R, L>,
    alternative: () => Either<U, R>
  ): Either<L | U, R> => {
    if (either instanceof EitherImpl) {
      return new EitherImpl(E.orElse(either.inner, () => {
        const alt = alternative();
        return alt instanceof EitherImpl ? alt.inner : alt;
      })) as Either<L | U, R>;
    }
    return new EitherImpl(E.orElse(either, () => {
      const alt = alternative();
      return alt instanceof EitherImpl ? alt.inner : alt;
    })) as Either<L | U, R>;
  },
  
  flip: <L, R>(either: Either<L, R>): Either<R, L> => {
    if (either instanceof EitherImpl) {
      return either.flip();
    }
    return new EitherImpl(E.flip(either));
  },
  
  // Advanced combinators
  all: <T extends readonly Either<any, any>[]>(
    eithers: T
  ): Either<
    T[number] extends Either<infer L, any> ? L : never,
    { [K in keyof T]: T[K] extends Either<any, infer R> ? R : never }
  > => {
    const innerEithers = eithers.map(e => e.inner);
    return new EitherImpl(E.all(innerEithers)) as any;
  },
  
  zipWith: <L1, R1, L2, R2, R3>(
    left: Either<L1, R1>,
    right: Either<L2, R2>,
    fn: (
      r1: R1,
      r2: R2
    ) => R3
  ): Either<L1 | L2, R3> => {
    const leftInner = left instanceof EitherImpl ? left.inner : left;
    const rightInner = right instanceof EitherImpl ? right.inner : right;
    return new EitherImpl(E.zipWith(leftInner, rightInner, fn));
  },
  
  merge: <L, R>(either: Either<L, R>): L | R => {
    if (either instanceof EitherImpl) {
      return either.merge();
    }
    return E.merge(either);
  },
  
  // Effect conversion utilities
  toEffectEither: <L, R>(either: Either<L, R>): any => {
    const inner = either instanceof EitherImpl ? either.inner : either;
    return E.match(inner, {
      onLeft: (left) => ({ _tag: "Left", left }),
      onRight: (right) => ({ _tag: "Right", right }),
    });
  },
  
  fromEffectEither: <L, R>(effectEither: EffectEither<R, L>): Either<L, R> =>
    new EitherImpl(effectEither),
  
  // Generator and Do notation support
  gen: E.gen,
  
  Do: new EitherImpl(E.Do),
  
  bind: <N extends string, A, E2, B>(
    name: N,
    f: (a: A) => Either<E2, B>
  ) => <E1>(
    self: Either<E1, A>
  ): Either<E1 | E2, any> => {
    // Simplified implementation that avoids complex type constraints
    return self.flatMap((a: A) => {
      const result = f(a);
      if (result instanceof EitherImpl && result.isRight()) {
        const obj = {} as any;
        if (typeof a === 'object' && a !== null) {
          Object.assign(obj, a);
        }
        obj[name] = result.right;
        return Either.right(obj);
      } else if (result instanceof EitherImpl && result.isLeft()) {
        return result as any;
      }
      return result as any;
    }) as any;
  },
  
  bindTo: <N extends string>(name: N) => <E, A>(
    self: Either<E, A>
  ): Either<E, any> => {
    // Simplified implementation
    return self.map((a: A) => {
      const obj = {} as any;
      obj[name] = a;
      return obj;
    }) as any;
  },
  
  let_: <N extends string, A, B>(
    name: N,
    f: (a: A) => B
  ) => <E>(
    self: Either<E, A>
  ): Either<E, any> => {
    // Simplified implementation
    return self.map((a: A) => {
      const obj = {} as any;
      if (typeof a === 'object' && a !== null) {
        Object.assign(obj, a);
      }
      obj[name] = f(a);
      return obj;
    }) as any;
  },
  
  // Utility to wrap existing EffectEither instances
  wrap: <L, R>(effectEither: EffectEither<R, L>): Either<L, R> =>
    new EitherImpl(effectEither),
  
  // Curried versions for functional composition
  mapC: <R, U>(fn: (r: R) => U) => <L>(either: Either<L, R> | EffectEither<R, L>): Either<L, U> => {
    if (either instanceof EitherImpl) {
      return either.map(fn);
    }
    return new EitherImpl(E.map(either, fn));
  },
  
  flatMapC: <R, L, U>(fn: (r: R) => Either<L, U>) => (either: Either<L, R> | EffectEither<R, L>): Either<L, U> => {
    if (either instanceof EitherImpl) {
      return either.flatMap(fn);
    }
    return new EitherImpl(E.flatMap(either, (r) => {
      const result = fn(r);
      return result instanceof EitherImpl ? result.inner : result;
    }));
  },
  
  mapLeftC: <L, U>(fn: (l: L) => U) => <R>(either: Either<L, R> | EffectEither<R, L>): Either<U, R> => {
    if (either instanceof EitherImpl) {
      return either.mapLeft(fn);
    }
    return new EitherImpl(E.mapLeft(either, fn));
  },
  
  matchC: <L, R, U>(handlers: {
    onLeft: (l: L) => U;
    onRight: (r: R) => U
  }) => (either: Either<L, R> | EffectEither<R, L>): U => {
    if (either instanceof EitherImpl) {
      return either.match(handlers);
    }
    return E.match(either, handlers);
  },
  
  getOrElseC: <U>(defaultValue: U) => <L, R>(either: Either<L, R> | EffectEither<R, L>): R | U => {
    if (either instanceof EitherImpl) {
      return either.getOrElse(defaultValue);
    }
    return E.getOrElse(either, () => defaultValue);
  },
  
  getOrThrowWithC: <L>(onLeft: (l: L) => unknown) => <R>(either: Either<L, R> | EffectEither<R, L>): R => {
    if (either instanceof EitherImpl) {
      return either.getOrThrowWith(onLeft);
    }
    return E.getOrThrowWith(either, onLeft);
  },
  
  mapBothC: <L, R, U, V>(options: {
    onLeft: (l: L) => U;
    onRight: (r: R) => V
  }) => (either: Either<L, R> | EffectEither<R, L>): Either<U, V> => {
    if (either instanceof EitherImpl) {
      return new EitherImpl(E.mapBoth(either.inner, options));
    }
    return new EitherImpl(E.mapBoth(either, options));
  },
  
  orElseC: <L, R, U>(alternative: () => Either<U, R>) => (either: Either<L, R> | EffectEither<R, L>): Either<L | U, R> => {
    if (either instanceof EitherImpl) {
      return new EitherImpl(E.orElse(either.inner, () => {
        const alt = alternative();
        return alt instanceof EitherImpl ? alt.inner : alt;
      })) as Either<L | U, R>;
    }
    return new EitherImpl(E.orElse(either, () => {
      const alt = alternative();
      return alt instanceof EitherImpl ? alt.inner : alt;
    })) as Either<L | U, R>;
  },
  
  zipWithC: <R1, R2, R3>(fn: (
    r1: R1,
    r2: R2
  ) => R3) => <L1, L2>(
    left: Either<L1, R1>,
    right: Either<L2, R2>
  ): Either<L1 | L2, R3> => {
    const leftInner = left instanceof EitherImpl ? left.inner : left;
    const rightInner = right instanceof EitherImpl ? right.inner : right;
    return new EitherImpl(E.zipWith(leftInner, rightInner, fn));
  },
  
  liftPredicateC: <R, L>(
    predicate: (r: R) => boolean,
    onFalse: (r: R) => L
  ) => (value: R): EitherImpl<L, R> =>
    new EitherImpl(E.liftPredicate(predicate, onFalse)(value)),
  
  bindC: <N extends string, A, E2, B>(
    name: N,
    f: (a: A) => Either<E2, B>
  ) => <E1>(self: Either<E1, A>): Either<E1 | E2, any> => {
    return self.flatMap((a: A) => {
      const result = f(a);
      if (result instanceof EitherImpl && result.isRight()) {
        const obj = {} as any;
        if (typeof a === 'object' && a !== null) {
          Object.assign(obj, a);
        }
        obj[name] = result.right;
        return Either.right(obj);
      } else if (result instanceof EitherImpl && result.isLeft()) {
        return result as any;
      }
      return result as any;
    }) as any;
  },
  
  bindToC: <N extends string>(name: N) => <E, A>(self: Either<E, A>): Either<E, any> => {
    return self.map((a: A) => {
      const obj = {} as any;
      obj[name] = a;
      return obj;
    }) as any;
  },
  
  letC: <N extends string, A, B>(
    name: N,
    f: (a: A) => B
  ) => <E>(self: Either<E, A>): Either<E, any> => {
    return self.map((a: A) => {
      const obj = {} as any;
      if (typeof a === 'object' && a !== null) {
        Object.assign(obj, a);
      }
      obj[name] = f(a);
      return obj;
    }) as any;
  }
};
