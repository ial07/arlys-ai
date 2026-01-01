/**
 * Base Agent
 * 
 * Abstract base class for all agents in the system.
 * Provides common functionality for message handling, lifecycle, and metrics.
 */

import { nanoid } from 'nanoid';
import type {
  AgentConfig,
  AgentContext,
  AgentMetrics,
  AgentState,
  MessageHandler,
} from '../types/index.js';
import type { AgentMessage, AgentName } from '../types/message.types.js';
import { getMessageBus, type MessageBus } from '../core/message-bus.js';
import { getSTM, type ShortTermMemory } from '../memory/stm.js';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected context: AgentContext;
  protected state: AgentState;
  protected metrics: AgentMetrics;
  protected messageBus: MessageBus;
  protected stm: ShortTermMemory;
  protected handlers: Map<string, MessageHandler>;
  protected subscriptionIds: string[];

  constructor(config: AgentConfig, context: AgentContext) {
    this.config = config;
    this.context = context;
    this.state = 'idle';
    this.metrics = {
      tasksProcessed: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      averageProcessingTime: 0,
      lastActivity: null,
    };
    this.messageBus = getMessageBus();
    this.stm = getSTM();
    this.handlers = new Map();
    this.subscriptionIds = [];
  }

  /**
   * Agent name
   */
  get name(): AgentName {
    return this.config.name;
  }

  /**
   * Current agent state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Get agent metrics
   */
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    this.log('Initializing...');

    // Register handlers
    this.registerHandlers();

    // Subscribe to messages
    for (const [action, handler] of this.handlers) {
      const subscriptionId = this.messageBus.subscribe(
        this.name,
        action,
        async (message: AgentMessage) => {
          await this.handleMessage(message, handler);
        }
      );
      this.subscriptionIds.push(subscriptionId);
    }

    // Agent-specific initialization
    await this.onInitialize();

    this.log('Initialized');
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    this.log('Shutting down...');

    // Unsubscribe from messages
    for (const subscriptionId of this.subscriptionIds) {
      this.messageBus.unsubscribe(subscriptionId);
    }
    this.subscriptionIds = [];

    // Agent-specific cleanup
    await this.onShutdown();

    this.state = 'idle';
    this.log('Shutdown complete');
  }

  /**
   * Send a message to another agent
   */
  protected async send<T>(
    to: AgentName,
    action: string,
    payload: T,
    taskId?: string
  ): Promise<string> {
    return this.messageBus.send(
      this.name,
      to,
      action,
      payload,
      { sessionId: this.context.sessionId, taskId }
    );
  }

  /**
   * Send a request and wait for response
   */
  protected async request<TReq, TRes>(
    to: AgentName,
    action: string,
    payload: TReq,
    taskId?: string
  ): Promise<AgentMessage<TRes>> {
    return this.messageBus.request<TReq, TRes>(
      this.name,
      to,
      action,
      payload,
      { sessionId: this.context.sessionId, taskId },
      this.config.timeoutMs
    );
  }

  /**
   * Respond to a received message
   */
  protected async respond<T>(
    originalMessage: AgentMessage,
    payload: T
  ): Promise<string> {
    return this.messageBus.respond(originalMessage, payload);
  }

  /**
   * Store value in short-term memory
   */
  protected storeContext<T>(key: string, value: T, taskId?: string): void {
    const id = taskId || this.context.sessionId;
    this.stm.set(id, key, value);
  }

  /**
   * Retrieve value from short-term memory
   */
  protected getContext<T>(key: string, taskId?: string): T | null {
    const id = taskId || this.context.sessionId;
    return this.stm.get<T>(id, key);
  }

  /**
   * Log a message with agent prefix
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = `[${this.name.toUpperCase()}]`;
    const timestamp = new Date().toISOString();

    switch (level) {
      case 'warn':
        console.warn(`${timestamp} ${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${timestamp} ${prefix} ${message}`);
        break;
      default:
        console.log(`${timestamp} ${prefix} ${message}`);
    }
  }

  /**
   * Handle incoming message with error handling and metrics
   */
  private async handleMessage(
    message: AgentMessage,
    handler: MessageHandler
  ): Promise<void> {
    const startTime = Date.now();
    this.state = 'busy';
    this.metrics.lastActivity = new Date();

    try {
      this.log(`Processing: ${message.action}`);
      await handler.handler(message);
      this.metrics.tasksSucceeded++;
    } catch (error) {
      this.log(`Error processing ${message.action}: ${error}`, 'error');
      this.metrics.tasksFailed++;

      // Send error response
      await this.respond(message, {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });
    } finally {
      this.metrics.tasksProcessed++;
      
      // Update average processing time
      const duration = Date.now() - startTime;
      this.metrics.averageProcessingTime =
        (this.metrics.averageProcessingTime * (this.metrics.tasksProcessed - 1) + duration) /
        this.metrics.tasksProcessed;

      this.state = 'idle';
    }
  }

  /**
   * Register message handlers - must be implemented by subclasses
   */
  protected abstract registerHandlers(): void;

  /**
   * Agent-specific initialization - optional override
   */
  protected async onInitialize(): Promise<void> {}

  /**
   * Agent-specific shutdown - optional override
   */
  protected async onShutdown(): Promise<void> {}
}
