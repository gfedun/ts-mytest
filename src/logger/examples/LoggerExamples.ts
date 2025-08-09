/**
 * # CLA Logger System - Comprehensive Examples & Documentation
 *
 * This file demonstrates all features of the CLA Logger system based on the actual implementation:
 * - PinoLogger with full feature set
 * - Logger factories and configuration
 * - LogBuilder for structured logging
 * - Redacted/sensitive data handling with Loggable interface
 * - NoOpLogger for testing/production
 * - Real-world integration patterns
 * - Performance monitoring and metrics
 *
 * ## Architecture Overview
 *
 * The CLA Logger system provides:
 * - Type-safe logging with multiple backends
 * - Structured logging with LogBuilder
 * - Automatic sensitive data redaction
 * - Request context tracking
 * - Performance metrics and monitoring
 * - Easy swapping between logger implementations
 *
 * @version 1.0.0
 * @author CLA Team
 */

import {
  AbstractLoggable,
  isLoggable,
  isRedacted,
  type Logger,
  type LoggerConfig,
  LogLevel,
  NoOpLogger,
  PinoLoggerFactory,
  redacted,
  type RequestContext
} from '../index';

// ====================================================================================
// 1. BASIC LOGGER USAGE - All Log Levels
// ====================================================================================

/**
 * Demonstrates basic logging operations with all available log levels
 */
class BasicLoggingExamples {
  
  /**
   * Simple message logging at all levels
   */
  static basicMessages() {
    console.log("\n=== Basic Message Logging ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      level: 'TRACE',
      prettyPrint: true
    });
    
    // All log levels in order of severity
    logger.trace("This is a trace message - most verbose");
    logger.debug("This is a debug message - development info");
    logger.info("This is an info message - general information");
    logger.warn("This is a warning message - something needs attention");
    logger.error("This is an error message - something went wrong");
    logger.fatal("This is a fatal message - system is unusable");
  }
  
  /**
   * Object-based logging with structured data
   */
  static objectLogging() {
    console.log("\n=== Object-Based Logging ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      prettyPrint: true
    });
    
    // Log with object context
    logger.info({ userId: 12345, action: 'login' }, "User authentication successful");
    
    logger.warn(
      {
        temperature: 85.2,
        threshold: 80,
        sensor: 'CPU-001'
      },
      "Temperature threshold exceeded"
    );
    
    logger.error(
      {
        orderId: 'ORD-789',
        amount: 299.99,
        currency: 'USD',
        gateway: 'stripe'
      },
      "Payment processing failed"
    );
  }
  
  /**
   * Error logging with automatic stack trace capture
   */
  static errorLogging() {
    console.log("\n=== Error Logging Examples ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      prettyPrint: true
    });
    
    try {
      const error = new Error("Something went wrong in the database");
      throw error;
    } catch (error) {
      // Log error with automatic stack trace
      logger.error(error as Error, "Database operation failed");
      
      // Log error with additional context
      logger.error(error as Error, "Failed to process user order", {
        userId: 123,
        orderId: 'ORD-456'
      });
    }
    
    // Custom error with context
    const customError = new Error("API rate limit exceeded");
    logger.error(
      { error: customError, endpoint: '/api/users', requestCount: 1000 },
      "Rate limiting triggered"
    );
  }
}

// ====================================================================================
// 2. ADVANCED LOGGER FEATURES - Context, Child Loggers, Request Tracking
// ====================================================================================

/**
 * Demonstrates advanced logger features for complex applications
 */
class AdvancedLoggingExamples {
  
  /**
   * Child loggers with inherited context
   */
  static childLoggers() {
    console.log("\n=== Child Logger Examples ===");
    
    const factory = PinoLoggerFactory;
    const mainLogger = factory.createLogger({
      prettyPrint: true
    });
    
    // Create child logger with persistent context
    const userServiceLogger = mainLogger.child({
      service: 'UserService',
      version: '1.2.3'
    });
    
    const paymentServiceLogger = mainLogger.child({
      service: 'PaymentService',
      version: '2.1.0',
      gateway: 'stripe'
    });
    
    // All messages from child loggers include inherited context
    userServiceLogger.info("Processing user registration");
    userServiceLogger.warn("Email validation failed", { email: "invalid-email" });
    
    paymentServiceLogger.info("Processing payment", { amount: 99.99 });
    paymentServiceLogger.error("Payment declined", { reason: "insufficient_funds" });
  }
  
  /**
   * Context chaining with withContext, withError, withRequest
   */
  static contextChaining() {
    console.log("\n=== Context Chaining Examples ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      prettyPrint: true
    });
    
    // Chain multiple context additions
    const enrichedLogger = logger
      .withContext({ userId: 789, sessionId: 'sess_123' })
      .withRequest({
        id: 'req_456',
        method: 'POST',
        url: '/api/orders',
        userAgent: 'Mozilla/5.0...',
        ip: '192.168.1.100'
      });
    
    enrichedLogger.info("Processing order creation");
    
    try {
      const error = new Error("Payment validation failed");
      throw error;
    } catch (error) {
      // Add error context to the chain
      enrichedLogger
        .withError(error as Error)
        .error("Order creation failed");
    }
  }
  
  /**
   * Request context tracking for web applications
   */
  static requestContextTracking() {
    console.log("\n=== Request Context Tracking ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      prettyPrint: true
    });
    
    // Simulate HTTP request processing
    const processRequest = (requestContext: RequestContext) => {
      const requestLogger = logger.withRequest(requestContext);
      
      requestLogger.info("Request started");
      
      // Simulate some processing
      requestLogger.debug("Validating authentication");
      requestLogger.debug("Fetching user data");
      
      // Simulate business logic
      requestLogger.info("Processing business logic", {
        duration: 150,
        cacheHit: true
      });
      
      requestLogger.info("Request completed", {
        statusCode: 200,
        responseTime: 245
      });
    };
    
    // Example requests
    processRequest({
      id: 'req_001',
      method: 'GET',
      url: '/api/users/123',
      headers: { authorization: 'Bearer token123' },
      userAgent: 'curl/7.68.0',
      ip: '10.0.0.1'
    });
    
    processRequest({
      id: 'req_002',
      method: 'POST',
      url: '/api/orders',
      headers: { 'content-type': 'application/json' },
      userAgent: 'MyApp/1.0',
      ip: '10.0.0.2'
    });
  }
  
  /**
   * Log level management and conditional logging
   */
  static logLevelManagement() {
    console.log("\n=== Log Level Management ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      level: 'INFO', // Only INFO and above will be logged
      prettyPrint: true
    });
    
    // Check if level is enabled before expensive operations
    if (logger.isLevelEnabled(LogLevel.DEBUG)) {
      const expensiveData = { /* some expensive computation */ };
      logger.debug("Debug info", expensiveData);
    } else {
      console.log("DEBUG level not enabled - skipping expensive debug logging");
    }
    
    // These will be logged (INFO level and above)
    logger.info("This will be logged");
    logger.warn("This will be logged");
    logger.error("This will be logged");
    
    // These will be silently ignored (below INFO level)
    logger.debug("This will NOT be logged");
    logger.trace("This will NOT be logged");
  }
}

// ====================================================================================
// 3. STRUCTURED LOGGING WITH LOGBUILDER
// ====================================================================================

/**
 * Demonstrates LogBuilder for complex structured logging scenarios
 */
class LogBuilderExamples {
  
  /**
   * Basic LogBuilder usage with fluent API
   * Note: LogBuilder is not available as a runtime value in current exports
   */
  static basicLogBuilder() {
    console.log("\n=== Basic LogBuilder Usage ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      prettyPrint: true
    });
    
    // Since LogBuilder is not available as a value, we'll use structured objects directly
    const logData = {
      service: "OrderService",
      orderId: "ORD-12345",
      customerId: 789,
      amount: 299.99,
      currency: "USD",
      timestamp: new Date(),
      success: true
    };
    
    logger.info("Order processed", logData);
  }
  
  /**
   * Advanced structured logging with objects and conditional fields
   */
  static advancedLogBuilder() {
    console.log("\n=== Advanced Structured Logging ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      prettyPrint: true
    });
    
    const isDebugMode = process.env.NODE_ENV === 'development';
    const userRole = 'admin';
    
    const logData: Record<string, any> = {
      service: "UserService",
      operation: "createUser",
      userId: 123,
      userData: {
        email: "john.doe@example.com",
        name: "John Doe",
        roles: ["user", "admin"]
      }
    };
    
    if (isDebugMode) {
      logData.debugInfo = {
        memoryUsage: process.memoryUsage(),
        timestamp: Date.now()
      };
    }
    
    if (userRole === 'admin') {
      logData.adminContext = {
        permissions: ["read", "write", "admin"],
        accessLevel: "full"
      };
    }
    
    logger.info("User operation", logData);
  }
  
  /**
   * Structured logging with redacted sensitive data
   */
  static structuredLoggingWithRedaction() {
    console.log("\n=== Structured Logging with Data Redaction ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      prettyPrint: true
    });
    
    const logData = {
      service: "PaymentProcessor",
      orderId: "ORD-789",
      amount: 150.00,
      creditCard: redacted("4111-1111-1111-1111", "Credit Card Number"),
      ssn: redacted("123-45-6789", "Social Security Number"),
      apiKey: redacted("sk_live_1234567890abcdef", "API Key"),
      gateway: "stripe",
      processed: true
    };
    
    logger.info("Payment processed", logData);
  }
}

// ====================================================================================
// 4. SENSITIVE DATA HANDLING WITH LOGGABLE INTERFACE
// ====================================================================================

/**
 * Demonstrates the Loggable interface for automatic sensitive data redaction
 */
class SensitiveDataExamples {
  
  /**
   * Using redacted strings for sensitive data
   */
  static redactedStrings() {
    console.log("\n=== Redacted String Examples ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      prettyPrint: true
    });
    
    // Create redacted values
    const creditCard = redacted("4111-1111-1111-1111", "Credit Card");
    const ssn = redacted("123-45-6789", "SSN");
    const apiKey = redacted("sk_live_abcdef123456", "API Key");
    
    // Log with automatic redaction
    logger.info("Processing payment", {
      orderId: "ORD-001",
      creditCard,
      ssn,
      apiKey,
      amount: 99.99
    });
    
    // Check if value is redacted
    console.log("Is credit card redacted?", isRedacted(creditCard));
    console.log("Is order ID redacted?", isRedacted("ORD-001"));
  }
  
  /**
   * Custom Loggable implementations
   */
  static customLoggableClasses() {
    console.log("\n=== Custom Loggable Classes ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      prettyPrint: true
    });
    
    // User class with sensitive data protection
    class User
      extends AbstractLoggable {
      constructor(
        public id: number,
        public email: string,
        private password: string,
        private ssn: string
      ) {
        super();
      }
      
      doToDebug(): string {
        return JSON.stringify(this.toLoggableData());
      }
      
      doToInfo(): string {
        return JSON.stringify({
          id: this.id,
          email: this.email,
          hasPassword: !!this.password,
          createdAt: new Date().toISOString()
        });
      }
      
      private toLoggableData(): Record<string, any> {
        return {
          id: this.id,
          email: this.email,
          password: redacted(this.password, "User Password"),
          ssn: redacted(this.ssn, "SSN"),
          createdAt: new Date().toISOString()
        };
      }
    }
    
    // Payment class with automatic redaction
    class Payment
      extends AbstractLoggable {
      constructor(
        public orderId: string,
        public amount: number,
        private creditCardNumber: string,
        private cvv: string
      ) {
        super();
      }
      
      doToDebug(): string {
        return JSON.stringify(this.toLoggableData());
      }
      
      doToInfo(): string {
        return JSON.stringify({
          orderId: this.orderId,
          amount: this.amount,
          currency: "USD",
          timestamp: Date.now()
        });
      }
      
      private toLoggableData(): Record<string, any> {
        return {
          orderId: this.orderId,
          amount: this.amount,
          currency: "USD",
          creditCard: redacted(this.creditCardNumber, "Credit Card"),
          cvv: redacted(this.cvv, "CVV"),
          timestamp: Date.now()
        };
      }
    }
    
    const user = new User(123, "john@example.com", "secretPassword123", "123-45-6789");
    const payment = new Payment("ORD-456", 199.99, "4111-1111-1111-1111", "123");
    
    // Log objects with automatic redaction
    logger.info("User created", { user });
    logger.info("Payment processed", { payment });
    
    // Check if objects are loggable
    console.log("Is user loggable?", isLoggable(user));
    console.log("Is string loggable?", isLoggable("regular string"));
  }
}

// ====================================================================================
// 5. LOGGER FACTORIES AND CONFIGURATION
// ====================================================================================

/**
 * Demonstrates logger factory patterns and advanced configuration
 */
class LoggerFactoryExamples {
  
  /**
   * PinoLoggerFactory with different configurations
   */
  static pinoLoggerFactoryUsage() {
    console.log("\n=== PinoLoggerFactory Examples ===");
    
    // Create factories with different configurations
    const devFactory = PinoLoggerFactory;
    const prodFactory = PinoLoggerFactory;
    
    // Create loggers with specific configurations
    const devLogger = devFactory.createLogger({
      level: 'DEBUG',
      prettyPrint: true
    });
    
    const prodLogger = prodFactory.createLogger({
      level: 'INFO',
      prettyPrint: false,
      redact: ['password', 'creditCard', 'ssn']
    });
    
    devLogger.debug("This appears in development");
    prodLogger.debug("This is filtered out in production");
    
    devLogger.info("Development logger message");
    prodLogger.info("Production logger message");
  }
  
  /**
   * Environment-specific logger configuration
   */
  static environmentSpecificConfiguration() {
    console.log("\n=== Environment-Specific Configuration ===");
    
    const createLoggerForEnvironment = (env: 'development' | 'staging' | 'production') => {
      const configs: Record<string, LoggerConfig> = {
        development: {
          level: 'TRACE',
          prettyPrint: true,
          timestamp: true
        },
        staging: {
          level: 'DEBUG',
          prettyPrint: true,
          redact: ['password'],
          timestamp: true
        },
        production: {
          level: 'INFO',
          prettyPrint: false,
          redact: ['password', 'creditCard', 'ssn', 'apiKey'],
          timestamp: () => new Date().toISOString()
        }
      };
      
      const factory = PinoLoggerFactory;
      return factory.createLogger(configs[env]);
    };
    
    // Test different environments
    const environments = ['development', 'staging', 'production'] as const;
    
    environments.forEach(env => {
      console.log(`\n--- ${ env.toUpperCase() } Environment ---`);
      const logger = createLoggerForEnvironment(env);
      
      logger.trace("Trace message");
      logger.debug("Debug message");
      logger.info("Info message");
      logger.warn("Warning message");
      logger.error("Error message");
    });
  }
  
  /**
   * Custom serializers and hooks
   */
  static customSerializersAndHooks() {
    console.log("\n=== Custom Serializers and Hooks ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      prettyPrint: true,
      serializers: {
        user: (user: any) => ({
          id: user.id,
          email: user.email,
          password: '[REDACTED]',
          lastLogin: user.lastLogin?.toISOString()
        }),
        error: (error: Error) => ({
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'),
          timestamp: new Date().toISOString()
        })
      }
    });
    
    // Test custom serializers
    const user = {
      id: 123,
      email: 'john@example.com',
      password: 'secretPassword',
      lastLogin: new Date()
    };
    
    const error = new Error('Custom error with long stack trace');
    
    logger.info("User login", { user });
    logger.error("Login failed", { error });
  }
}

// ====================================================================================
// 6. NOOPLOGGER FOR TESTING AND SILENT OPERATION
// ====================================================================================

/**
 * Demonstrates NoOpLogger usage for testing and silent operation
 */
class NoOpLoggerExamples {
  
  /**
   * Testing scenarios with NoOpLogger
   */
  static testingScenarios() {
    console.log("\n=== Testing Scenarios with NoOpLogger ===");
    
    // Mock test framework
    const runTest = (
      testName: string,
      testFn: (logger: Logger) => void,
      useSilentLogger = true
    ) => {
      console.log(`\n🧪 Running test: ${ testName }`);
      
      const logger = useSilentLogger
        ? NoOpLogger
        : (() => {
          const factory = PinoLoggerFactory;
          return factory.createLogger({ prettyPrint: true });
        })();
      
      try {
        testFn(logger);
        console.log(`✅ Test passed: ${ testName }`);
      } catch (error) {
        console.log(`❌ Test failed: ${ testName }`, error);
      }
    };
    
    // Test business logic without log noise
    runTest("User Service - Create User", (logger) => {
      // Simulate user service with extensive logging
      logger.debug("Validating user input");
      logger.info("Creating user record");
      logger.debug("Sending welcome email");
      logger.info("User creation completed");
      
      // Actual test assertion (this is what we care about in tests)
      const result = { id: 123, email: 'test@example.com' };
      if (!result.id) throw new Error("User ID not generated");
    }, true); // Silent logging for tests
    
    // Compare with verbose logging (for debugging failing tests)
    runTest("User Service - Debug Mode", (logger) => {
      logger.debug("Validating user input");
      logger.info("Creating user record");
      logger.debug("Sending welcome email");
      logger.info("User creation completed");
      
      const result = { id: 123, email: 'test@example.com' };
      if (!result.id) throw new Error("User ID not generated");
    }, false); // Verbose logging for debugging
  }
}

// ====================================================================================
// 7. REAL-WORLD INTEGRATION PATTERNS
// ====================================================================================

/**
 * Demonstrates real-world integration patterns and best practices
 */
class RealWorldExamples {
  
  /**
   * Web application with request/response logging
   */
  static webApplicationPattern() {
    console.log("\n=== Web Application Logging Pattern ===");
    
    class WebServer {
      private logger: Logger;
      
      constructor() {
        const factory = PinoLoggerFactory;
        this.logger = factory.createLogger({
          level: 'INFO',
          prettyPrint: true
        });
      }
      
      handleRequest(req: RequestContext) {
        const requestLogger = this.logger.withRequest(req);
        const startTime = Date.now();
        
        requestLogger.info("Request received");
        
        try {
          // Simulate request processing
          this.processRequest(requestLogger, req);
          
          const duration = Date.now() - startTime;
          requestLogger.info("Request completed", {
            statusCode: 200,
            duration: `${ duration }ms`,
            success: true
          });
          
        } catch (error) {
          const duration = Date.now() - startTime;
          requestLogger.error("Request failed", error as Error, {
            statusCode: 500,
            duration: `${ duration }ms`,
            success: false
          });
        }
      }
      
      private processRequest(
        logger: Logger,
        req: RequestContext
      ) {
        logger.debug("Authenticating request");
        logger.debug("Validating permissions");
        logger.debug("Processing business logic");
        
        if (req.url?.includes('/error')) {
          throw new Error("Simulated error");
        }
        
        logger.debug("Preparing response");
      }
    }
    
    const server = new WebServer();
    
    // Simulate various requests
    server.handleRequest({
      id: 'req_001',
      method: 'GET',
      url: '/api/users',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0'
    });
    
    server.handleRequest({
      id: 'req_002',
      method: 'POST',
      url: '/api/error',
      ip: '192.168.1.2',
      userAgent: 'curl/7.68.0'
    });
  }
  
  /**
   * Microservice with structured logging
   */
  static microservicePattern() {
    console.log("\n=== Microservice Logging Pattern ===");
    
    class UserMicroservice {
      private logger: Logger;
      
      constructor() {
        const factory = PinoLoggerFactory;
        this.logger = factory.createLogger({
          level: 'DEBUG',
          prettyPrint: true,
          base: {
            service: 'user-service',
            version: '1.2.3',
            environment: 'production'
          }
        });
      }
      
      async createUser(userData: {
        email: string;
        name: string;
        password: string;
      }) {
        const correlationId = `usr_${ Date.now() }_${ Math.random().toString(36).substring(7) }`;
        const userLogger = this.logger.withContext({ correlationId, operation: 'createUser' });
        
        userLogger.info("User creation initiated", {
          email: userData.email,
          name: userData.name
        });
        
        try {
          // Simulate validation
          userLogger.debug("Validating user input");
          await this.validateUser(userLogger, userData);
          
          // Simulate database operation
          userLogger.debug("Saving user to database");
          const user = await this.saveUser(userLogger, userData);
          
          // Simulate external service call
          userLogger.debug("Sending welcome email");
          await this.sendWelcomeEmail(userLogger, user);
          
          userLogger.info("User creation completed", {
            userId: user.id,
            success: true
          });
          
          return user;
          
        } catch (error) {
          userLogger.error("User creation failed", error as Error);
          throw error;
        }
      }
      
      private async validateUser(
        logger: Logger,
        userData: any
      ) {
        logger.debug("Checking email format");
        if (!userData.email.includes('@')) {
          throw new Error('Invalid email format');
        }
        
        logger.debug("Checking email uniqueness");
        // Simulate async validation
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      private async saveUser(
        logger: Logger,
        userData: any
      ) {
        logger.debug("Executing database insert");
        // Simulate async database operation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const user = {
          id: Math.floor(Math.random() * 1000),
          ...userData,
          createdAt: new Date()
        };
        
        logger.debug("User saved to database", { userId: user.id });
        return user;
      }
      
      private async sendWelcomeEmail(
        logger: Logger,
        user: any
      ) {
        logger.debug("Calling email service");
        // Simulate async email service
        await new Promise(resolve => setTimeout(resolve, 75));
        logger.debug("Welcome email sent", { recipient: user.email });
      }
    }
    
    const userService = new UserMicroservice();
    
    // Simulate user creation
    userService.createUser({
      email: 'john.doe@example.com',
      name: 'John Doe',
      password: 'secretPassword123'
    }).catch(error => {
      console.error('Service error:', error.message);
    });
  }
  
  /**
   * Error handling and monitoring integration
   */
  static errorHandlingAndMonitoring() {
    console.log("\n=== Error Handling and Monitoring Pattern ===");
    
    class MonitoredService {
      private logger: Logger;
      private errorCount = 0;
      
      constructor() {
        const factory = PinoLoggerFactory;
        this.logger = factory.createLogger({
          prettyPrint: true
        });
      }
      
      processOperation(
        operationId: string,
        shouldFail = false
      ) {
        const operationLogger = this.logger.withContext({
          operationId,
          timestamp: Date.now()
        });
        
        operationLogger.info("Operation started");
        
        try {
          if (shouldFail) {
            const error = new Error(`Operation ${ operationId } failed`);
            this.errorCount++;
            
            // In real app: send to monitoring service
            console.log(`[MONITORING] Error #${ this.errorCount } detected`);
            
            if (this.errorCount >= 5) {
              console.log(`[ALERT] High error rate detected: ${ this.errorCount } errors`);
            }
            
            throw error;
          }
          
          operationLogger.info("Operation completed successfully");
          return { success: true, operationId };
          
        } catch (error) {
          operationLogger.error("Operation failed", error as Error, {
            operationId,
            errorType: (error as Error).constructor.name,
            retryable: true
          });
          
          // In real app: decide on retry logic, circuit breaker, etc.
          throw error;
        }
      }
      
      getErrorCount() {
        return this.errorCount;
      }
    }
    
    const service = new MonitoredService();
    
    // Simulate multiple operations with some failures
    for (let i = 1; i <= 8; i++) {
      try {
        service.processOperation(`op_${ i }`, i % 3 === 0); // Every 3rd operation fails
      } catch (error) {
        // Handle error appropriately
        console.log(`Operation ${ i } handled gracefully`);
      }
    }
    
    console.log(`Total errors tracked: ${ service.getErrorCount() }`);
  }
}

// ====================================================================================
// 8. PERFORMANCE AND METRICS
// ====================================================================================

/**
 * Demonstrates performance monitoring and metrics collection
 */
class PerformanceExamples {
  
  /**
   * Performance timing with structured logging
   */
  static performanceTiming() {
    console.log("\n=== Performance Timing Examples ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      prettyPrint: true
    });
    
    const timedOperation = async (operationName: string) => {
      const startTime = Date.now();
      const perfLogger = logger.withContext({
        operation: operationName,
        startTime: startTime
      });
      
      perfLogger.info("Operation started");
      
      try {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
        
        const duration = Date.now() - startTime;
        perfLogger.info("Operation completed", {
          duration: `${ duration }ms`,
          success: true,
          performance: duration < 100 ? 'fast' : duration < 200 ? 'normal' : 'slow'
        });
        
        return { success: true, duration };
        
      } catch (error) {
        const duration = Date.now() - startTime;
        perfLogger.error("Operation failed", error as Error, {
          duration: `${ duration }ms`,
          success: false
        });
        throw error;
      }
    };
    
    // Run multiple timed operations
    Promise.all([
      timedOperation('DatabaseQuery'),
      timedOperation('APICall'),
      timedOperation('CacheOperation'),
      timedOperation('FileOperation')
    ]).then(results => {
      const totalDuration = results.reduce((
        sum,
        result
      ) => sum + result.duration, 0);
      logger.info("All operations completed", {
        totalDuration: `${ totalDuration }ms`,
        averageDuration: `${ Math.round(totalDuration / results.length) }ms`,
        operationCount: results.length
      });
    }).catch(error => {
      logger.error("Operation batch failed", error);
    });
  }
  
  /**
   * Memory and resource monitoring
   */
  static resourceMonitoring() {
    console.log("\n=== Resource Monitoring Examples ===");
    
    const factory = PinoLoggerFactory;
    const logger = factory.createLogger({
      prettyPrint: true
    });
    
    const logResourceUsage = () => {
      const memUsage = process.memoryUsage();
      
      logger.info("Resource usage check", {
        memory: {
          rss: `${ Math.round(memUsage.rss / 1024 / 1024) }MB`,
          heapUsed: `${ Math.round(memUsage.heapUsed / 1024 / 1024) }MB`,
          heapTotal: `${ Math.round(memUsage.heapTotal / 1024 / 1024) }MB`,
          external: `${ Math.round(memUsage.external / 1024 / 1024) }MB`
        },
        uptime: `${ Math.round(process.uptime()) }s`,
        loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
      });
      
      // Alert on high memory usage
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 100) { // Alert if over 100MB
        logger.warn("High memory usage detected", {
          heapUsedMB: Math.round(heapUsedMB),
          threshold: 100
        });
      }
    };
    
    // Initial resource check
    logResourceUsage();
    
    // Simulate memory-intensive operation
    const largeArray = new Array(100000).fill(0).map((
      _,
      i
    ) => ({ id: i, data: `item_${ i }` }));
    logger.info("Large array created", { arrayLength: largeArray.length });
    
    // Check resources after operation
    logResourceUsage();
    
    // Cleanup
    largeArray.length = 0;
    logger.info("Memory cleaned up");
    logResourceUsage();
  }
}

// ====================================================================================
// 9. RUNNING ALL EXAMPLES
// ====================================================================================

/**
 * Main function to run all logger examples
 */
function runAllLoggerExamples() {
  console.log("=".repeat(100));
  console.log("CLA LOGGER SYSTEM - COMPREHENSIVE EXAMPLES & DOCUMENTATION");
  console.log("=".repeat(100));
  
  try {
    // Basic logging examples
    BasicLoggingExamples.basicMessages();
    BasicLoggingExamples.objectLogging();
    BasicLoggingExamples.errorLogging();
    
    // Advanced features
    AdvancedLoggingExamples.childLoggers();
    AdvancedLoggingExamples.contextChaining();
    AdvancedLoggingExamples.requestContextTracking();
    AdvancedLoggingExamples.logLevelManagement();
    
    // Structured logging
    LogBuilderExamples.basicLogBuilder();
    LogBuilderExamples.advancedLogBuilder();
    LogBuilderExamples.structuredLoggingWithRedaction();
    
    // Sensitive data handling
    SensitiveDataExamples.redactedStrings();
    SensitiveDataExamples.customLoggableClasses();
    
    // Factory patterns
    LoggerFactoryExamples.pinoLoggerFactoryUsage();
    LoggerFactoryExamples.environmentSpecificConfiguration();
    LoggerFactoryExamples.customSerializersAndHooks();
    
    // NoOp logger examples
    NoOpLoggerExamples.testingScenarios();
    
    // Real-world patterns
    RealWorldExamples.webApplicationPattern();
    RealWorldExamples.microservicePattern();
    RealWorldExamples.errorHandlingAndMonitoring();
    
    // Performance monitoring
    PerformanceExamples.performanceTiming();
    PerformanceExamples.resourceMonitoring();
    
  } catch (error) {
    console.error("Error running examples:", error);
  }
  
  console.log("\n" + "=".repeat(100));
  console.log("ALL EXAMPLES COMPLETED");
  console.log("=".repeat(100));
}

// ====================================================================================
// 10. QUICK START GUIDE
// ====================================================================================

/**
 * ## Quick Start Guide
 *
 * ### 1. Basic Usage
 * ```typescript
 * import { PinoLogger, LogLevel } from '@cla/logger';
 *
 * const logger = new PinoLogger({
 *   level: 'info',
 *   prettyPrint: true
 * });
 *
 * logger.info('Application started');
 * logger.error('Something went wrong', new Error('Details'));
 * ```
 *
 * ### 2. Factory Pattern
 * ```typescript
 * import { PinoLoggerFactory } from '@cla/logger';
 *
 * const factory = new PinoLoggerFactory();
 * const logger = factory.createLogger({
 *   level: 'info',
 *   prettyPrint: process.env.NODE_ENV === 'development'
 * });
 * ```
 *
 * ### 3. NoOp Logger for Testing
 * ```typescript
 * import { NoOpLoggerFactory } from '@cla/logger';
 *
 * const factory = new NoOpLoggerFactory();
 * const silentLogger = factory.createLogger({});
 *
 * // All log calls are silent
 * silentLogger.info('This produces no output');
 * ```
 *
 * ### 4. Structured Logging
 * ```typescript
 * import { LogBuilder } from '@cla/logger';
 *
 * const message = LogBuilder.create('OrderService')
 *   .add('orderId', 'ORD-123')
 *   .add('amount', 99.99)
 *   .addRedacted('creditCard', '4111-1111-1111-1111')
 *   .end();
 *
 * logger.info(message);
 * ```
 *
 * ### 5. Environment Configuration
 * ```typescript
 * const createLogger = (env: string) => {
 *   if (env === 'test') {
 *     return new NoOpLoggerFactory().createLogger({});
 *   }
 *
 *   const factory = new PinoLoggerFactory();
 *   return factory.createLogger({
 *     level: env === 'production' ? 'info' : 'debug',
 *     prettyPrint: env !== 'production',
 *     redact: env === 'production' ? ['password', 'token'] : []
 *   });
 * };
 * ```
 */

// Export all example classes and the main runner
export {
  BasicLoggingExamples,
  AdvancedLoggingExamples,
  LogBuilderExamples,
  SensitiveDataExamples,
  LoggerFactoryExamples,
  NoOpLoggerExamples,
  RealWorldExamples,
  PerformanceExamples,
  runAllLoggerExamples
};

// Run all examples when this file is executed directly
runAllLoggerExamples();
