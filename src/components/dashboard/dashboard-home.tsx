"use client";

import Image from "next/image";
import { useState } from "react";

interface DashboardHomeProps {
  userEmail?: string | null;
  userName?: string | null; // e.g. "Ilham"
  onCreateProject: (prompt: string) => void;
  isLoading?: boolean;
}

export function DashboardHome({
  userEmail,
  userName,
  onCreateProject,
  isLoading = false,
}: DashboardHomeProps) {
  const [prompt, setPrompt] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onCreateProject(prompt.trim());
  };

  const displayName = userName || userEmail?.split("@")[0] || "Creator";

  return (
    <div className="flex-1 h-full relative overflow-hidden flex flex-col items-center justify-center p-6 pt-14 md:p-6 bg-[#050505]">
      {/* Background Gradients */}
      <div className="absolute top-[20%] left-[50%] translate-x-[-50%] w-[800px] h-[500px] rounded-[100%] bg-blue-600/20 blur-[120px] pointer-events-none opacity-50" />
      <div className="absolute bottom-[20%] right-[20%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute top-[10%] left-[10%] w-[300px] h-[300px] rounded-full bg-pink-600/10 blur-[80px] pointer-events-none" />

      <div className="flex justify-center items-center relative size-32 mb-3">
        <Image src="/assets/icon/logo-ai.png" alt="Logo" fill />
      </div>

      {/* Badge / Announcement */}
      <div className="z-10 mb-8 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-colors cursor-pointer group">
          <span className="text-xs font-semibold bg-gradient-to-r from-pink-500 to-purple-500 px-1.5 py-0.5 rounded text-white transform -rotate-2">
            NEW
          </span>
          <span className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">
            Start creating with AI &rarr;
          </span>
        </div>
      </div>

      {/* Greeting */}
      <h1 className="z-10 text-4xl md:text-5xl font-bold tracking-tight mb-12 text-center text-white/90">
        Let's create,{" "}
        <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          {displayName}
        </span>
      </h1>

      {/* Input Area */}
      <div className="z-10 w-full max-w-2xl relative group">
        <div
          className={`absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500 ${isTyping ? "opacity-50" : ""}`}
        />

        <form
          onSubmit={handleSubmit}
          className="relative bg-[#121212] border border-white/10 rounded-2xl p-1 shadow-2xl transition-colors"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setIsTyping(true)}
            onBlur={() => setIsTyping(false)}
            disabled={isLoading}
            placeholder={
              isLoading
                ? "Creating project..."
                : "What do you want to build today?"
            }
            className="w-full bg-transparent text-lg placeholder:text-gray-600 text-gray-100 p-4 rounded-xl focus:outline-none focus:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />

          <div className="flex items-center justify-between px-2 pb-1 pt-2">
            <div className="flex gap-2">
              {/* Buttons removed for brevity */}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!prompt.trim() || isLoading}
                className={`p-2 rounded-lg transition-all ${
                  prompt.trim() && !isLoading
                    ? "bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                    : "bg-white/10 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isLoading ? (
                  <div className="size-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Footer / Quick Templates */}
      <div className="z-10 mt-16 text-center">
        <p className="text-sm text-gray-500 mb-4">Try a template</p>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            "SaaS Dashboard",
            "Portfolio Site",
            "E-commerce Store",
            "Blog Platform",
          ].map((item) => (
            <button
              key={item}
              onClick={() => onCreateProject(`Build a ${item}`)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-sm text-gray-400 hover:text-gray-200 transition-all"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
