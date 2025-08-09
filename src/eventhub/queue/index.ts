/**
 * @fileoverview Queue Package Index
 *
 * This module provides consolidated exports for the Queue package functionality.
 *
 * @author
 * @version 1.0.0
 */

// Core queue types
export type {
  QueueConfig,
  EventQueueConfig,
  QueueMetrics,
  ReceiveOptions,
  ReceivedMessage
} from "./types";

// Core queue classes
export { Queue } from "./Queue";
export { QueueManager } from "./QueueManager";
export { MessageSender } from "./MessageSender";
export { MessageReceiver } from "./MessageReceiver";

// Queue message bus implementations
export { QueueMessageBus } from "./QueueMessageBus";
// export { ArrayQueueMessageBus } from "./ArrayQueueMessageBus";
// export { HeapQueueMessageBus } from "./HeapQueueMessageBus";
