"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";

export function LandingHero() {
  const [prompt, setPrompt] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // Redirect to Google Login, passing the prompt as a callback param
    // We'll handle the prompt extraction in the main page after login
    // Or we can save to localStorage for simplicity/robustness
    localStorage.setItem("pendingPrompt", prompt);

    signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative selection:bg-primary-500/30">
      {/* Background Gradients (Lovable Vibes) */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-purple-900/20 via-blue-900/10 to-transparent pointer-events-none" />
      <div className="absolute top-[-200px] left-[50%] translate-x-[-50%] w-[1000px] h-[600px] rounded-[100%] bg-blue-600/20 blur-[120px] pointer-events-none opacity-50" />
      <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="size-10 relative rounded-lg  flex items-center justify-center">
            <Image src="/assets/icon/logo-ai.png" fill alt="Logo" />
          </div>
          <span className="font-bold text-lg tracking-tight">Arlys AI</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-gray-400">
          <button
            onClick={() => signIn("google")}
            className="hover:text-white transition-colors"
          >
            Log in
          </button>
          <button
            onClick={() => signIn("google")}
            className="px-5 py-2 bg-white text-black rounded-full hover:bg-gray-100 transition-colors font-semibold"
          >
            Get started
          </button>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center justify-center pt-20 px-4 text-center">
        <div className="relative flex justify-center items-center size-32 mb-4">
          <Image src="/assets/icon/logo-ai.png" fill alt="Logo" />
        </div>
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-colors cursor-pointer group">
          <span className="text-xs font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            New
          </span>
          <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
            Build apps instantly with AI &rarr;
          </span>
        </div>

        <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
          Build something <br />
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            extraordinary.
          </span>
        </h1>

        <p className="text-lg text-gray-400 mb-12 max-w-2xl font-light">
          Create production-ready full-stack applications by chatting.{" "}
          <br className="hidden md:block" />
          From idea to deployment in minutes.
        </p>

        {/* Input Card */}
        <div className="w-full max-w-3xl relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />

          <form
            onSubmit={handleSubmit}
            className="relative bg-[#121212] border border-white/10 rounded-2xl p-2 shadow-2xl overflow-hidden focus-within:border-white/20 transition-colors"
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setIsTyping(true)}
              onBlur={() => setIsTyping(false)}
              placeholder="Describe your dream app..."
              className="w-full bg-transparent text-lg placeholder:text-gray-600 text-gray-100 p-4 min-h-[120px] resize-none focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />

            <div className="flex items-center justify-between px-4 pb-2">
              <div className="flex gap-2">
                {/* <button
                  type="button"
                  className="p-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-all text-xs flex items-center gap-1"
                >
                  <span>📎</span>{" "}
                  <span className="hidden sm:inline">Attach</span>
                </button>
                <button
                  type="button"
                  className="p-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-all text-xs flex items-center gap-1"
                >
                  <span>🎨</span>{" "}
                  <span className="hidden sm:inline">Theme</span>
                </button> */}
              </div>

              <button
                type="submit"
                disabled={!prompt.trim()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  prompt.trim()
                    ? "bg-white text-black hover:bg-gray-200"
                    : "bg-white/10 text-gray-500 cursor-not-allowed"
                }`}
              >
                <span>Generate</span>
                <span>↵</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer Tags */}
        <div className="mt-12 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5">
            React
          </span>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5">
            Next.js
          </span>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5">
            Supabase
          </span>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5">
            Tailwind
          </span>
        </div>
      </div>
    </div>
  );
}
