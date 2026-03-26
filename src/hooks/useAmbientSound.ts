import { useState, useCallback, useRef, useEffect } from "react";

export function useAmbientSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const currentIndustryRef = useRef<string>("");

  const fadeVolume = useCallback((targetVolume: number, durationMs: number) => {
    if (!gainNodeRef.current || !audioCtxRef.current) return;
    const gain = gainNodeRef.current;
    const now = audioCtxRef.current.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(targetVolume, now + durationMs / 1000);
  }, []);

  const playAmbient = useCallback(async (industry: string) => {
    if (currentIndustryRef.current === industry && isPlaying) return;
    currentIndustryRef.current = industry;

    try {
      // Stop previous
      if (audioRef.current) {
        fadeVolume(0, 300);
        setTimeout(() => {
          audioRef.current?.pause();
          audioRef.current = null;
        }, 300);
      }

      const response = await fetch("/api/ambient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry }),
      });

      if (!response.ok) return;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.loop = true;

      // Web Audio API for volume control
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      audioCtxRef.current = ctx;
      gainNodeRef.current = gainNode;
      audioRef.current = audio;

      await audio.play();
      // Fade in to 15%
      gainNode.gain.linearRampToValueAtTime(
        0.15,
        ctx.currentTime + 0.5
      );
      setIsPlaying(true);

      audio.onended = () => {
        URL.revokeObjectURL(url);
      };
    } catch (e) {
      console.warn("Ambient sound failed:", e);
    }
  }, [isPlaying, fadeVolume]);

  const stopAmbient = useCallback(() => {
    if (!audioRef.current) return;
    fadeVolume(0, 500);
    setTimeout(() => {
      audioRef.current?.pause();
      audioRef.current = null;
      gainNodeRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      setIsPlaying(false);
      currentIndustryRef.current = "";
    }, 500);
  }, [fadeVolume]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioCtxRef.current?.close();
    };
  }, []);

  return { playAmbient, stopAmbient, isPlaying };
}
