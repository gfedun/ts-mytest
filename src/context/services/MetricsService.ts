/**
 * @fileoverview Metrics Service - Dedicated Metrics Collection
 */

import { Logger } from '@/logger';
import {
  ApplicationContextPhase,
  EventHubMetrics,
  PortMetrics,
  QueueMetrics,
  TopicMetrics
} from '../types';
import { PortService } from './PortService';
import { QueueService } from './QueueService';
import { TopicService } from './TopicService';

export class MetricsService {
  private readonly logger: Logger;
  private readonly startTime = new Date();
  
  constructor(logger: Logger) {
    this.logger = logger;
  }
  
  async getEventHubMetrics(
    contextName: string,
    phase: ApplicationContextPhase,
    queueService: QueueService,
    topicService: TopicService,
    portService: PortService
  ): Promise<EventHubMetrics> {
    const timestamp = new Date();
    const uptime = timestamp.getTime() - this.startTime.getTime();
    
    // Simple metrics collection - can be enhanced later
    const queueMetrics: QueueMetrics[] = [];
    const topicMetrics: TopicMetrics[] = [];
    const portMetrics: PortMetrics[] = [];
    
    return {
      contextName,
      status: this.determineStatus(phase),
      timestamp,
      uptime,
      phase,
      queueMetrics: {
        totalQueues: 0, // Will be implemented when queue service has proper metrics
        activeQueues: 0,
        queues: queueMetrics,
        totalMessages: 0,
        totalErrors: 0
      },
      topicMetrics: {
        totalTopics: 0, // Will be implemented when topic service has proper metrics
        activeTopics: 0,
        topics: topicMetrics,
        totalSubscriptions: 0,
        totalPublished: 0,
        totalErrors: 0
      },
      portMetrics: {
        totalPorts: 0, // Will be implemented when port service has proper metrics
        connectedPorts: 0,
        ports: portMetrics,
        externalBrokerConnections: 0,
        totalErrors: 0
      },
      performance: {
        peakConcurrentConnections: 0,
        totalEventsProcessed: 0
      },
      errors: {
        totalErrors: 0,
        recentErrors: []
      }
    };
  }
  
  private determineStatus(phase: ApplicationContextPhase): 'running' | 'stopped' | 'error' | 'initializing' {
    switch (phase) {
      case ApplicationContextPhase.Running:
        return 'running';
      case ApplicationContextPhase.Stopped:
        return 'stopped';
      case ApplicationContextPhase.Failed:
        return 'error';
      default:
        return 'initializing';
    }
  }
}
