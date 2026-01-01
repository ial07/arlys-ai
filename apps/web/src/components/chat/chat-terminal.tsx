interface ChatTerminalProps {
  status: string;
  tasks?: { completed: number; total: number };
}

export function ChatTerminal({ status, tasks }: ChatTerminalProps) {
  // Check if we are in a self-healing flow (looking at the rendered status or derived prop)
  // Since 'status' prop comes from session.status, which might still be 'executing',
  // we need to check if there are any specific indicators or if we just want to enhance the executing state.

  // For now, let's enhance the 'executing' view to show "Self-Healing" if tasks are stuck or if called out.
  // But a better approach requested is just to show "Status: Self-Healing" instead of generic executing if inferred.

  // Actually, the user wants to know about "failed" or "errors" context.
  // If status is 'failed', we can show a red terminal.
  if (status === "failed") {
    return (
      <div className="rounded-xl border border-red-500/30 overflow-hidden bg-[#0a0a0a]">
        <div className="px-4 py-2 bg-[#0d0d0d] border-b border-red-500/20 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <span className="text-xs font-mono text-red-400">BUILD FAILED</span>
        </div>
        <div className="p-4 font-mono text-xs space-y-2">
          <div className="text-red-400">$ validation --failed</div>
          <div className="text-gray-500">→ Critical errors detected.</div>
          <div className="text-gray-500">
            → Automatic recovery failed or max retries reached.
          </div>
          <div className="text-yellow-400 mt-2">
            ► Click "Fix Error" to try again manually.
          </div>
        </div>
      </div>
    );
  }

  if (status === "fixing") {
    return (
      <div className="rounded-xl border border-yellow-500/30 overflow-hidden bg-[#0a0a0a]">
        <div className="px-4 py-2 bg-[#0d0d0d] border-b border-yellow-500/20 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
          <span className="text-xs font-mono text-yellow-400">
            SELF HEALING MODE
          </span>
        </div>
        <div className="p-4 font-mono text-xs space-y-2">
          <div className="text-yellow-400">$ agent --fix</div>
          <div className="text-gray-500">
            → Build or Runtime validation failed.
          </div>
          <div className="text-gray-500">→ Analyzing error logs...</div>
          <div className="text-blue-400 flex items-center gap-2">
            <span className="animate-spin">⟳</span> Generating patches...
          </div>
        </div>
      </div>
    );
  }

  if (status !== "executing" && status !== "planning") return null;

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        status === "executing"
          ? "bg-[#0a0a0a] border-blue-500/30"
          : "bg-[#0a0a0a] border-purple-500/30"
      }`}
    >
      <div
        className={`px-4 py-2 bg-[#0d0d0d] border-b flex items-center gap-2 ${
          status === "executing" ? "border-blue-500/20" : "border-purple-500/20"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full animate-pulse ${
            status === "executing" ? "bg-blue-500" : "bg-purple-500"
          }`}
        ></span>
        <span
          className={`text-xs font-mono ${
            status === "executing" ? "text-blue-400" : "text-purple-400"
          }`}
        >
          {status === "executing" ? "EXECUTING TASKS" : "PLANNING"}
        </span>
        {status === "executing" && tasks && (
          <span className="ml-auto text-xs text-gray-500">
            {tasks.completed}/{tasks.total}
          </span>
        )}
      </div>

      <div className="p-4 font-mono text-xs space-y-2 max-h-40 overflow-y-auto">
        {status === "executing" ? (
          <>
            <div className="text-green-400">$ agent --execute</div>
            <div className="text-gray-500">→ Status: executing</div>
            <div className="text-gray-500">
              → Progress: {tasks?.completed || 0} of {tasks?.total || 0} tasks
              completed
            </div>
            <div className="text-yellow-400 flex items-center gap-2">
              <span className="animate-pulse">▶</span> Working on task{" "}
              {(tasks?.completed || 0) + 1}...
            </div>
          </>
        ) : (
          <>
            <div className="text-purple-400">$ agent --plan</div>
            <div className="text-gray-500">
              → Analyzing your requirements...
            </div>
            <div className="text-gray-500">→ Creating task breakdown...</div>
            <div className="text-yellow-400 flex items-center gap-2">
              <span className="animate-spin">⟳</span> Generating project plan...
            </div>
          </>
        )}
      </div>
    </div>
  );
}
