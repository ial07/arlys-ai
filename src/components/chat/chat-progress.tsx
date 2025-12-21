'use client';

import { useEffect, useState } from 'react';

interface ChatProgressProps {
  isActive: boolean;
  currentStep?: number; // 1, 2, or 3
}

const STEPS = [
  { id: 1, label: 'Analyzing prompt', icon: '🔍' },
  { id: 2, label: 'Generating response', icon: '⚡' },
  { id: 3, label: 'Finalizing', icon: '✨' },
];

export function ChatProgress({ isActive, currentStep = 1 }: ChatProgressProps) {
  const [animatedStep, setAnimatedStep] = useState(1);

  useEffect(() => {
    if (!isActive) {
      setAnimatedStep(1);
      return;
    }

    // Auto-progress through steps for visual feedback
    const interval = setInterval(() => {
      setAnimatedStep((prev) => {
        if (prev >= 3) return 1;
        return prev + 1;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  const step = currentStep || animatedStep;

  return (
    <div className="flex items-center gap-6 p-4 bg-[#1a1a1a] rounded-xl border border-white/10 animate-fade-in">
      {STEPS.map((s, index) => (
        <div key={s.id} className="flex items-center gap-3">
          <div className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
            s.id < step ? 'bg-green-500/20 text-green-400' :
            s.id === step ? 'bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/50' :
            'bg-white/5 text-gray-500'
          }`}>
            {s.id < step ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <span className={s.id === step ? 'animate-bounce' : ''}>{s.icon}</span>
            )}
            {s.id === step && (
              <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
            )}
          </div>
          <div>
            <div className={`text-sm font-medium ${s.id === step ? 'text-white' : 'text-gray-500'}`}>
              {s.label}
            </div>
            {s.id === step && (
              <div className="text-xs text-blue-400 animate-pulse">In progress...</div>
            )}
          </div>
          {index < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 mx-2 ${s.id < step ? 'bg-green-500' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
