# Maybe Package Documentation

A sophisticated TypeScript implementation of the Maybe monad for safe handling of optional values, eliminating
null/undefined errors and providing elegant composition patterns.

## Table of Contents

1. [Overview](#overview)
2. [Installation and Setup](#installation-and-setup)
3. [Core Concepts](#core-concepts)
4. [Types and Interfaces](#types-and-interfaces)
5. [Maybe Class API](#maybe-class-api)
6. [Static Factory Methods](#static-factory-methods)
7. [Instance Methods](#instance-methods)
8. [Pattern Matching](#pattern-matching)
9. [Usage Examples](#usage-examples)
10. [Best Practices](#best-practices)
11. [Integration with Effect](#integration-with-effect)
12. [API Reference](#api-reference)

## Overview

The Maybe package provides a type-safe way to handle optional values in TypeScript, completely eliminating null and
undefined errors. It's built on top of Effect's Option type but provides a more familiar object-oriented interface with
Haskell-style naming conventions.

### Key Features

- ✅ **Null Safety**: Complete elimination of null/undefined runtime errors
- ✅ **Functional Composition**: Chainable operations with map, flatMap, filter
- ✅ **Pattern Matching**: Elegant handling of both success and failure cases
- ✅ **Type Safety**: Full TypeScript support with automatic type inference
- ✅ **Effect Integration**: Built on Effect's robust Option implementation
- ✅ **Rich API**: Both functional and object-oriented programming styles
- ✅ **Performance**: Optimized for production use with minimal overhead

### When to Use Maybe

- **API responses** with optional fields
- **Configuration values** that might be missing
- **Database queries** that may return no results
- **Form validation** with optional fields
- **Safe array/object property access**
- **Error-prone operations** like parsing or division

## Installation and Setup

```typescript
import { Maybe } from '@/maybe';

// Basic usage
const value = Maybe.just("Hello World");
const empty = Maybe.nothing<string>();
```

## Core Concepts

### Maybe States

A Maybe can be in one of two states:

1. **Just(value)** - Contains a value
2. **Nothing** - Represents absence of a value

```typescript
// Just - contains a value
const justValue = Maybe.just(42);
console.log(justValue.toString()); // "Just(42)"

// Nothing - represents absence
const nothingValue = Maybe.nothing<number>();
console.log(nothingValue.toString()); // "Nothing"
```

### Type Safety

Maybe provides compile-time and runtime safety:

```typescript
// ❌ Traditional approach - prone to errors
function getUserName(user: User | null): string {
  return user.name; // Runtime error if user is null
}

// ✅ Maybe approach - safe by design
function getUserName(user: Maybe<User>): string {
  return user.map(u => u.name).getOrElse("Unknown");
}
```

## Types and Interfaces

### MatchHandlers<T, U>

Interface for pattern matching handlers using Haskell-style naming:

```typescript
export interface MatchHandlers<T, U> {
  /** Handler called when the Maybe contains nothing (None case) */
  onNothing: () => U;
  /** Handler called when the Maybe contains a value (Some case) */
  onJust: (value: T) => U;
}
```

**Usage:**

```typescript
const result = maybe.match({
  onJust: (value) => `Found: ${value}`,
  onNothing: () => "No value found"
});
```

### MatchFunction

Type definition for the static match function:

```typescript
export type MatchFunction = <A, B>(
  maybe: Maybe<A>,
  handlers: MatchHandlers<A, B>
) => B;
```

**Usage:**

```typescript
const result = Maybe.match(maybeValue, {
  onJust: (value) => value.toUpperCase(),
  onNothing: () => "DEFAULT"
});
```

## Maybe Class API

### Class Structure

```typescript
export class Maybe<T> {
  private constructor(private readonly _option: Option<T>);
  
  // Factory methods
  static just<T>(value: T): Maybe<T>;
  static nothing<T = any>(): Maybe<T>;
  static fromNullable<T>(value: T | null | undefined): Maybe<NonNullable<T>>;
  
  // Instance methods
  map<U>(f: (value: T) => U): Maybe<U>;
  flatMap<U>(f: (value: T) => Maybe<U>): Maybe<U>;
  filter(predicate: (value: T) => boolean): Maybe<T>;
  getOrElse<U>(defaultValue: U): T | U;
  
  // Query methods
  isJust(): boolean;
  isNothing(): boolean;
  
  // Pattern matching
  match<U>(handlers: MatchHandlers<T, U>): U;
}
```

## Static Factory Methods

### Maybe.just<T>(value: T)

Creates a Maybe containing a value.

```typescript
const number = Maybe.just(42);
const string = Maybe.just("Hello");
const object = Maybe.just({ name: "Alice", age: 30 });

console.log(number.toString()); // "Just(42)"
```

### Maybe.nothing<T>()

Creates an empty Maybe representing absence of value.

```typescript
const empty = Maybe.nothing<string>();
const emptyNumber = Maybe.nothing<number>();

console.log(empty.toString()); // "Nothing"
```

### Maybe.fromNullable<T>(value: T | null | undefined)

Creates a Maybe from a potentially null/undefined value.

```typescript
const fromValue = Maybe.fromNullable("Hello"); // Just("Hello")
const fromNull = Maybe.fromNullable(null);     // Nothing
const fromUndefined = Maybe.fromNullable(undefined); // Nothing

// Safe property access
const user = getUser(); // Returns User | null
const userName = Maybe.fromNullable(user)
  .map(u => u.name)
  .getOrElse("Guest");
```

### Maybe.fromBoolean<T>(condition: boolean)

Creates a conditional Maybe factory based on a boolean condition.

```typescript
const isLoggedIn = true;
const welcomeMessage = Maybe.fromBoolean(isLoggedIn)("Welcome back!");

console.log(welcomeMessage.toString()); // "Just(Welcome back!)"

// Usage in validation
const validateAge = (age: number) =>
  Maybe.fromBoolean(age >= 18)("Valid age");
```

### Maybe.liftPredicate<T>(predicate: (a: T) => boolean)

Lifts a predicate into a Maybe-returning function.

```typescript
const isEven = Maybe.liftPredicate<number>(n => n % 2 === 0);

const evenResult = isEven(4); // Just(4)
const oddResult = isEven(3);  // Nothing

// Usage with validation
const isValidEmail = Maybe.liftPredicate<string>(
  email => email.includes("@") && email.includes(".")
);
```

### Maybe.all<T>(maybes: Maybe<T>[])

Combines multiple Maybes into a single Maybe containing an array.

```typescript
const numbers = Maybe.all([
  Maybe.just(1),
  Maybe.just(2),
  Maybe.just(3)
]); // Just([1, 2, 3])

const withNothing = Maybe.all([
  Maybe.just(1),
  Maybe.nothing<number>(),
  Maybe.just(3)
]); // Nothing

// Practical usage - validate all fields
const validateForm = (data: FormData) => Maybe.all([
  validateEmail(data.email),
  validatePassword(data.password),
  validateAge(data.age)
]);
```

### Maybe.firstJustOf<T>(maybes: Maybe<T>[])

Returns the first Just value from an array of Maybes.

```typescript
const first = Maybe.firstJustOf([
  Maybe.nothing<string>(),
  Maybe.nothing<string>(),
  Maybe.just("Found!"),
  Maybe.just("Also found")
]); // Just("Found!")

// Configuration fallback pattern
const getConfig = () => Maybe.firstJustOf([
  getConfigFromEnv(),
  getConfigFromFile(),
  getDefaultConfig()
]);
```

## Instance Methods

### Transformation Methods

#### map<U>(f: (value: T) => U): Maybe<U>

Transforms the value inside the Maybe using the provided function.

```typescript
const number = Maybe.just(10);
const doubled = number.map(x => x * 2);
const stringified = doubled.map(x => `Value: ${x}`);

console.log(stringified.toString()); // "Just(Value: 20)"

// Chaining transformations
const result = Maybe.just("hello")
  .map(s => s.toUpperCase())
  .map(s => s + "!")
  .map(s => `Message: ${s}`);
// Just("Message: HELLO!")
```

#### flatMap<U>(f: (value: T) => Maybe<U>): Maybe<U>

Applies a function that returns a Maybe to the value inside this Maybe.

```typescript
const parseNumber = (str: string): Maybe<number> => {
  const num = parseInt(str);
  return isNaN(num) ? Maybe.nothing() : Maybe.just(num);
};

const validParse = Maybe.just("42").flatMap(parseNumber);
// Just(42)

const invalidParse = Maybe.just("abc").flatMap(parseNumber);
// Nothing

// Chaining operations that might fail
const result = Maybe.just("10")
  .flatMap(parseNumber)
  .flatMap(num => num > 0 ? Maybe.just(num) : Maybe.nothing())
  .map(num => num * 2);
```

#### filter(predicate: (value: T) => boolean): Maybe<T>

Filters the value based on a predicate.

```typescript
const evenNumbers = Maybe.just(8).filter(x => x % 2 === 0);
// Just(8)

const oddNumbers = Maybe.just(7).filter(x => x % 2 === 0);
// Nothing

// Validation with filter
const validateAge = (age: number) => 
  Maybe.just(age).filter(a => a >= 18 && a <= 100);
```

### Extraction Methods

#### getOrElse<U>(defaultValue: U): T | U

Gets the value or returns a default.

```typescript
const value = Maybe.just("Hello").getOrElse("Default");
// "Hello"

const defaulted = Maybe.nothing<string>().getOrElse("Default");
// "Default"

// Configuration with fallbacks
const port = getConfigPort().getOrElse(3000);
const host = getConfigHost().getOrElse("localhost");
```

#### getOrUndefined(): T | undefined

Gets the value or returns undefined.

```typescript
const value = Maybe.just("Hello").getOrUndefined();
// "Hello"

const empty = Maybe.nothing<string>().getOrUndefined();
// undefined
```

#### getOrNull(): T | null

Gets the value or returns null.

```typescript
const value = Maybe.just("Hello").getOrNull();
// "Hello"

const empty = Maybe.nothing<string>().getOrNull();
// null
```

#### getOrThrow(errorMessage?: string): T

Gets the value or throws an error.

```typescript
const value = Maybe.just("Hello").getOrThrow();
// "Hello"

const error = Maybe.nothing<string>().getOrThrow("Value required");
// Throws: Error("Value required")
```

### Query Methods

#### isJust(): boolean

Checks if this Maybe contains a value.

```typescript
const hasValue = Maybe.just(42).isJust(); // true
const isEmpty = Maybe.nothing().isJust(); // false

if (maybeUser.isJust()) {
  console.log("User is logged in");
}
```

#### isNothing(): boolean

Checks if this Maybe is empty.

```typescript
const hasValue = Maybe.just(42).isNothing(); // false
const isEmpty = Maybe.nothing().isNothing(); // true

if (maybeError.isNothing()) {
  console.log("No errors found");
}
```

#### contains(value: T): boolean

Checks if this Maybe contains a specific value.

```typescript
const number = Maybe.just(42);
console.log(number.contains(42)); // true
console.log(number.contains(24)); // false

const empty = Maybe.nothing<number>();
console.log(empty.contains(42)); // false
```

#### exists(predicate: (value: T) => boolean): boolean

Checks if the value satisfies a predicate.

```typescript
const number = Maybe.just(42);
console.log(number.exists(x => x > 40)); // true
console.log(number.exists(x => x < 40)); // false

const empty = Maybe.nothing<number>();
console.log(empty.exists(x => x > 40)); // false
```

### Utility Methods

#### orElse<U>(alternative: Maybe<U>): Maybe<T | U>

Returns this Maybe if it's Just, otherwise returns the alternative.

```typescript
const primary = Maybe.nothing<string>();
const backup = Maybe.just("Backup value");

const result = primary.orElse(backup);
// Just("Backup value")

// Configuration fallback chain
const config = getConfigFromEnv()
  .orElse(getConfigFromFile())
  .orElse(getDefaultConfig());
```

#### tap(f: (value: T) => void): Maybe<T>

Executes a side effect if this Maybe contains a value.

```typescript
const result = Maybe.just("Hello")
  .tap(value => console.log(`Processing: ${ value }`))
  .map(s => s.toUpperCase());

// Logs: "Processing: Hello"
// Returns: Just("HELLO")
```

#### forEach(f: (value: T) => void): void

Executes a side effect if this Maybe contains a value.

```typescript
Maybe.just("Hello").forEach(value => {
  console.log(`Value: ${value}`);
}); // Logs: "Value: Hello"

Maybe.nothing<string>().forEach(value => {
  console.log(`Value: ${value}`);
}); // Nothing logged
```

#### toArray(): T[]

Converts this Maybe to an array.

```typescript
const justArray = Maybe.just("item").toArray();
// ["item"]

const nothingArray = Maybe.nothing<string>().toArray();
// []

// Useful for filtering
const items = [maybe1, maybe2, maybe3]
  .flatMap(maybe => maybe.toArray());
```

## Pattern Matching

### match<U>(handlers: MatchHandlers<T, U>): U

Pattern matches on this Maybe using Haskell-style naming.

```typescript
const result = maybe.match({
  onJust: (value) => `Found: ${value}`,
  onNothing: () => "No value found"
});

// Complex pattern matching
const processUser = (maybeUser: Maybe<User>) => {
  return maybeUser.match({
    onJust: (user) => {
      if (user.isActive) {
        return `Welcome back, ${user.name}!`;
      } else {
        return `Account suspended: ${user.name}`;
      }
    },
    onNothing: () => "Please log in to continue"
  });
};
```

### Static Pattern Matching

```typescript
const result = Maybe.match(maybeValue, {
  onJust: (value) => value.toUpperCase(),
  onNothing: () => "DEFAULT"
});
```

## Usage Examples

### 1. Safe Configuration Access

```typescript
interface Config {
  database?: {
    host?: string;
    port?: number;
    ssl?: boolean;
  };
  api?: {
    key?: string;
    timeout?: number;
  };
}

const config: Config = loadConfig();

// Safe property access with defaults
const dbHost = Maybe.fromNullable(config.database?.host)
  .getOrElse("localhost");

const dbPort = Maybe.fromNullable(config.database?.port)
  .getOrElse(5432);

const apiTimeout = Maybe.fromNullable(config.api?.timeout)
  .getOrElse(5000);

// Building connection string safely
const connectionString = Maybe.fromNullable(config.database?.host)
  .flatMap(host =>
    Maybe.fromNullable(config.database?.port)
      .map(port => `${ host }:${ port }`)
  )
  .map(hostPort => {
    const ssl = Maybe.fromNullable(config.database?.ssl).getOrElse(false);
    return `postgres://${ hostPort }/mydb${ ssl ? '?ssl=true' : '' }`;
  })
  .getOrElse("postgres://localhost:5432/mydb");
```

### 2. API Response Handling

```typescript
interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  profile?: {
    avatar?: string;
    bio?: string;
  };
}

// Safe API response processing
const processUserResponse = (response: ApiResponse<User>): string => {
  return Maybe.fromNullable(response.data)
    .filter(() => response.status === 200)
    .match({
      onJust: (user) => {
        const name = user.name;
        const bio = Maybe.fromNullable(user.profile?.bio)
          .getOrElse("No bio available");
        const avatar = Maybe.fromNullable(user.profile?.avatar)
          .getOrElse("default-avatar.png");
        
        return `${name} - ${bio} (${avatar})`;
      },
      onNothing: () => response.error || "User not found"
    });
};
```

### 3. Form Validation

```typescript
interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  age: string;
}

// Validation functions returning Maybe
const validateEmail = (email: string): Maybe<string> => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return Maybe.fromBoolean(emailRegex.test(email))(email);
};

const validatePassword = (password: string): Maybe<string> => {
  return Maybe.fromBoolean(password.length >= 8)(password);
};

const validateAge = (ageStr: string): Maybe<number> => {
  const age = parseInt(ageStr);
  return Maybe.fromBoolean(!isNaN(age) && age >= 18 && age <= 100)(age);
};

const validatePasswordMatch = (
  password: string,
  confirm: string
): Maybe<string> => {
  return Maybe.fromBoolean(password === confirm)(password);
};

// Complete form validation
const validateForm = (data: FormData): Maybe<{ email: string; password: string; age: number }> => {
  return Maybe.all([
    validateEmail(data.email),
    validatePassword(data.password),
    validatePasswordMatch(data.password, data.confirmPassword),
    validateAge(data.age).map(String) // Convert to string for consistency
  ]).flatMap(([email, password, _, ageStr]) => {
    return validateAge(data.age).map(age => ({ email, password, age }));
  });
};

// Usage
const formResult = validateForm(formData);
formResult.match({
  onJust: (validData) => submitForm(validData),
  onNothing: () => showValidationErrors()
});
```

### 4. Database Query Chain

```typescript
interface User {
  id: number;
  name: string;
  departmentId?: number;
}

interface Department {
  id: number;
  name: string;
  managerId?: number;
}

// Safe database operations
const findUserById = (id: number): Maybe<User> => {
  const user = users.find(u => u.id === id);
  return Maybe.fromNullable(user);
};

const findDepartmentById = (id: number): Maybe<Department> => {
  const dept = departments.find(d => d.id === id);
  return Maybe.fromNullable(dept);
};

// Complex query: Get user's manager
const getUserManager = (userId: number): Maybe<User> => {
  return findUserById(userId)
    .flatMap(user => Maybe.fromNullable(user.departmentId))
    .flatMap(findDepartmentById)
    .flatMap(dept => Maybe.fromNullable(dept.managerId))
    .flatMap(findUserById)
    .filter(manager => manager.id !== userId); // User can't be their own manager
};

// Usage
const manager = getUserManager(123);
manager.match({
  onJust: (mgr) => console.log(`Manager: ${ mgr.name }`),
  onNothing: () => console.log("No manager found")
});
```

### 5. Advanced Functional Patterns

```typescript
// Utility: Lift a regular function to work with Maybe
const liftFunction = <A, B>(f: (a: A) => B) => (maybe: Maybe<A>): Maybe<B> => {
  return maybe.map(f);
};

const addOne = (x: number) => x + 1;
const liftedAddOne = liftFunction(addOne);

const result = liftedAddOne(Maybe.just(5)); // Just(6)

// Utility: Traverse an array with a Maybe-returning function
const traverse = <A, B>(
  arr: A[],
  f: (a: A) => Maybe<B>
): Maybe<B[]> => {
  const maybes = arr.map(f);
  return Maybe.all(maybes);
};

const parseNumbers = (strings: string[]): Maybe<number[]> => {
  return traverse(strings, str => {
    const num = parseInt(str);
    return isNaN(num) ? Maybe.nothing() : Maybe.just(num);
  });
};

const validNumbers = parseNumbers(["1", "2", "3"]); // Just([1, 2, 3])
const invalidNumbers = parseNumbers(["1", "abc", "3"]); // Nothing

// Conditional Maybe creation
const when = <T>(
  condition: boolean,
  value: T
): Maybe<T> => {
  return condition ? Maybe.just(value) : Maybe.nothing();
};

const unless = <T>(
  condition: boolean,
  value: T
): Maybe<T> => {
  return !condition ? Maybe.just(value) : Maybe.nothing();
};

const evenOnly = (n: number) => when(n % 2 === 0, n);
const oddOnly = (n: number) => unless(n % 2 === 0, n);
```

## Best Practices

### 1. Prefer Maybe Over Null Checks

```typescript
// ❌ Traditional null checking
function getFirstName(user: User | null): string {
  if (user && user.profile && user.profile.name) {
    return user.profile.name.split(' ')[0];
  }
  return 'Unknown';
}

// ✅ Maybe approach
function getFirstName(user: Maybe<User>): string {
  return user
    .flatMap(u => Maybe.fromNullable(u.profile))
    .flatMap(p => Maybe.fromNullable(p.name))
    .map(name => name.split(' ')[0])
    .getOrElse('Unknown');
}
```

### 2. Use Appropriate Extraction Methods

```typescript
// ✅ Use getOrElse for defaults
const port = getPort().getOrElse(3000);

// ✅ Use getOrUndefined for optional values
const optionalValue = getValue().getOrUndefined();

// ✅ Use getOrThrow when value is required
const requiredConfig = getRequiredConfig().getOrThrow('Config missing');

// ✅ Use pattern matching for complex logic
const message = getUser().match({
  onJust: (user) => user.isActive ? `Welcome ${ user.name }` : 'Account suspended',
  onNothing: () => 'Please log in'
});
```

### 3. Chain Operations Effectively

```typescript
// ✅ Chain related operations
const result = getUser()
  .filter(user => user.isActive)
  .map(user => user.preferences)
  .flatMap(prefs => Maybe.fromNullable(prefs.theme))
  .getOrElse('default');

// ✅ Use flatMap for operations that return Maybe
const userEmail = getUserId()
  .flatMap(findUserById)
  .map(user => user.email)
  .getOrElse('no-email@example.com');
```

### 4. Handle Collections Properly

```typescript
// ✅ Use Maybe.all for validation
const validateInputs = (inputs: string[]) => {
  const validations = inputs.map(validateInput);
  return Maybe.all(validations);
};

// ✅ Use firstJustOf for fallbacks
const getConfig = () => Maybe.firstJustOf([
  getConfigFromEnvironment(),
  getConfigFromFile(),
  getDefaultConfig()
]);

// ✅ Filter and process arrays
const validUsers = users
  .map(user => Maybe.fromNullable(user))
  .filter(maybe => maybe.isJust())
  .map(maybe => maybe.getOrThrow());
```

### 5. Error Handling Patterns

```typescript
// ✅ Use Maybe for operations that might fail
const safeDivide = (a: number, b: number): Maybe<number> => {
  return b === 0 ? Maybe.nothing() : Maybe.just(a / b);
};

// ✅ Combine with Either for detailed error information
const parseWithError = (str: string): Either<string, number> => {
  const result = parseNumber(str);
  return result.match({
    onJust: (num) => Either.right(num),
    onNothing: () => Either.left(`Invalid number: ${str}`)
  });
};
```

## Integration with Effect

The Maybe class is built on top of Effect's Option type, providing seamless integration:

```typescript
import { Option } from 'effect/Option';

// Access underlying Option
const maybe = Maybe.just(42);
const option: Option<number> = maybe.valueOf();

// Effect generators
const program = Maybe.gen(function* () {
  const a = yield* Maybe.just(10);
  const b = yield* Maybe.just(20);
  return a + b;
}); // Just(30)

// Effect Do notation
const result = Maybe.Do
  .bind('x', Maybe.just(10))
  .bind('y', Maybe.just(20))
  .map(({ x, y }) => x + y); // Just(30)
```

## API Reference

### Static Methods

```typescript
// Factory methods
static
just<T>(value
:
T
):
Maybe<T>
static
nothing<T = any>()
:
Maybe<T>
static
fromNullable<T>(value
:
T | null | undefined
):
Maybe<NonNullable<T>>
static
fromBoolean<T>(condition
:
boolean
):
(value: T) => Maybe<T>
static
liftPredicate<T>(predicate
:
(a: T) => boolean
):
(a: T) => Maybe<T>

// Collection methods
static
all<T>(maybes
:
Maybe < T > []
):
Maybe<T[]>
static
firstJustOf<T>(maybes
:
Maybe < T > []
):
Maybe<T>

// Pattern matching
static
match<T, U>(maybe
:
Maybe<T>, handlers
:
MatchHandlers<T, U>
):
U

// Functional versions (curried and non-curried)
static
map<T, U>(maybe
:
Maybe<T>, f
:
(value: T) => U
):
Maybe<U>
static
mapC<T, U>(f
:
(value: T) => U
):
(maybe: Maybe<T>) => Maybe<U>
static
flatMap<T, U>(maybe
:
Maybe<T>, f
:
(value: T) => Maybe<U>
):
Maybe<U>
static
flatMapC<T, U>(f
:
(value: T) => Maybe<U>
):
(maybe: Maybe<T>) => Maybe<U>
static
filter<T>(maybe
:
Maybe<T>, predicate
:
(value: T) => boolean
):
Maybe<T>
static
filterC<T>(predicate
:
(value: T) => boolean
):
(maybe: Maybe<T>) => Maybe<T>
static
getOrElse<T, U>(maybe
:
Maybe<T>, defaultValue
:
U
):
T | U
static
getOrElseC<T, U>(defaultValue
:
U
):
(maybe: Maybe<T>) => T | U
```

### Instance Methods

```typescript
// Query methods
isJust()
:
boolean
isNothing()
:
boolean
contains(value
:
T
):
boolean
exists(predicate
:
(value: T) => boolean
):
boolean

// Transformation methods
map<U>(f
:
(value: T) => U
):
Maybe<U>
flatMap<U>(f
:
(value: T) => Maybe<U>
):
Maybe<U>
filter(predicate
:
(value: T) => boolean
):
Maybe<T>

// Extraction methods
getOrElse<U>(defaultValue
:
U
):
T | U
getOrUndefined()
:
T | undefined
getOrNull()
:
T | null
getOrThrow(errorMessage ? : string)
:
T

// Utility methods
orElse<U>(alternative
:
Maybe<U>
):
Maybe<T | U>
tap(f
:
(value: T) => void
):
Maybe<T>
forEach(f
:
(value: T) => void
):
void
  toArray()
:
T[]
match<U>(handlers
:
MatchHandlers<T, U>
):
U
toString()
:
string
valueOf()
:
Option<T>

// Applicative methods
ap<U>(maybeF
:
Maybe<(value: T) => U>
):
Maybe<U>
```

### Type Definitions

```typescript
interface MatchHandlers<T, U> {
  onNothing: () => U;
  onJust: (value: T) => U;
}

type MatchFunction = <A, B>(
  maybe: Maybe<A>,
  handlers: MatchHandlers<A, B>
) => B;
```

---

This comprehensive documentation covers all aspects of the Maybe package, providing developers with the knowledge needed
to effectively use the Maybe monad for safe, elegant optional value handling in TypeScript applications.
