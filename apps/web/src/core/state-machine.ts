/**
 * State Machine - Workflow State Management
 *
 * Manages the state transitions for the agent workflow.
 */

import type { SessionStatus } from "../types/index.js";

interface StateTransition {
  from: SessionStatus;
  to: SessionStatus;
  action: string;
}

interface StateConfig {
  onEnter?: () => void | Promise<void>;
  onExit?: () => void | Promise<void>;
  allowedTransitions: SessionStatus[];
}

export class StateMachine {
  private currentState: SessionStatus;
  private stateConfigs: Map<SessionStatus, StateConfig>;
  private transitionHistory: StateTransition[];
  private listeners: Map<
    string,
    Array<(from: SessionStatus, to: SessionStatus) => void>
  >;

  constructor(initialState: SessionStatus = "initializing") {
    this.currentState = initialState;
    this.stateConfigs = new Map();
    this.transitionHistory = [];
    this.listeners = new Map();

    this.initializeDefaultStates();
  }

  private initializeDefaultStates(): void {
    // Define valid state transitions
    this.stateConfigs.set("initializing", {
      allowedTransitions: ["planning", "failed", "cancelled"],
    });

    this.stateConfigs.set("planning", {
      allowedTransitions: ["executing", "failed", "cancelled"],
    });

    this.stateConfigs.set("executing", {
      allowedTransitions: ["reviewing", "failed", "cancelled", "planning"],
    });

    this.stateConfigs.set("reviewing", {
      allowedTransitions: [
        "executing",
        "preview_validation",
        "failed",
        "cancelled",
      ],
    });

    // NEW: Preview validation phase - ensures UI is visually rendered
    this.stateConfigs.set("preview_validation" as SessionStatus, {
      allowedTransitions: ["completed", "executing", "failed", "cancelled"],
    });

    this.stateConfigs.set("completed", {
      allowedTransitions: [], // Terminal state
    });

    this.stateConfigs.set("failed", {
      allowedTransitions: ["planning", "cancelled"], // Can retry from failed
    });

    this.stateConfigs.set("cancelled", {
      allowedTransitions: [], // Terminal state
    });
  }

  /**
   * Get current state
   */
  getState(): SessionStatus {
    return this.currentState;
  }

  /**
   * Check if a transition is valid
   */
  canTransition(to: SessionStatus): boolean {
    const config = this.stateConfigs.get(this.currentState);
    if (!config) return false;
    return config.allowedTransitions.includes(to);
  }

  /**
   * Transition to a new state
   */
  async transition(
    to: SessionStatus,
    action: string = "unknown"
  ): Promise<boolean> {
    if (!this.canTransition(to)) {
      console.error(
        `Invalid transition: ${this.currentState} -> ${to} (action: ${action})`
      );
      return false;
    }

    const from = this.currentState;
    const currentConfig = this.stateConfigs.get(from);
    const nextConfig = this.stateConfigs.get(to);

    // Execute exit callback
    if (currentConfig?.onExit) {
      await currentConfig.onExit();
    }

    // Record transition
    this.transitionHistory.push({ from, to, action });
    this.currentState = to;

    // Execute enter callback
    if (nextConfig?.onEnter) {
      await nextConfig.onEnter();
    }

    // Notify listeners
    this.notifyListeners(from, to);

    return true;
  }

  /**
   * Register a callback for state entry
   */
  onStateEnter(
    state: SessionStatus,
    callback: () => void | Promise<void>
  ): void {
    const config = this.stateConfigs.get(state);
    if (config) {
      config.onEnter = callback;
    }
  }

  /**
   * Register a callback for state exit
   */
  onStateExit(
    state: SessionStatus,
    callback: () => void | Promise<void>
  ): void {
    const config = this.stateConfigs.get(state);
    if (config) {
      config.onExit = callback;
    }
  }

  /**
   * Subscribe to all state transitions
   */
  onTransition(
    callback: (from: SessionStatus, to: SessionStatus) => void
  ): string {
    const id = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!this.listeners.has("all")) {
      this.listeners.set("all", []);
    }
    this.listeners.get("all")!.push(callback);

    return id;
  }

  /**
   * Get transition history
   */
  getHistory(): StateTransition[] {
    return [...this.transitionHistory];
  }

  /**
   * Check if in terminal state
   */
  isTerminal(): boolean {
    return (
      this.currentState === "completed" ||
      this.currentState === "cancelled" ||
      this.currentState === "failed"
    );
  }

  /**
   * Reset state machine
   */
  reset(): void {
    this.currentState = "initializing";
    this.transitionHistory = [];
  }

  private notifyListeners(from: SessionStatus, to: SessionStatus): void {
    const callbacks = this.listeners.get("all") || [];
    callbacks.forEach((cb) => cb(from, to));
  }
}
