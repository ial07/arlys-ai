/**
 * Message Bus - Inter-Agent Communication System
 * 
 * Handles message passing between agents using an event-driven architecture.
 */

import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import type { AgentMessage, AgentName, MessageType } from '../types/index.js';

type MessageCallback<T = unknown> = (message: AgentMessage<T>) => void | Promise<void>;

interface Subscription {
  id: string;
  agent: AgentName;
  action: string;
  callback: MessageCallback;
}

export class MessageBus {
  private emitter: EventEmitter;
  private subscriptions: Map<string, Subscription>;
  private messageLog: AgentMessage[];
  private maxLogSize: number;

  constructor(maxLogSize: number = 1000) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
    this.subscriptions = new Map();
    this.messageLog = [];
    this.maxLogSize = maxLogSize;
  }

  /**
   * Subscribe to messages for a specific agent and action
   */
  subscribe<T = unknown>(
    agent: AgentName,
    action: string,
    callback: MessageCallback<T>
  ): string {
    const subscriptionId = nanoid();
    const eventName = this.getEventName(agent, action);

    const subscription: Subscription = {
      id: subscriptionId,
      agent,
      action,
      callback: callback as MessageCallback,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.emitter.on(eventName, callback);

    return subscriptionId;
  }

  /**
   * Subscribe to all messages for a specific agent
   */
  subscribeAll<T = unknown>(
    agent: AgentName,
    callback: MessageCallback<T>
  ): string {
    const subscriptionId = nanoid();
    const eventName = `${agent}:*`;

    const subscription: Subscription = {
      id: subscriptionId,
      agent,
      action: '*',
      callback: callback as MessageCallback,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.emitter.on(eventName, callback);

    return subscriptionId;
  }

  /**
   * Unsubscribe from messages
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    const eventName = this.getEventName(subscription.agent, subscription.action);
    this.emitter.off(eventName, subscription.callback);
    this.subscriptions.delete(subscriptionId);

    return true;
  }

  /**
   * Publish a message to the bus
   */
  async publish<T = unknown>(message: AgentMessage<T>): Promise<void> {
    // Log the message
    this.logMessage(message);

    // Emit to specific action listeners
    const specificEvent = this.getEventName(message.to, message.action);
    this.emitter.emit(specificEvent, message);

    // Emit to wildcard listeners
    const wildcardEvent = `${message.to}:*`;
    this.emitter.emit(wildcardEvent, message);
  }

  /**
   * Create and publish a message
   */
  async send<T = unknown>(
    from: AgentName,
    to: AgentName,
    action: string,
    payload: T,
    context: { sessionId: string; taskId?: string; correlationId?: string },
    type: MessageType = 'request'
  ): Promise<string> {
    const messageId = nanoid();

    const message: AgentMessage<T> = {
      id: messageId,
      from,
      to,
      type,
      action,
      payload,
      context: {
        sessionId: context.sessionId,
        taskId: context.taskId,
        correlationId: context.correlationId || nanoid(),
      },
      timestamp: new Date(),
    };

    await this.publish(message);
    return messageId;
  }

  /**
   * Request-response pattern with timeout
   */
  async request<TReq, TRes>(
    from: AgentName,
    to: AgentName,
    action: string,
    payload: TReq,
    context: { sessionId: string; taskId?: string },
    timeoutMs: number = 30000
  ): Promise<AgentMessage<TRes>> {
    const correlationId = nanoid();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.unsubscribe(subscriptionId);
        reject(new Error(`Request timeout: ${action} to ${to}`));
      }, timeoutMs);

      const subscriptionId = this.subscribe<TRes>(
        from,
        `${action}:response`,
        (response) => {
          if (response.context.correlationId === correlationId) {
            clearTimeout(timeout);
            this.unsubscribe(subscriptionId);
            resolve(response);
          }
        }
      );

      this.send(from, to, action, payload, { ...context, correlationId }, 'request');
    });
  }

  /**
   * Respond to a request
   */
  async respond<T = unknown>(
    originalMessage: AgentMessage,
    payload: T,
    type: MessageType = 'response'
  ): Promise<string> {
    return this.send(
      originalMessage.to,
      originalMessage.from,
      `${originalMessage.action}:response`,
      payload,
      {
        sessionId: originalMessage.context.sessionId,
        taskId: originalMessage.context.taskId,
        correlationId: originalMessage.context.correlationId,
      },
      type
    );
  }

  /**
   * Get message history for a session
   */
  getMessageHistory(sessionId: string): AgentMessage[] {
    return this.messageLog.filter((m) => m.context.sessionId === sessionId);
  }

  /**
   * Clear message log
   */
  clearLog(): void {
    this.messageLog = [];
  }

  private getEventName(agent: AgentName, action: string): string {
    return `${agent}:${action}`;
  }

  private logMessage(message: AgentMessage): void {
    this.messageLog.push(message);
    if (this.messageLog.length > this.maxLogSize) {
      this.messageLog.shift();
    }
  }
}

// Singleton instance
let messageBusInstance: MessageBus | null = null;

export function getMessageBus(): MessageBus {
  if (!messageBusInstance) {
    messageBusInstance = new MessageBus();
  }
  return messageBusInstance;
}

export function resetMessageBus(): void {
  messageBusInstance = null;
}
