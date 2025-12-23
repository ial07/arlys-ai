interface SessionHeaderProps {
  projectName?: string;
  goal: string;
  status: string;
  activeTab: "chat" | "files" | "preview";
  onTabChange: (tab: "chat" | "files" | "preview") => void;
  onDownload: () => void;
  previewUrl?: string | null;
  totalTasks: number;
  completedTasks: number;
  onFixError: () => void;
}

export function SessionHeader({
  projectName,
  goal,
  status,
  activeTab,
  onTabChange,
  onDownload,
  previewUrl,
  totalTasks,
  completedTasks,
  onFixError,
}: SessionHeaderProps) {
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 pl-14 md:px-6 bg-[#121212]/50 backdrop-blur-sm z-10 relative overflow-hidden">
      {/* Background Progress Bar */}
      {status !== "completed" && status !== "failed" && (
        <div
          className="absolute bottom-0 left-0 h-[2px] bg-blue-500/50 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      )}

      <div className="flex items-center gap-3 min-w-0">
        <h2
          className="font-semibold text-sm text-gray-200 truncate max-w-[200px]"
          title={goal}
        >
          {projectName || goal}
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${
              status === "completed"
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : status === "failed"
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
            }`}
          >
            {status}
          </span>
          {status === "failed" && (
            <button
              onClick={onFixError}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center gap-1"
            >
              <span>↺</span> Fix Error
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
          <button
            onClick={() => onTabChange("chat")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "chat"
                ? "bg-white/10 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => onTabChange("files")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "files"
                ? "bg-white/10 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Files
          </button>
          <button
            onClick={() => onTabChange("preview")}
            disabled={!previewUrl}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "preview"
                ? "bg-white/10 text-white shadow-sm"
                : !previewUrl
                  ? "text-gray-700 cursor-not-allowed"
                  : "text-gray-500 hover:text-gray-300"
            }`}
            title={
              !previewUrl
                ? "Preview available when build starts"
                : "View Live Preview"
            }
          >
            Preview
          </button>
        </div>

        <button
          onClick={onDownload}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-2"
          title="Download Code"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>
    </header>
  );
}
