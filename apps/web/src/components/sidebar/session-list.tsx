import { useEffect, useState } from 'react';

interface Session {
  id: string;
  goal: string;
  projectName: string;
  status: string;
  createdAt: string;
}

interface SessionListProps {
  onSelectSession: (sessionId: string) => void;
  activeSessionId?: string;
}

export function SessionList({ activeSessionId, onSelectSession }: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [activeSessionId]); 

  return (
    <div className="flex flex-col gap-2">
      {/* Removed New Project Button from here, handled in Sidebar */}
      
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {isLoading ? (
          <div className="text-center py-4 text-xs text-dark-500">Loading history...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-xs text-dark-500">
            No projects yet.<br />Start one above! 🚀
          </div>
        ) : (
          <div className="space-y-1">
             <h3 className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-dark-500">History</h3>
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`w-full text-left p-2 rounded-lg text-xs transition-all group relative ${
                  activeSessionId === session.id
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <div className="font-medium truncate mb-0.5">
                  {session.projectName || 'Untitled Project'}
                </div>
                <div className="flex justify-between items-center text-[10px] opacity-70">
                   <span className="truncate max-w-[70%]">{new Date(session.createdAt).toLocaleDateString()}</span>
                   <span className={`${
                     session.status === 'completed' ? 'text-green-400' :
                     session.status === 'failed' ? 'text-red-400' : 'text-primary-400'
                   }`}>
                     {session.status}
                   </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
