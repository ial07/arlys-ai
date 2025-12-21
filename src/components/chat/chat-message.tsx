import { useSession } from "next-auth/react";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export function ChatMessage({
  message,
  userEmail,
}: {
  message: Message;
  userEmail?: string | null;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""} animate-in fade-in slide-in-from-bottom-2 duration-300`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser
            ? "bg-gradient-to-br from-blue-500 to-purple-600"
            : "bg-white/10"
        }`}
      >
        {isUser ? (
          userEmail?.[0]?.toUpperCase() || "U"
        ) : (
          <img
            src="/assets/icon/logo-ai.png"
            alt="AI"
            className="w-5 h-5 object-contain"
          />
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser ? "bg-[#2a2a2a] text-gray-100" : "bg-transparent text-gray-300"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
