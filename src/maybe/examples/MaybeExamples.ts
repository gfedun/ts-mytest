/**
 * @fileoverview Comprehensive Examples for the Maybe Monad
 *
 * This file demonstrates practical usage patterns for the Maybe type,
 * including basic operations, chaining, error handling, and real-world scenarios.
 *
 * The Maybe monad is used for handling optional values safely, avoiding null/undefined errors.
 *
 * @author CLA Examples
 * @version 1.0.0
 */

import { Maybe } from '../Maybe';

// =============================================================================
// Type Definitions
// =============================================================================

// User types for various examples
export interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  avatar?: string;
  lastLogin?: Date;
}

export interface ValidationResult {
  isValid: boolean;
  data?: FormData;
  errors: string[];
}

export interface FormData {
  name: string;
  email: string;
  age?: number | undefined;
  phone?: string | undefined;
  website?: string | undefined;
}

export interface Department {
  id: number;
  name: string;
  budget: number;
}

// =============================================================================
// Basic Maybe Creation and Usage
// =============================================================================

/**
 * Example 1: Basic Maybe Creation
 * Demonstrates different ways to create Maybe instances
 */
export function basicMaybeCreation() {
  console.log('=== Basic Maybe Creation ===');
  
  // Creating a Just (some value)
  const justValue = Maybe.just(42);
  console.log(`Just value: ${ justValue.toString() }`); // "Just(42)"
  
  // Creating Nothing (no value)
  const nothingValue = Maybe.nothing<number>();
  console.log(`Nothing value: ${ nothingValue.toString() }`); // "Nothing"
  
  // Creating Maybe from nullable values
  const fromValue = Maybe.fromNullable("Hello");
  const fromNull = Maybe.fromNullable(null);
  const fromUndefined = Maybe.fromNullable(undefined);
  
  console.log(`From value: ${ fromValue.toString() }`); // "Just(Hello)"
  console.log(`From null: ${ fromNull.toString() }`); // "Nothing"
  console.log(`From undefined: ${ fromUndefined.toString() }`); // "Nothing"
  
  // Creating Maybe conditionally
  const conditionalMaybe = (
    condition: boolean,
    value: string
  ): Maybe<string> => {
    return condition ? Maybe.just(value) : Maybe.nothing();
  };
  
  const trueMaybe = conditionalMaybe(true, "Success");
  const falseMaybe = conditionalMaybe(false, "Failure");
  
  console.log(`True condition: ${ trueMaybe.toString() }`); // "Just(Success)"
  console.log(`False condition: ${ falseMaybe.toString() }`); // "Nothing"
  
  // Safe property access
  const safeProperty = <T, K extends keyof T>(
    obj: T | null | undefined,
    key: K
  ): Maybe<T[K]> => {
    if (!obj || obj[key] === undefined) {
      return Maybe.nothing<T[K]>();
    }
    return Maybe.just(obj[key] as T[K]);
  };
  
  const user = { name: "John", age: 30 };
  const userName = safeProperty(user, "name");
  const userAge = safeProperty(user, "age");
  const userEmail = safeProperty(user, "email" as keyof typeof user);
  
  console.log(`User name: ${ userName.toString() }`);
  console.log(`User age: ${ userAge.toString() }`);
  console.log(`User email: ${ userEmail.toString() }`);
  
  return {
    justValue,
    nothingValue,
    fromValue,
    fromNull,
    fromUndefined,
    trueMaybe,
    falseMaybe,
    userName,
    userAge,
    userEmail
  };
}

// =============================================================================
// Safe Value Extraction
// =============================================================================

/**
 * Example 2: Safe Value Extraction
 * Shows different ways to safely extract values from Maybe
 */
export function safeValueExtraction() {
  console.log('=== Safe Value Extraction ===');
  
  const someValue = Maybe.just(100);
  const noValue = Maybe.nothing<number>();
  
  // Using getOrElse for default values
  const withDefault = someValue.getOrElse(0);
  const withDefaultEmpty = noValue.getOrElse(0);
  
  console.log(`Some with default: ${ withDefault }`); // 100
  console.log(`None with default: ${ withDefaultEmpty }`); // 0
  
  // Using getOrUndefined for optional access
  const maybeUndefined = someValue.getOrUndefined();
  const definitelyUndefined = noValue.getOrUndefined();
  
  console.log(`Maybe undefined: ${ maybeUndefined }`); // 100
  console.log(`Definitely undefined: ${ definitelyUndefined }`); // undefined
  
  // Using match for pattern matching
  const processValue = (maybe: Maybe<number>): string => {
    return maybe.match({
      onJust: (value) => `Found: ${ value }`,
      onNothing: () => 'Not found'
    });
  };
  
  console.log(processValue(someValue)); // "Found: 100"
  console.log(processValue(noValue)); // "Not found"
  
  // Conditional execution
  someValue.match({
    onJust: (value) => console.log(`Processing: ${ value }`),
    onNothing: () => {}
  });
  
  noValue.match({
    onJust: () => {},
    onNothing: () => console.log('Nothing to process')
  });
  
  return {
    someValue,
    noValue,
    withDefault,
    withDefaultEmpty,
    maybeUndefined,
    definitelyUndefined
  };
}

// =============================================================================
// Transformation and Chaining
// =============================================================================

/**
 * Example 3: Transformation and Chaining
 * Demonstrates map, flatMap, and chaining operations
 */
export function transformationAndChaining() {
  console.log('=== Transformation and Chaining ===');
  
  const parseNumber = (str: string): Maybe<number> => {
    const num = parseInt(str, 10);
    return isNaN(num) ? Maybe.nothing() : Maybe.just(num);
  };
  
  const sqrt = (n: number): Maybe<number> => {
    return n < 0 ? Maybe.nothing() : Maybe.just(Math.sqrt(n));
  };
  
  // Successful chain
  const validInput = "16";
  const successChain = parseNumber(validInput)
    .map(x => x * 2)
    .flatMap(sqrt);
  
  console.log(`Success chain: ${ successChain.toString() }`); // "Just(8)"
  
  // Failed at parsing
  const invalidInput = "abc";
  const parseFailChain = parseNumber(invalidInput)
    .map(x => x * 2)
    .flatMap(sqrt);
  
  console.log(`Parse fail chain: ${ parseFailChain.toString() }`); // "Nothing"
  
  // Failed at sqrt
  const negativeInput = "-4";
  const sqrtFailChain = parseNumber(negativeInput)
    .map(x => x * 2)
    .flatMap(sqrt);
  
  console.log(`Sqrt fail chain: ${ sqrtFailChain.toString() }`); // "Nothing"
  
  // Filter operation
  const evenNumbers = Maybe.just(8).filter(n => n % 2 === 0);
  const oddNumbers = Maybe.just(7).filter(n => n % 2 === 0);
  
  console.log(`Even filter: ${ evenNumbers.toString() }`); // "Just(8)"
  console.log(`Odd filter: ${ oddNumbers.toString() }`); // "Nothing"
  
  return {
    successChain,
    parseFailChain,
    sqrtFailChain,
    evenNumbers,
    oddNumbers
  };
}

// =============================================================================
// Working with Collections
// =============================================================================

/**
 * Example 4: Working with Collections
 * Demonstrates Maybe operations with arrays and collections
 */
export function workingWithCollections() {
  console.log('=== Working with Collections ===');
  
  // Finding elements in arrays
  const numbers = [1, 2, 3, 4, 5];
  
  const findFirst = <T>(
    arr: T[],
    predicate: (item: T) => boolean
  ): Maybe<T> => {
    const found = arr.find(predicate);
    if (found === undefined) {
      return Maybe.nothing<T>();
    }
    return Maybe.just(found as T);
  };
  
  const firstEven = findFirst(numbers, n => n % 2 === 0);
  const firstNegative = findFirst(numbers, n => n < 0);
  
  console.log(`First even: ${ firstEven.toString() }`); // "Just(2)"
  console.log(`First negative: ${ firstNegative.toString() }`); // "Nothing"
  
  // Safe array access
  const safeGet = <T>(
    arr: T[],
    index: number
  ): Maybe<T> => {
    return index >= 0 && index < arr.length
      ? Maybe.just(arr[index])
      : Maybe.nothing();
  };
  
  const validIndex = safeGet(numbers, 2);
  const invalidIndex = safeGet(numbers, 10);
  
  console.log(`Valid index: ${ validIndex.toString() }`); // "Just(3)"
  console.log(`Invalid index: ${ invalidIndex.toString() }`); // "Nothing"
  
  // Map over Maybe values in arrays
  const maybeNumbers: Maybe<number>[] = [
    Maybe.just(1),
    Maybe.nothing(),
    Maybe.just(3),
    Maybe.nothing(),
    Maybe.just(5)
  ];
  
  const doubledNumbers = maybeNumbers.map(maybe => maybe.map(n => n * 2));
  console.log('Doubled numbers:', doubledNumbers.map(m => m.toString()));
  
  // Collect only Just values
  const collectJust = <T>(maybes: Maybe<T>[]): T[] => {
    return maybes
      .filter(maybe => maybe.isJust())
      .map(maybe => maybe.getOrUndefined()!)
      .filter(value => value !== undefined);
  };
  
  const justValues = collectJust(maybeNumbers);
  console.log(`Just values: [${ justValues.join(', ') }]`); // [1, 3, 5]
  
  return {
    firstEven,
    firstNegative,
    validIndex,
    invalidIndex,
    doubledNumbers,
    justValues
  };
}

// =============================================================================
// Error Handling and Validation
// =============================================================================

/**
 * Example 5: Error Handling and Validation
 * Shows practical validation scenarios with Maybe
 */
export function errorHandlingAndValidation(): {
  validUser: Maybe<any>;
  invalidUser: Maybe<any>;
  userAge: Maybe<number>;
  noAge: Maybe<number>;
} {
  console.log('=== Error Handling and Validation ===');
  
  interface User {
    id: number;
    name: string;
    email: string;
    age?: number;
  }
  
  const validateUser = (data: any): Maybe<User> => {
    if (!data || typeof data !== 'object') {
      return Maybe.nothing();
    }
    
    if (typeof data.id !== 'number' || data.id <= 0) {
      return Maybe.nothing();
    }
    
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      return Maybe.nothing();
    }
    
    if (typeof data.email !== 'string' || !data.email.includes('@')) {
      return Maybe.nothing();
    }
    
    const age = data.age !== undefined && typeof data.age === 'number' && data.age >= 0
      ? data.age
      : undefined;
    
    return Maybe.just({
      id: data.id,
      name: data.name.trim(),
      email: data.email,
      age
    } as User);
  };
  
  // Valid user
  const validUserData = {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    age: 30
  };
  
  const validUser = validateUser(validUserData);
  console.log(`Valid user: ${ validUser.toString() }`);
  
  // Invalid user
  const invalidUserData = {
    id: -1,
    name: "",
    email: "invalid-email"
  };
  
  const invalidUser = validateUser(invalidUserData);
  console.log(`Invalid user: ${ invalidUser.toString() }`);
  
  // Chain validations
  const getUserAge = (user: Maybe<User>): Maybe<number> => {
    return user.flatMap(u =>
      u.age !== undefined ? Maybe.just(u.age) : Maybe.nothing()
    );
  };
  
  const userAge = getUserAge(validUser);
  const noAge = getUserAge(invalidUser);
  
  console.log(`User age: ${ userAge.toString() }`);
  console.log(`No age: ${ noAge.toString() }`);
  
  return {
    validUser,
    invalidUser,
    userAge,
    noAge
  };
}

// =============================================================================
// Configuration Management
// =============================================================================

/**
 * Example 6: Configuration Management
 * Demonstrates safe configuration access
 */
export function configurationManagement() {
  console.log('=== Configuration Management ===');
  
  interface Config {
    database?: {
      host?: string;
      port?: number;
      name?: string;
    };
    api?: {
      key?: string;
      timeout?: number;
    };
    features?: {
      logging?: boolean;
      caching?: boolean;
    };
  }
  
  const config: Config = {
    database: {
      host: "localhost",
      port: 5432
      // name is missing
    },
    api: {
      key: "secret-key"
      // timeout is missing
    }
    // features is missing entirely
  };
  
  const getConfigValue = <T>(
    config: Config,
    path: string,
    defaultValue: T
  ): T => {
    const parts = path.split('.');
    let current: any = config;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return defaultValue;
      }
    }
    
    return current !== undefined ? current : defaultValue;
  };
  
  // Safe configuration access
  const dbHost = getConfigValue(config, 'database.host', 'localhost');
  const dbPort = getConfigValue(config, 'database.port', 3306);
  const dbName = getConfigValue(config, 'database.name', 'defaultdb');
  const apiTimeout = getConfigValue(config, 'api.timeout', 5000);
  const loggingEnabled = getConfigValue(config, 'features.logging', false);
  
  console.log(`DB Host: ${ dbHost }`); // "localhost"
  console.log(`DB Port: ${ dbPort }`); // 5432
  console.log(`DB Name: ${ dbName }`); // "defaultdb"
  console.log(`API Timeout: ${ apiTimeout }`); // 5000
  console.log(`Logging: ${ loggingEnabled }`); // false
  
  // Using Maybe for configuration
  const getConfigMaybe = (
    config: Config,
    path: string
  ): Maybe<any> => {
    const parts = path.split('.');
    let current: any = config;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return Maybe.nothing();
      }
    }
    
    return current !== undefined ? Maybe.just(current) : Maybe.nothing();
  };
  
  const maybeDbHost = getConfigMaybe(config, 'database.host');
  const maybeDbName = getConfigMaybe(config, 'database.name');
  const maybeLogging = getConfigMaybe(config, 'features.logging');
  
  console.log(`Maybe DB Host: ${ maybeDbHost.toString() }`);
  console.log(`Maybe DB Name: ${ maybeDbName.toString() }`);
  console.log(`Maybe Logging: ${ maybeLogging.toString() }`);
  
  return {
    dbHost,
    dbPort,
    dbName,
    apiTimeout,
    loggingEnabled,
    maybeDbHost,
    maybeDbName,
    maybeLogging
  };
}

// =============================================================================
// API Response Handling
// =============================================================================

/**
 * Example 7: API Response Handling
 * Shows how to handle optional API responses safely
 */
export function apiResponseHandling(): {
  successUser: Maybe<any>;
  errorUser: Maybe<any>;
  emptyUser: Maybe<any>;
  avatar1: Maybe<string>;
  avatar2: Maybe<string>;
  loginMessage1: string;
  loginMessage2: string;
} {
  console.log('=== API Response Handling ===');
  
  interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    lastLogin?: Date;
  }
  
  interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
  }
  
  // Simulate API responses
  const successResponse: ApiResponse<User> = {
    success: true,
    data: {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      avatar: "https://example.com/avatar.jpg"
    }
  };
  
  const errorResponse: ApiResponse<User> = {
    success: false,
    error: "User not found"
  };
  
  const emptyResponse: ApiResponse<User> = {
    success: true
    // data is missing
  };
  
  // Safe API response handling
  const extractUser = (response: ApiResponse<User>): Maybe<User> => {
    if (!response.success || !response.data) {
      return Maybe.nothing();
    }
    return Maybe.just(response.data);
  };
  
  const extractAvatar = (user: Maybe<User>): Maybe<string> => {
    return user.flatMap(u =>
      u.avatar ? Maybe.just(u.avatar) : Maybe.nothing()
    );
  };
  
  // Process different responses
  const successUser = extractUser(successResponse);
  const errorUser = extractUser(errorResponse);
  const emptyUser = extractUser(emptyResponse);
  
  console.log(`Success user: ${ successUser.toString() }`);
  console.log(`Error user: ${ errorUser.toString() }`);
  console.log(`Empty user: ${ emptyUser.toString() }`);
  
  // Extract optional fields
  const avatar1 = extractAvatar(successUser);
  const avatar2 = extractAvatar(errorUser);
  
  console.log(`Avatar 1: ${ avatar1.toString() }`);
  console.log(`Avatar 2: ${ avatar2.toString() }`);
  
  // Chain API operations
  const getUserProfile = (userId: number): Maybe<User> => {
    // Simulate API call
    if (userId === 1) {
      return Maybe.just({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        avatar: "https://example.com/avatar.jpg",
        lastLogin: new Date('2023-01-01')
      } as User);
    }
    return Maybe.nothing();
  };
  
  const getLastLoginMessage = (userId: number): string => {
    return getUserProfile(userId)
      .flatMap(user =>
        user.lastLogin ? Maybe.just(user.lastLogin) : Maybe.nothing()
      )
      .map(date => `Last login: ${ date.toLocaleDateString() }`)
      .getOrElse("Never logged in");
  };
  
  const loginMessage1 = getLastLoginMessage(1);
  const loginMessage2 = getLastLoginMessage(2);
  
  console.log(`Login message 1: ${ loginMessage1 }`);
  console.log(`Login message 2: ${ loginMessage2 }`);
  
  return {
    successUser,
    errorUser,
    emptyUser,
    avatar1,
    avatar2,
    loginMessage1,
    loginMessage2
  };
}

// =============================================================================
// Form Validation
// =============================================================================

/**
 * Example 8: Form Validation
 * Demonstrates form field validation with Maybe
 */
export function formValidation(): {
  validResult: any;
  invalidResult: any;
  partialResult: any;
} {
  console.log('=== Form Validation ===');
  
  interface FormData {
    name: string;
    email: string;
    age?: number;
    phone?: string;
    website?: string;
  }
  
  interface ValidationResult {
    isValid: boolean;
    data?: FormData;
    errors: string[];
  }
  
  const validateName = (name: string): Maybe<string> => {
    const trimmed = name?.trim();
    return trimmed && trimmed.length >= 2
      ? Maybe.just(trimmed)
      : Maybe.nothing();
  };
  
  const validateEmail = (email: string): Maybe<string> => {
    const trimmed = email?.trim();
    return trimmed && trimmed.includes('@') && trimmed.includes('.')
      ? Maybe.just(trimmed)
      : Maybe.nothing();
  };
  
  const validateAge = (age: string): Maybe<number> => {
    if (!age || age.trim() === '') {
      return Maybe.just(undefined as any); // Optional field
    }
    const num = parseInt(age, 10);
    return !isNaN(num) && num >= 0 && num <= 150
      ? Maybe.just(num)
      : Maybe.nothing();
  };
  
  const validatePhone = (phone: string): Maybe<string> => {
    if (!phone || phone.trim() === '') {
      return Maybe.just(undefined as any); // Optional field
    }
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10
      ? Maybe.just(cleaned)
      : Maybe.nothing();
  };
  
  const validateWebsite = (website: string): Maybe<string> => {
    if (!website || website.trim() === '') {
      return Maybe.just(undefined as any); // Optional field
    }
    const trimmed = website.trim();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? Maybe.just(trimmed)
      : Maybe.nothing();
  };
  
  const validateForm = (formData: any): ValidationResult => {
    const errors: string[] = [];
    
    const validName = validateName(formData.name);
    const validEmail = validateEmail(formData.email);
    const validAge = validateAge(formData.age);
    const validPhone = validatePhone(formData.phone);
    const validWebsite = validateWebsite(formData.website);
    
    if (validName.isNothing()) errors.push("Name is required and must be at least 2 characters");
    if (validEmail.isNothing()) errors.push("Valid email is required");
    if (validAge.isNothing()) errors.push("Age must be a number between 0 and 150");
    if (validPhone.isNothing()) errors.push("Phone must be at least 10 digits");
    if (validWebsite.isNothing()) errors.push("Website must start with http:// or https://");
    
    if (errors.length > 0) {
      return { isValid: false, errors };
    }
    
    // All validations passed - construct the result
    const result = {
      name: validName.getOrUndefined()!,
      email: validEmail.getOrUndefined()!,
      age: validAge.getOrUndefined() === undefined ? undefined : validAge.getOrUndefined(),
      phone: validPhone.getOrUndefined() === undefined ? undefined : validPhone.getOrUndefined(),
      website: validWebsite.getOrUndefined() === undefined ? undefined : validWebsite.getOrUndefined()
    } as FormData;
    
    return { isValid: true, data: result, errors: [] };
  };
  
  // Test with valid data
  const validFormData = {
    name: "John Doe",
    email: "john@example.com",
    age: "30",
    phone: "1234567890",
    website: "https://johndoe.com"
  };
  
  const validResult = validateForm(validFormData);
  console.log('Valid form result:', validResult);
  
  // Test with invalid data
  const invalidFormData = {
    name: "J",
    email: "invalid-email",
    age: "200",
    phone: "123",
    website: "not-a-url"
  };
  
  const invalidResult = validateForm(invalidFormData);
  console.log('Invalid form result:', invalidResult);
  
  // Test with partial data (optional fields missing)
  const partialFormData = {
    name: "Jane Doe",
    email: "jane@example.com"
    // age, phone, website are missing
  };
  
  const partialResult = validateForm(partialFormData);
  console.log('Partial form result:', partialResult);
  
  return {
    validResult,
    invalidResult,
    partialResult
  };
}

// =============================================================================
// Database Query Simulation
// =============================================================================

/**
 * Example 9: Database Query Simulation
 * Shows how to handle optional database results
 */
export function databaseQuerySimulation(): {
  user1: Maybe<any>;
  user2: Maybe<any>;
  user3: Maybe<any>;
  user4: Maybe<any>;
  dept1: string;
  dept4: string;
  manager1: string;
  manager2: string;
} {
  console.log('=== Database Query Simulation ===');
  
  interface User {
    id: number;
    name: string;
    email: string;
    departmentId?: number;
    managerId?: number;
  }
  
  interface Department {
    id: number;
    name: string;
    budget: number;
  }
  
  // Mock database
  const users: User[] = [
    { id: 1, name: "John Doe", email: "john@example.com", departmentId: 1, managerId: 3 },
    { id: 2, name: "Jane Smith", email: "jane@example.com", departmentId: 1 },
    { id: 3, name: "Bob Manager", email: "bob@example.com", departmentId: 2 },
    { id: 4, name: "Alice Worker", email: "alice@example.com" } // No department or manager
  ];
  
  const departments: Department[] = [
    { id: 1, name: "Engineering", budget: 100000 },
    { id: 2, name: "Management", budget: 50000 }
  ];
  
  // Database query functions
  const findUserById = (id: number): Maybe<User> => {
    const user = users.find(u => u.id === id);
    return user ? Maybe.just(user) : Maybe.nothing();
  };
  
  const findDepartmentById = (id: number): Maybe<Department> => {
    const dept = departments.find(d => d.id === id);
    return dept ? Maybe.just(dept) : Maybe.nothing();
  };
  
  // Complex queries with Maybe chaining
  const getUserWithDepartment = (userId: number) => {
    return findUserById(userId).map(user => {
      const department = user.departmentId
        ? findDepartmentById(user.departmentId).getOrUndefined()
        : undefined;
      
      const manager = user.managerId
        ? findUserById(user.managerId).getOrUndefined()
        : undefined;
      
      return { user, department, manager };
    });
  };
  
  // Test queries
  const user1 = getUserWithDepartment(1); // Has department and manager
  const user2 = getUserWithDepartment(2); // Has department, no manager
  const user3 = getUserWithDepartment(4); // No department or manager
  const user4 = getUserWithDepartment(999); // Doesn't exist
  
  console.log(`User 1: ${ user1.toString() }`);
  console.log(`User 2: ${ user2.toString() }`);
  console.log(`User 3: ${ user3.toString() }`);
  console.log(`User 4: ${ user4.toString() }`);
  
  // Extract specific information
  const getDepartmentName = (userId: number): string => {
    return getUserWithDepartment(userId)
      .flatMap(result =>
        result.department ? Maybe.just(result.department.name) : Maybe.nothing()
      )
      .getOrElse("No department");
  };
  
  const getManagerName = (userId: number): string => {
    return getUserWithDepartment(userId)
      .flatMap(result =>
        result.manager ? Maybe.just(result.manager.name) : Maybe.nothing()
      )
      .getOrElse("No manager");
  };
  
  const dept1 = getDepartmentName(1);
  const dept4 = getDepartmentName(4);
  const manager1 = getManagerName(1);
  const manager2 = getManagerName(2);
  
  console.log(`User 1 department: ${ dept1 }`);
  console.log(`User 4 department: ${ dept4 }`);
  console.log(`User 1 manager: ${ manager1 }`);
  console.log(`User 2 manager: ${ manager2 }`);
  
  return {
    user1,
    user2,
    user3,
    user4,
    dept1,
    dept4,
    manager1,
    manager2
  };
}

// =============================================================================
// Advanced Patterns and Utilities
// =============================================================================

/**
 * Example 10: Advanced Patterns and Utilities
 * Demonstrates advanced Maybe patterns and utility functions
 */
export function advancedPatternsAndUtilities() {
  console.log('=== Advanced Patterns and Utilities ===');
  
  // Combine multiple Maybe values
  const combine2 = <A, B, C>(
    ma: Maybe<A>,
    mb: Maybe<B>,
    f: (
      a: A,
      b: B
    ) => C
  ): Maybe<C> => {
    return ma.flatMap(a => mb.map(b => f(a, b)));
  };
  
  const combine3 = <A, B, C, D>(
    ma: Maybe<A>,
    mb: Maybe<B>,
    mc: Maybe<C>,
    f: (
      a: A,
      b: B,
      c: C
    ) => D
  ): Maybe<D> => {
    return ma.flatMap(a =>
      mb.flatMap(b =>
        mc.map(c => f(a, b, c))
      )
    );
  };
  
  // Test combining
  const maybe1 = Maybe.just(1);
  const maybe2 = Maybe.just(2);
  const maybe3 = Maybe.just(3);
  const nothingMaybe = Maybe.nothing<number>();
  
  const sum2 = combine2(maybe1, maybe2, (
    a,
    b
  ) => a + b);
  const sum3 = combine3(maybe1, maybe2, maybe3, (
    a,
    b,
    c
  ) => a + b + c);
  const sumWithNothing = combine2(maybe1, nothingMaybe, (
    a,
    b
  ) => a + b);
  
  console.log(`Sum 2: ${ sum2.toString() }`); // "Just(3)"
  console.log(`Sum 3: ${ sum3.toString() }`); // "Just(6)"
  console.log(`Sum with nothing: ${ sumWithNothing.toString() }`); // "Nothing"
  
  // Sequence operation - convert Maybe[] to Maybe<T[]>
  const sequence = <T>(maybes: Maybe<T>[]): Maybe<T[]> => {
    const results: T[] = [];
    
    for (const maybe of maybes) {
      if (maybe.isNothing()) {
        return Maybe.nothing();
      }
      results.push(maybe.getOrUndefined()!);
    }
    
    return Maybe.just(results);
  };
  
  const allJust: Maybe<number>[] = [Maybe.just(1), Maybe.just(2), Maybe.just(3)];
  const withNothing: Maybe<number>[] = [Maybe.just(1), Maybe.nothing(), Maybe.just(3)];
  
  const sequenceAll = sequence(allJust);
  const sequenceWithNothing = sequence(withNothing);
  
  console.log(`Sequence all: ${ sequenceAll.toString() }`); // "Just([1, 2, 3])"
  console.log(`Sequence with nothing: ${ sequenceWithNothing.toString() }`); // "Nothing"
  
  // Traverse operation
  const traverse = <A, B>(
    items: A[],
    f: (item: A) => Maybe<B>
  ): Maybe<B[]> => {
    const results: B[] = [];
    
    for (const item of items) {
      const result = f(item);
      if (result.isNothing()) {
        return Maybe.nothing();
      }
      results.push(result.getOrUndefined()!);
    }
    
    return Maybe.just(results);
  };
  
  const parseNumbers = (strings: string[]): Maybe<number[]> => {
    return traverse(strings, str => {
      const num = parseInt(str, 10);
      return isNaN(num) ? Maybe.nothing() : Maybe.just(num);
    });
  };
  
  const validNumbers = parseNumbers(["1", "2", "3"]);
  const invalidNumbers = parseNumbers(["1", "abc", "3"]);
  
  console.log(`Valid numbers: ${ validNumbers.toString() }`);
  console.log(`Invalid numbers: ${ invalidNumbers.toString() }`);
  
  // Alternative (orElse) operation
  const orElse = <T>(
    primary: Maybe<T>,
    alternative: Maybe<T>
  ): Maybe<T> => {
    return primary.isJust() ? primary : alternative;
  };
  
  const firstChoice = Maybe.nothing<string>();
  const secondChoice = Maybe.just("backup value");
  const thirdChoice = Maybe.just("third choice");
  
  const result = orElse(orElse(firstChoice, secondChoice), thirdChoice);
  console.log(`Alternative result: ${ result.toString() }`);
  
  // Conditional Maybe
  const when = <T>(
    condition: boolean,
    value: T
  ): Maybe<T> => {
    return condition ? Maybe.just(value) : Maybe.nothing();
  };
  
  const conditionalTrue = when(true, "condition met");
  const conditionalFalse = when(false, "condition not met");
  
  console.log(`Conditional true: ${ conditionalTrue.toString() }`);
  console.log(`Conditional false: ${ conditionalFalse.toString() }`);
  
  return {
    sum2,
    sum3,
    sumWithNothing,
    sequenceAll,
    sequenceWithNothing,
    validNumbers,
    invalidNumbers,
    result,
    conditionalTrue,
    conditionalFalse
  };
}

// =============================================================================
// Example Runner Function
// =============================================================================

/**
 * Runs all Maybe examples
 */
export function runAllMaybeExamples() {
  console.log('==========================================');
  console.log('Running All Maybe Examples');
  console.log('==========================================\n');
  
  basicMaybeCreation();
  console.log('\n');
  
  safeValueExtraction();
  console.log('\n');
  
  transformationAndChaining();
  console.log('\n');
  
  workingWithCollections();
  console.log('\n');
  
  errorHandlingAndValidation();
  console.log('\n');
  
  configurationManagement();
  console.log('\n');
  
  apiResponseHandling();
  console.log('\n');
  
  formValidation();
  console.log('\n');
  
  databaseQuerySimulation();
  console.log('\n');
  
  advancedPatternsAndUtilities();
  console.log('\n');
  
  console.log('==========================================');
  console.log('All Maybe Examples Completed');
  console.log('==========================================');
}

// =============================================================================
// Usage Instructions
// =============================================================================

/*
To run these examples:

1. Import and run all examples:
   ```typescript
   import { runAllMaybeExamples } from './examples/MaybeExamples';
   runAllMaybeExamples();
   ```

2. Run individual examples:
   ```typescript
   import { basicMaybeCreation, apiResponseHandling } from './examples/MaybeExamples';
   basicMaybeCreation();
   apiResponseHandling();
   ```

3. Use Maybe in your own code:
   ```typescript
   import { Maybe } from './Maybe';
   
   const safeDivide = (a: number, b: number): Maybe<number> => {
     return b === 0 ? Maybe.nothing() : Maybe.just(a / b);
   };
   
   const result = safeDivide(10, 2)
     .map(x => x * 2)
     .filter(x => x > 5)
     .getOrElse(0);
   ```

Key Takeaways:
- Use Maybe.just() for values that exist and Maybe.nothing() for absent values
- Chain operations with map() and flatMap() without null checks
- Handle absence explicitly with pattern matching using match()
- Use getOrElse() for default values when Maybe is Nothing
- Filter Maybe values with filter() method
- Combine multiple Maybe values safely
- Use Maybe for optional configuration, API responses, and database queries
- Pattern match with match() for explicit handling of both cases
- Use Maybe to eliminate null/undefined errors at compile time
*/
