/**
 * @fileoverview Topic Package Index
 *
 * This module provides consolidated exports for the Topic package functionality.
 *
 * @author
 * @version 1.0.0
 */

// Core topic types
export type {
  TopicConfig,
  SubscriptionOptions,
  EventSubscription,
  TopicMetrics,
  SubscriberInfo
} from "./types";

// Core topic classes
export { Topic } from "./Topic";
export { TopicManager } from "./TopicManager";
export { Publisher } from "./Publisher";
export { Subscriber } from "./Subscriber";

// Topic message bus implementations
export { TopicMessageBus } from "./TopicMessageBus";
// export { ArrayTopicMessageBus } from "./ArrayTopicMessageBus";
// export { HeapTopicMessageBus } from "./HeapTopicMessageBus";
