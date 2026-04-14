'use client';

import { useEffect, useState } from 'react';

export type CompatibilityStatus = 'checking' | 'supported' | 'partial' | 'unsupported';

export function useBrowserCompatibility(): CompatibilityStatus {
  const [status, setStatus] = useState<CompatibilityStatus>('checking');
  
  useEffect(() => {
    const hasSpeechRecognition = 
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    const hasMediaDevices = 
      !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;
    const hasAudioContext = 
      'AudioContext' in window || 'webkitAudioContext' in window;
    
    if (hasSpeechRecognition && hasMediaDevices && hasAudioContext) {
      setStatus('supported');
    } else if (hasMediaDevices && hasAudioContext) {
      // Can record audio but no STT — we can fall back to Whisper only
      setStatus('partial');
    } else {
      setStatus('unsupported');
    }
  }, []);
  
  return status;
}
