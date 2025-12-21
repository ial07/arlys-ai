# AI Agent Builder

An autonomous AI Agent system for generating, validating, and iterating fullstack JavaScript applications end-to-end.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     Orchestrator Agent                          │
│    (Central coordinator managing workflow between agents)       │
└───┬────────────────┬────────────────┬────────────────┬──────────┘
    │                │                │                │
┌───▼────┐    ┌──────▼─────┐   ┌──────▼─────┐   ┌──────▼─────┐
│Planner │    │  Executor  │   │  Reviewer  │   │   Memory   │
│ Agent  │    │   Agent    │   │   Agent    │   │   System   │
└────────┘    └────────────┘   └────────────┘   └────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Project Structure

```
src/
├── index.ts              # Entry point
├── agents/               # Agent implementations
│   ├── base.agent.ts     # Abstract base agent
│   ├── orchestrator.ts   # Central coordinator
│   ├── planner.ts        # Goal → Task decomposition
│   ├── executor.ts       # Code generation
│   └── reviewer.ts       # Validation & review
├── core/                 # Core infrastructure
│   ├── message-bus.ts    # Inter-agent communication
│   ├── state-machine.ts  # Workflow state management
│   └── sandbox.ts        # Execution sandbox
├── memory/               # Memory systems
│   ├── stm.ts           # Short-term memory
│   ├── ltm.ts           # Long-term memory
│   └── patterns.ts      # Pattern store
├── tools/                # Execution tools
│   ├── file-system.ts   # Safe file operations
│   ├── command.ts       # Command execution
│   └── linter.ts        # Code quality tools
├── templates/            # Code templates
│   ├── nextjs/          # Next.js templates
│   ├── prisma/          # Prisma templates
│   └── api/             # API templates
└── types/                # TypeScript types
    ├── agent.types.ts
    ├── task.types.ts
    └── message.types.ts
```

## Agents

### Orchestrator
Central coordinator managing the workflow between all agents. Maintains the state machine and routes tasks appropriately.

### Planner
Converts high-level goals into structured, executable task plans with dependencies.

### Executor
Generates production-ready code based on task specifications and templates.

### Reviewer
Validates code for syntax, style, security, and correctness.

## License

MIT
