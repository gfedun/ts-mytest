/**
 * @fileoverview Comprehensive Examples for the Either Monad
 *
 * This file demonstrates practical usage patterns for the Either type,
 * including error handling, validation, transformation chains, and real-world scenarios.
 *
 * The Either monad is used for computations that can fail, providing elegant error handling
 * without throwing exceptions.
 *
 * @author CLA Examples
 * @version 1.0.0
 */

import { Maybe } from '../../maybe/Maybe';
import { Either } from '../Either';

// =============================================================================
// Type Definitions
// =============================================================================

// User types for various examples
export interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

export interface ApiError {
  status: number;
  message: string;
  code: string;
}

export type FileError = {
  type: "READ_ERROR" | "PARSE_ERROR" | "VALIDATION_ERROR" | "WRITE_ERROR";
  message: string;
  filename?: string;
};

export interface CsvRow {
  id: string;
  name: string;
  email: string;
  age: string;
}

export interface ProcessedUser {
  id: number;
  name: string;
  email: string;
  age: number;
  valid: boolean;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface AppConfig {
  database: DatabaseConfig;
  apiKey: string;
  debug: boolean;
}

export type ConfigError = {
  field: string;
  message: string;
};

export type ValidationError = string;

// =============================================================================
// Basic Either Creation and Usage
// =============================================================================

/**
 * Example 1: Basic Either Creation
 * Demonstrates different ways to create Either instances
 */
export function basicEitherCreation() {
  console.log('=== Basic Either Creation ===');
  
  // Creating a Right (success) value
  const rightValue = Either.right(42);
  console.log(`Right value: ${ rightValue.toString() }`); // "Right(42)"
  
  // Creating a Left (error) value
  const leftValue = Either.left("Error occurred");
  console.log(`Left value: ${ leftValue.toString() }`); // "Left(Error occurred)"
  
  // Creating Either from nullable values
  const fromValue = Either.fromNullable("Hello");
  const fromNull = Either.fromNullable(null);
  const fromUndefined = Either.fromNullable(undefined);
  
  console.log(`From value: ${ fromValue.toString() }`); // "Right(Hello)"
  console.log(`From null: ${ fromNull.toString() }`); // "Left(null)"
  console.log(`From undefined: ${ fromUndefined.toString() }`); // "Left(undefined)"
  
  // Creating Either from Maybe
  const justMaybe = Maybe.just("Success");
  const nothingMaybe = Maybe.nothing<string>();
  
  const fromJust = Either.fromMaybe(justMaybe);
  const fromNothing = Either.fromMaybe(nothingMaybe);
  
  console.log(`From Just: ${ fromJust.toString() }`); // "Right(Success)"
  console.log(`From Nothing: ${ fromNothing.toString() }`); // "Left(undefined)"
  
  // Creating Either from try-catch blocks
  const safeDivide = (
    a: number,
    b: number
  ): Either<string, number> => {
    if (b === 0) {
      return Either.left("Division by zero");
    }
    return Either.right(a / b);
  };
  
  const validDivision = safeDivide(10, 2);
  const invalidDivision = safeDivide(10, 0);
  
  console.log(`Valid division: ${ validDivision.toString() }`); // "Right(5)"
  console.log(`Invalid division: ${ invalidDivision.toString() }`); // "Left(Division by zero)"
  
  return {
    rightValue,
    leftValue,
    fromValue,
    fromNull,
    fromUndefined,
    fromJust,
    fromNothing,
    validDivision,
    invalidDivision
  };
}

// =============================================================================
// Pattern Matching and Value Extraction
// =============================================================================

/**
 * Example 2: Pattern Matching and Value Extraction
 * Shows different ways to extract values and handle both cases
 */
export function patternMatchingAndExtraction() {
  console.log('=== Pattern Matching and Value Extraction ===');
  
  const successValue: Either<string, number> = Either.right(100);
  const errorValue: Either<string, number> = Either.left("Calculation failed");
  
  // Pattern matching with match method
  const processResult = (either: Either<string, number>): string => {
    return either.match({
      onLeft: (error) => `Error: ${ error }`,
      onRight: (value) => `Success: ${ value * 2 }`
    });
  };
  
  console.log(processResult(successValue)); // "Success: 200"
  console.log(processResult(errorValue)); // "Error: Calculation failed"
  
  // Safe value extraction
  const defaultValue = successValue.getOrElse(0);
  const defaultError = errorValue.getOrElse(0);
  
  console.log(`Success with default: ${ defaultValue }`); // 100
  console.log(`Error with default: ${ defaultError }`); // 0
  
  // Conditional execution using match
  successValue.match({
    onRight: (value: number) => console.log(`Processing: ${ value }`),
    onLeft: () => {}
  });
  
  errorValue.match({
    onLeft: (error: string) => console.log(`Handling error: ${ error }`),
    onRight: () => {}
  });
  
  // Type guards
  if (successValue.isRight()) {
    console.log(`Type guard success: ${ successValue.getRight().getOrUndefined() }`);
  }
  
  if (errorValue.isLeft()) {
    console.log(`Type guard error: ${ errorValue.getLeft().getOrUndefined() }`);
  }
  
  return {
    successValue,
    errorValue,
    defaultValue,
    defaultError
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
  
  const parseNumber = (str: string): Either<string, number> => {
    const num = parseInt(str, 10);
    return isNaN(num) ? Either.left("Invalid number") : Either.right(num);
  };
  
  const double = (n: number): number => n * 2;
  
  const sqrt = (n: number): Either<string, number> => {
    return n < 0 ? Either.left("Negative number") : Either.right(Math.sqrt(n));
  };
  
  // Successful chain
  const validInput = "16";
  const successChain: Either<string, number> = parseNumber(validInput)
    .map(double)
    .flatMap(sqrt);
  
  console.log(`Success chain: ${ successChain.toString() }`); // "Right(8)"
  
  // Failed at parsing
  const invalidInput = "abc";
  const parseFailChain: Either<string, number> = parseNumber(invalidInput)
    .map(double)
    .flatMap(sqrt);
  
  console.log(`Parse fail chain: ${ parseFailChain.toString() }`); // "Left(Invalid number)"
  
  // Failed at sqrt
  const negativeInput = "-4";
  const sqrtFailChain: Either<string, number> = parseNumber(negativeInput)
    .map(double)
    .flatMap(sqrt);
  
  console.log(`Sqrt fail chain: ${ sqrtFailChain.toString() }`); // "Left(Negative number)"
  
  return {
    successChain,
    parseFailChain,
    sqrtFailChain
  };
}

// =============================================================================
// Error Handling and Validation
// =============================================================================

/**
 * Example 4: Error Handling and Validation
 * Shows practical validation scenarios
 */
export function errorHandlingAndValidation() {
  console.log('=== Error Handling and Validation ===');
  
  const validateId = (id: any): Either<ValidationError, number> => {
    if (typeof id !== 'number' || id <= 0) {
      return Either.left("ID must be a positive number");
    }
    return Either.right(id);
  };
  
  const validateName = (name: any): Either<ValidationError, string> => {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return Either.left("Name cannot be empty");
    }
    return Either.right(name.trim());
  };
  
  const validateEmail = (email: any): Either<ValidationError, string> => {
    if (typeof email !== 'string' || !email.includes('@')) {
      return Either.left("Invalid email format");
    }
    return Either.right(email);
  };
  
  const validateAge = (age: any): Either<ValidationError, number> => {
    if (typeof age !== 'number' || age < 0 || age > 150) {
      return Either.left("Age must be between 0 and 150");
    }
    return Either.right(age);
  };
  
  const createUser = (
    id: any,
    name: any,
    email: any,
    age: any
  ): Either<ValidationError, User> => {
    return validateId(id)
      .flatMap(validId =>
        validateName(name)
          .flatMap(validName =>
            validateEmail(email)
              .flatMap(validEmail =>
                validateAge(age)
                  .map(validAge => ({
                    id: validId,
                    name: validName,
                    email: validEmail,
                    age: validAge
                  }))
              )
          )
      );
  };
  
  // Valid user
  const validUser = createUser(1, "John Doe", "john@example.com", 30);
  console.log(`Valid user: ${ validUser.toString() }`);
  
  // Invalid user
  const invalidUser = createUser(-1, "", "invalid-email", 200);
  console.log(`Invalid user: ${ invalidUser.toString() }`);
  
  return {
    validUser,
    invalidUser
  };
}

// =============================================================================
// Collection Utilities Example
// =============================================================================

/**
 * Example 5: Working with Collections of Either Values
 * Shows how to handle arrays of Either values
 */
export function collectionUtilitiesExample() {
  console.log('=== Collection Utilities Example ===');
  
  // Array of Either values
  const eitherNumbers: Either<string, number>[] = [
    Either.right(1),
    Either.right(2),
    Either.right(3)
  ];
  
  const eitherWithError: Either<string, number>[] = [
    Either.right(1),
    Either.left("Parse error"),
    Either.right(3)
  ];
  
  // Parse numbers from strings
  const parseNumber = (str: string): Either<string, number> => {
    const num = parseInt(str, 10);
    return isNaN(num) ? Either.left(`Invalid number: ${ str }`) : Either.right(num);
  };
  
  const stringNumbers = ["1", "2", "3", "4", "5"];
  const parsedNumbers = Either.right(
    stringNumbers.map(s => parseNumber(s).getRight().getOrUndefined()!).filter(n => n !== undefined));
  const parseError = Either.left("Failed to parse some numbers");
  
  // Sequence Either values - convert Either<E, T>[] to Either<E, T[]>
  const sequenceEithers = <E, T>(eithers: Either<E, T>[]): Either<E, T[]> => {
    const results: T[] = [];
    
    for (const either of eithers) {
      if (either.isLeft()) {
        return Either.left(either.getLeft().getOrUndefined()!) as Either<E, T[]>;
      }
      results.push(either.getRight().getOrUndefined()!);
    }
    
    return Either.right(results);
  };
  
  const sequencedSuccess = sequenceEithers(eitherNumbers);
  const sequencedError = sequenceEithers(eitherWithError);
  
  console.log(`Sequenced success: ${ sequencedSuccess.toString() }`);
  console.log(`Sequenced error: ${ sequencedError.toString() }`);
  
  // Map over Either values
  const doubledNumbers = parsedNumbers.map(numbers => numbers.map(n => n * 2));
  console.log(`Doubled numbers: ${ doubledNumbers.toString() }`);
  
  return {
    parsedNumbers,
    parseError,
    sequencedSuccess,
    sequencedError,
    doubledNumbers
  };
}

// =============================================================================
// Real-world API Client Example
// =============================================================================

/**
 * Example 6: API Client with Either
 * Demonstrates practical API error handling
 */
export function apiClientExample() {
  console.log('=== API Client Example ===');
  
  // Simulated API responses
  const simulateApiCall = (userId: number): Either<ApiError, User> => {
    if (userId === 1) {
      return Either.right({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        age: 30
      });
    } else if (userId === 404) {
      return Either.left({
        status: 404,
        message: "User not found",
        code: "USER_NOT_FOUND"
      });
    } else {
      return Either.left({
        status: 500,
        message: "Internal server error",
        code: "INTERNAL_ERROR"
      });
    }
  };
  
  const getUserProfile = (userId: number): Either<ApiError, string> => {
    return simulateApiCall(userId)
      .map(user => `Profile: ${ user.name } (${ user.email })`)
      .mapLeft(error => ({
        ...error,
        message: `Failed to get profile: ${ error.message }`
      }));
  };
  
  // Successful API call
  const userResult = simulateApiCall(1);
  const profileResult = getUserProfile(1);
  console.log(`Success: ${ profileResult.toString() }`);
  
  // Not found error
  const notFoundResult = simulateApiCall(404);
  console.log(`Not found: ${ notFoundResult.toString() }`);
  
  // Server error
  const serverErrorProfile = getUserProfile(500);
  console.log(`Server error: ${ serverErrorProfile.toString() }`);
  
  // Transforming results
  const transformedResult = profileResult.map(profile => `User Profile - ${ profile }`);
  console.log(`Transformed result: ${ transformedResult.toString() }`);
  
  // Combining results
  const getUserWithFriends = (user: User): Either<ApiError, string> => {
    // Simulate getting friends
    if (user.id === 1) {
      return Either.right(`${ user.name } has 5 friends`);
    } else {
      return Either.left({
        status: 404,
        message: "Friends not found",
        code: "FRIENDS_NOT_FOUND"
      });
    }
  };
  
  const combinedResult = userResult
    .flatMap(user => getUserWithFriends(user)
      .map(friends => ({ user, profile: `${ user.name } profile`, friends }))
    );
  
  console.log(`Combined result: ${ combinedResult.toString() }`);
  
  // Error recovery with fallback
  const getUserProfileWithFallback = (userId: number): string => {
    return getUserProfile(userId)
      .getOrElse("Default user profile");
  };
  
  const fallbackResult = getUserProfileWithFallback(404);
  console.log(`Fallback result: ${ fallbackResult }`);
  
  return {
    userResult,
    notFoundResult,
    transformedResult,
    combinedResult
  };
}

// =============================================================================
// File Processing Pipeline
// =============================================================================

/**
 * Example 7: File Processing Pipeline
 * Shows a complex pipeline with multiple error types
 */
export function fileProcessingPipeline() {
  console.log('=== File Processing Pipeline ===');
  
  // Simulate file reading
  const readFile = (filename: string): Either<FileError, string> => {
    if (filename.endsWith('.csv')) {
      return Either.right("id,name,email,age\n1,John,john@example.com,30\n2,Jane,jane@example.com,25");
    } else {
      return Either.left({
        type: "READ_ERROR",
        message: "File not found or not readable",
        filename
      } as FileError);
    }
  };
  
  // Parse CSV content
  const parseCsv = (content: string): Either<FileError, CsvRow[]> => {
    try {
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',');
      
      if (headers.length !== 4) {
        return Either.left({
          type: "PARSE_ERROR",
          message: "Invalid CSV format"
        } as FileError);
      }
      
      const rows: CsvRow[] = lines.slice(1).map(line => {
        const values = line.split(',');
        return {
          id: values[0],
          name: values[1],
          email: values[2],
          age: values[3]
        };
      });
      
      return Either.right(rows);
    } catch (error) {
      return Either.left({
        type: "PARSE_ERROR",
        message: "Failed to parse CSV content"
      } as FileError);
    }
  };
  
  // Validate and process user data
  const processUser = (row: CsvRow): Either<FileError, ProcessedUser> => {
    const id = parseInt(row.id, 10);
    const age = parseInt(row.age, 10);
    
    if (isNaN(id)) {
      return Either.left({
        type: "VALIDATION_ERROR",
        message: `Invalid ID: ${ row.id }`
      } as FileError);
    }
    
    if (isNaN(age)) {
      return Either.left({
        type: "VALIDATION_ERROR",
        message: `Invalid age: ${ row.age }`
      } as FileError);
    }
    
    if (!row.email.includes('@')) {
      return Either.left({
        type: "VALIDATION_ERROR",
        message: `Invalid email: ${ row.email }`
      } as FileError);
    }
    
    return Either.right({
      id,
      name: row.name,
      email: row.email,
      age,
      valid: true
    } as ProcessedUser);
  };
  
  // Process all users
  const processUsers = (rows: CsvRow[]): Either<FileError, ProcessedUser[]> => {
    const results: ProcessedUser[] = [];
    
    for (const row of rows) {
      const processed = processUser(row);
      if (processed.isLeft()) {
        return Either.left(processed.getLeft().getOrUndefined()!);
      }
      results.push(processed.getRight().getOrUndefined()!);
    }
    
    return Either.right(results);
  };
  
  // Complete pipeline
  const processFile = (filename: string): Either<FileError, ProcessedUser[]> => {
    return readFile(filename)
      .flatMap(parseCsv)
      .flatMap(processUsers);
  };
  
  // Successful processing
  const successResult = processFile("users.csv");
  console.log(`Success result: ${ successResult.toString() }`);
  
  // Failed processing
  const failResult = processFile("missing.txt");
  console.log(`Fail result: ${ failResult.toString() }`);
  
  // Write results
  const writeResults = (users: ProcessedUser[]): Either<FileError, string> => {
    try {
      users.map(u => `${ u.id }: ${ u.name }`).join('\n');
      return Either.right(`Written ${ users.length } users to output file`);
    } catch (error) {
      return Either.left({
        type: "WRITE_ERROR",
        message: "Failed to write output file"
      } as FileError);
    }
  };
  
  const finalResult = successResult.flatMap(writeResults);
  console.log(`Final result: ${ finalResult.toString() }`);
  
  return {
    successResult,
    failResult,
    finalResult
  };
}

// =============================================================================
// Configuration Management
// =============================================================================

/**
 * Example 8: Configuration Management
 * Demonstrates configuration validation and merging
 */
export function configurationExample() {
  console.log('=== Configuration Management ===');
  
  const validateDatabaseConfig = (config: any): Either<ConfigError, DatabaseConfig> => {
    if (!config.host) {
      return Either.left({ field: "database.host", message: "Host is required" });
    }
    if (!config.port || typeof config.port !== 'number') {
      return Either.left({ field: "database.port", message: "Port must be a number" });
    }
    if (!config.database) {
      return Either.left({ field: "database.database", message: "Database name is required" });
    }
    if (!config.username) {
      return Either.left({ field: "database.username", message: "Username is required" });
    }
    if (!config.password) {
      return Either.left({ field: "database.password", message: "Password is required" });
    }
    
    return Either.right({
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password
    });
  };
  
  const validateAppConfig = (config: any): Either<ConfigError, AppConfig> => {
    return validateDatabaseConfig(config.database)
      .flatMap(database => {
        if (!config.apiKey) {
          return Either.left({ field: "apiKey", message: "API key is required" });
        }
        if (typeof config.debug !== 'boolean') {
          return Either.left({ field: "debug", message: "Debug must be a boolean" });
        }
        
        return Either.right({
          database,
          apiKey: config.apiKey,
          debug: config.debug
        });
      });
  };
  
  // Load configuration from different sources
  const loadEnvConfig = (): Either<ConfigError, AppConfig> => {
    return Either.right({
      database: {
        host: "localhost",
        port: 5432,
        database: "myapp",
        username: "user",
        password: "pass"
      },
      apiKey: "default-key",
      debug: false
    } as AppConfig);
  };
  
  const loadFileConfig = (): Either<ConfigError, AppConfig> => {
    return Either.right({
      database: {
        host: "localhost",
        port: 5432,
        database: "myapp",
        username: "user",
        password: "pass"
      },
      apiKey: "secret-api-key",
      debug: true
    } as AppConfig);
  };
  
  // Merge configurations
  const mergeConfigs = (
    envConfig: AppConfig,
    fileConfig: AppConfig
  ): AppConfig => {
    return {
      database: fileConfig.database || envConfig.database,
      apiKey: fileConfig.apiKey || envConfig.apiKey,
      debug: fileConfig.debug !== undefined ? fileConfig.debug : envConfig.debug
    };
  };
  
  // Complete configuration loading
  const loadConfiguration = (): Either<ConfigError, AppConfig> => {
    return loadEnvConfig()
      .flatMap(envConfig =>
        loadFileConfig()
          .map(fileConfig => mergeConfigs(envConfig, fileConfig))
          .flatMap(validateAppConfig)
      );
  };
  
  const config = loadConfiguration();
  console.log(`Configuration: ${ config.toString() }`);
  
  // Configuration with fallbacks
  const getConfigValue = <T>(
    getter: (config: AppConfig) => T,
    fallback: T
  ): T => {
    return config
      .map(getter)
      .getOrElse(fallback);
  };
  
  const dbHost = getConfigValue(c => c.database.host, "localhost");
  const isDebug = getConfigValue(c => c.debug, false);
  
  console.log(`DB Host: ${ dbHost }`);
  console.log(`Debug mode: ${ isDebug }`);
  
  return {
    config,
    dbHost,
    isDebug
  };
}

// =============================================================================
// Advanced Either Patterns
// =============================================================================

/**
 * Example 9: Advanced Either Patterns
 * Demonstrates advanced patterns and utilities
 */
export function advancedEitherPatterns() {
  console.log('=== Advanced Either Patterns ===');
  
  // Bimap - transform both sides
  const processResult = <L, R, L2, R2>(
    either: Either<L, R>,
    leftMap: (l: L) => L2,
    rightMap: (r: R) => R2
  ): Either<L2, R2> => {
    return either.isLeft()
      ? Either.left(leftMap(either.getLeft().getOrUndefined()!))
      : Either.right(rightMap(either.getRight().getOrUndefined()!));
  };
  
  const numbers: Either<string, number>[] = [
    Either.right(1),
    Either.left("error"),
    Either.right(3)
  ];
  
  const processedNumbers = numbers.map(either =>
    processResult(either, err => `Error: ${ err }`, num => num * 2)
  );
  
  console.log('Processed numbers:', processedNumbers.map(e => e.toString()));
  
  // Partition Eithers
  const partitionEithers = <L, R>(eithers: Either<L, R>[]): [L[], R[]] => {
    const lefts: L[] = [];
    const rights: R[] = [];
    
    for (const either of eithers) {
      if (either.isLeft()) {
        lefts.push(either.getLeft().getOrUndefined()!);
      } else {
        rights.push(either.getRight().getOrUndefined()!);
      }
    }
    
    return [lefts, rights];
  };
  
  const [errors, values] = partitionEithers(numbers);
  console.log('Errors:', errors);
  console.log('Values:', values);
  
  // Traverse with accumulating errors
  const validateAll = <T, E>(
    items: T[],
    validator: (item: T) => Either<E, T>
  ): Either<E[], T[]> => {
    const errors: E[] = [];
    const results: T[] = [];
    
    for (const item of items) {
      const result = validator(item);
      if (result.isLeft()) {
        errors.push(result.getLeft().getOrUndefined()!);
      } else {
        results.push(result.getRight().getOrUndefined()!);
      }
    }
    
    return errors.length > 0 ? Either.left(errors) : Either.right(results);
  };
  
  const validateString = (str: string): Either<string, string> => {
    return str.length > 0 ? Either.right(str) : Either.left(`Empty string`);
  };
  
  const inputs = ["hello", "", "world", "", "test"];
  const validationResult = validateAll(inputs, validateString);
  console.log(`Validation result: ${ validationResult.toString() }`);
  
  // Conditional chaining
  const conditionalChain = <L, R>(
    either: Either<L, R>,
    condition: (value: R) => boolean,
    onTrue: (value: R) => Either<L, R>,
    onFalse: (value: R) => Either<L, R>
  ): Either<L, R> => {
    return either.flatMap(value =>
      condition(value) ? onTrue(value) : onFalse(value)
    );
  };
  
  const checkPositive = (n: number): boolean => n > 0;
  const makePositive = (n: number): Either<string, number> => Either.right(Math.abs(n));
  const keepAsIs = (n: number): Either<string, number> => Either.right(n);
  
  const result1 = conditionalChain(Either.left("error") as Either<string, number>, checkPositive, keepAsIs,
    makePositive
  );
  const result2 = conditionalChain(Either.left("error") as Either<string, number>, checkPositive, keepAsIs,
    makePositive
  );
  
  console.log(`Conditional result 1: ${ result1.toString() }`);
  console.log(`Conditional result 2: ${ result2.toString() }`);
  
  return {
    processedNumbers,
    errors,
    values,
    validationResult,
    result1,
    result2
  };
}

// =============================================================================
// Example Runner Function
// =============================================================================

/**
 * Runs all Either examples
 */
export function runAllEitherExamples() {
  console.log('==========================================');
  console.log('Running All Either Examples');
  console.log('==========================================\n');
  
  basicEitherCreation();
  console.log('\n');
  
  patternMatchingAndExtraction();
  console.log('\n');
  
  transformationAndChaining();
  console.log('\n');
  
  errorHandlingAndValidation();
  console.log('\n');
  
  collectionUtilitiesExample();
  console.log('\n');
  
  apiClientExample();
  console.log('\n');
  
  fileProcessingPipeline();
  console.log('\n');
  
  configurationExample();
  console.log('\n');
  
  advancedEitherPatterns();
  console.log('\n');
  
  console.log('==========================================');
  console.log('All Either Examples Completed');
  console.log('==========================================');
}

// =============================================================================
// Usage Instructions
// =============================================================================

/*
To run these examples:

1. Import and run all examples:
   ```typescript
   import { runAllEitherExamples } from './examples/EitherExamples';
   runAllEitherExamples();
   ```

2. Run individual examples:
   ```typescript
   import { basicEitherCreation, apiClientExample } from './examples/EitherExamples';
   basicEitherCreation();
   apiClientExample();
   ```

3. Use Either in your own code:
   ```typescript
   import { Either } from './Either';
   
   const safeDivide = (a: number, b: number): Either<string, number> => {
     return b === 0 ? Either.left("Division by zero") : Either.right(a / b);
   };
   
   const result = safeDivide(10, 2)
     .map(x => x * 2)
     .mapLeft(error => `Error: ${error}`)
     .getOrElse(0);
   ```

Key Takeaways:
- Use Either.right() for success values and Either.left() for errors
- Chain operations with map() and flatMap()
- Handle errors explicitly with pattern matching
- Use mapLeft() to transform error values
- Combine multiple Either values with Either.all()
- Use Either for operations that can fail instead of throwing exceptions
- Pattern match with match() for explicit error handling
- Use getOrElse() for default values in error cases
*/
