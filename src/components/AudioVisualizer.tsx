'use client';

import React from 'react';

type MicState = 'AI_SPEAKING' | 'RECORDING' | 'PROCESSING' | 'READY_BUT_SILENT';

export default function AudioVisualizer({ audioLevel, micState }: { audioLevel: number; micState: MicState }) {
  let colorClass = 'bg-ink-soft';
  let pulseClass = 'animate-pulse opacity-60';

  if (micState === 'AI_SPEAKING') {
    colorClass = 'bg-tangerine';
    pulseClass = 'animate-pulse opacity-95';
  } else if (micState === 'RECORDING' || micState === 'READY_BUT_SILENT') {
    colorClass = 'bg-accent';
    pulseClass = 'animate-none opacity-100';
  } else if (micState === 'PROCESSING') {
    colorClass = 'bg-sunshine';
    pulseClass = 'animate-pulse opacity-90';
  }

  const scale = 1 + audioLevel * 0.5;

  return (
    <div className="flex flex-col items-center justify-center h-40 sm:h-56 mb-4 transition-all">
      <div
        className={`w-20 h-20 sm:w-[120px] sm:h-[120px] rounded-full ${colorClass} ${pulseClass} flex items-center justify-center transition-transform duration-75 relative`}
        style={{ transform: `scale(${scale})` }}
      >
        <div className="w-full h-full rounded-full border-[3px] border-paper/25 absolute" />
      </div>
    </div>
  );
}
