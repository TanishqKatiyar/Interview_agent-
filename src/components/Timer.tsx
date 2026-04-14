'use client';

import { useState, useEffect } from 'react';

interface TimerProps {
  startTime: Date;
}

export default function Timer({ startTime }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <span
      className="font-mono text-sm tabular-nums"
      style={{ color: '#888' }}
    >
      {display}
    </span>
  );
}
