"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

interface TosModalProps {
  isOpen: boolean;
  onAccept: () => void;
  isAccepting: boolean;
}

export function TosModal({ isOpen, onAccept, isAccepting }: TosModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            Terms of Service
          </h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Welcome to Arlys AI. Before you start generating amazing
            applications, please accept our Terms of Service.
            <br />
            <br />
            By continuing, you agree to:
            <ul className="list-disc text-left mt-2 pl-4 space-y-1">
              <li>Use the generated code responsibly</li>
              <li>Not generate harmful or malicious content</li>
              <li>Respect intellectual property rights</li>
            </ul>
          </p>

          <button
            onClick={onAccept}
            disabled={isAccepting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isAccepting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Accepting...
              </>
            ) : (
              "I Accept the Terms"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
