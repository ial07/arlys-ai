interface ChatTerminalProps {
  status: string;
  tasks?: { completed: number; total: number };
}

export function ChatTerminal({ status, tasks }: ChatTerminalProps) {
  if (status !== 'executing' && status !== 'planning') return null;

  return (
    <div className={`rounded-xl border overflow-hidden ${
      status === 'executing' 
        ? 'bg-[#0a0a0a] border-blue-500/30' 
        : 'bg-[#0a0a0a] border-purple-500/30'
    }`}>
      <div className={`px-4 py-2 bg-[#0d0d0d] border-b flex items-center gap-2 ${
        status === 'executing' ? 'border-blue-500/20' : 'border-purple-500/20'
      }`}>
        <span className={`w-2 h-2 rounded-full animate-pulse ${
          status === 'executing' ? 'bg-blue-500' : 'bg-purple-500'
        }`}></span>
        <span className={`text-xs font-mono ${
          status === 'executing' ? 'text-blue-400' : 'text-purple-400'
        }`}>
          {status === 'executing' ? 'EXECUTING TASKS' : 'PLANNING'}
        </span>
        {status === 'executing' && tasks && (
          <span className="ml-auto text-xs text-gray-500">{tasks.completed}/{tasks.total}</span>
        )}
      </div>
      
      <div className="p-4 font-mono text-xs space-y-2 max-h-40 overflow-y-auto">
        {status === 'executing' ? (
          <>
            <div className="text-green-400">$ agent --execute</div>
            <div className="text-gray-500">→ Status: executing</div>
            <div className="text-gray-500">→ Progress: {tasks?.completed || 0} of {tasks?.total || 0} tasks completed</div>
            <div className="text-yellow-400 flex items-center gap-2">
              <span className="animate-pulse">▶</span> Working on task {(tasks?.completed || 0) + 1}...
            </div>
            <div className="text-gray-600 text-[10px]">Generating code... This may take a moment.</div>
          </>
        ) : (
          <>
            <div className="text-purple-400">$ agent --plan</div>
            <div className="text-gray-500">→ Analyzing your requirements...</div>
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
