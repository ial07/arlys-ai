import { useEffect, useRef } from 'react';
import { ChatMessage } from './chat-message';
import { ChatTerminal } from './chat-terminal';

interface MessageListProps {
  messages: any[];
  userEmail?: string | null;
  sessionStatus?: string;
  sessionTasks?: { completed: number; total: number };
  isLoading?: boolean;
}

export function MessageList({ messages, userEmail, sessionStatus, sessionTasks, isLoading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sessionStatus, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-800">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} userEmail={userEmail} />
      ))}

      {/* Execution/Planning Terminal */}
      {sessionStatus && (
        <ChatTerminal status={sessionStatus} tasks={sessionTasks} />
      )}
      
      {/* Loading Indicator */}
      {isLoading && !sessionStatus && (
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">🤖</div>
          <div className="flex items-center gap-1 h-8">
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-200"></span>
          </div>
        </div>
      )}
      
      <div ref={endRef} />
    </div>
  );
}
