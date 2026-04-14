'use client';

import { useRef, useEffect, useState } from 'react';

type VisualizerMode = 'speaking' | 'listening' | 'idle';

interface VoiceVisualizerProps {
  /** Function that returns current audio level 0-1. */
  getAudioLevel: () => number;
  /** Controls color and behaviour. */
  mode: VisualizerMode;
}

// ─── Color Palette ──────────────────────────────────────────────────────────

const COLORS: Record<VisualizerMode, { core: string; glow: string }> = {
  speaking: { core: '#FF6600', glow: 'rgba(255, 102, 0, 0.35)' },
  listening: { core: '#4CAF50', glow: 'rgba(76, 175, 80, 0.35)' },
  idle: { core: '#555', glow: 'rgba(85, 85, 85, 0.2)' },
};

const BASE_RADIUS = 90;
const MAX_RADIUS = 160;

export default function VoiceVisualizer({ getAudioLevel, mode }: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const smoothLevel = useRef(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (!isMounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 360;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;

    let idlePulse = 0;

    const draw = () => {
      const raw = getAudioLevel();
      // Smooth the level for nice animation
      smoothLevel.current += (raw - smoothLevel.current) * 0.18;
      const level = smoothLevel.current;

      ctx.clearRect(0, 0, size, size);

      const { core, glow } = COLORS[mode];

      // Compute dynamic radius
      let radius: number;
      if (mode === 'idle') {
        idlePulse += 0.02;
        radius = BASE_RADIUS + Math.sin(idlePulse) * 6;
      } else {
        radius = BASE_RADIUS + (MAX_RADIUS - BASE_RADIUS) * level;
      }

      // Outer glow rings
      for (let i = 3; i >= 1; i--) {
        const r = radius + i * 12;
        const alpha = (0.08 - i * 0.02) * (mode === 'idle' ? 0.5 : 1);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle =
          mode === 'idle'
            ? `rgba(85, 85, 85, ${alpha})`
            : glow.replace(/[\d.]+\)$/, `${alpha})`);
        ctx.fill();
      }

      // Main circle gradient
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, core);
      grad.addColorStop(1, glow);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Inner bright circle
      const innerRadius = radius * 0.55;
      const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerRadius);
      innerGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
      innerGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
      ctx.fillStyle = innerGrad;
      ctx.fill();

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [isMounted, getAudioLevel, mode]);

  if (!isMounted) {
    return <div style={{ width: 360, height: 360 }} />;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: 360,
        height: 360,
        display: 'block',
        margin: '0 auto',
      }}
    />
  );
}
