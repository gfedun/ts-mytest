export type Tuple<Length, Type, Acc extends Array<Type> = []> =
  Length extends Acc['length']
    ? Readonly<Acc>
    : Tuple<Length, Type, [...Acc, Type]>

export type Resolve<T> = T extends Function ? T : { [K in keyof T]: T[K] };

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type DeepPartial<Thing> = Thing extends Function
  ? Thing
  : Thing extends Array<infer InferredArrayMember>
    ? DeepPartialArray<InferredArrayMember>
    : Thing extends object
      ? DeepPartialObject<Thing>
      : Thing | undefined;

interface DeepPartialArray<Thing>
  extends Array<DeepPartial<Thing>> {}

type DeepPartialObject<Thing> = {
  [Key in keyof Thing]?: DeepPartial<Thing[Key]>;
};

/**
 * `DeepReadonly<T>` is a recursive TypeScript utility type that makes all properties of an object type `T` deeply immutable.
 *
 * - If `T` is a function, it is left unchanged.
 * - If `T` is an array, all elements are recursively made deeply readonly.
 * - If `T` is an object, all properties are recursively made deeply readonly.
 * - For all other types, the type is returned as-is or `undefined`.
 *
 * ## Example
 * ```typescript
 * type Example = {
 *   foo: {
 *     bar: number[]
 *   }
 * }
 * type ReadonlyExample = DeepReadonly<Example>
 * // {
 * //   readonly foo: {
 * //     readonly bar: readonly number[]
 * //   }
 * // }
 */
export type DeepReadonly<Thing> = Thing extends Function
  ? Thing
  : Thing extends Array<infer InferredArrayMember>
    ? DeepReadonlyArray<InferredArrayMember>
    : Thing extends object
      ? DeepReadonlyObject<Thing>
      : Thing | undefined;

interface DeepReadonlyArray<Thing>
  extends Array<DeepReadonly<Thing>> {}

type DeepReadonlyObject<Thing> = {
  readonly [Key in keyof Thing]: DeepReadonly<Thing[Key]>;
};

export type Head<T extends any[]> =
  T extends [infer TT, ...any[]] ? TT : never

export type Tail<T extends any[]> =
  ((...t: T) => any) extends ((
    _: any,
    ...tail: infer TT
  ) => any) ? TT : []

export type HasTail<T extends any[]> =
  T extends ([] | [any]) ? false : true

export type Last<T extends any[]> = {
  0: Last<Tail<T>>
  1: Head<T>
} [ HasTail<T> extends true ? 0 : 1 ]
