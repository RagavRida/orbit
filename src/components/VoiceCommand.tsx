import React, { useState, useCallback, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VoiceCommandProps {
  onCommand: (command: string) => void;
}

const VoiceCommand: React.FC<VoiceCommandProps> = ({ onCommand }) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setTranscript(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop the mic stream
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (audioBlob.size < 1000) {
          // Too short, skip
          setIsProcessing(false);
          return;
        }

        setIsProcessing(true);

        try {
          // Send raw audio to server-side STT proxy
          const arrayBuffer = await audioBlob.arrayBuffer();
          const response = await fetch("/api/stt", {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: arrayBuffer,
          });

          if (!response.ok) throw new Error(`STT error: ${response.status}`);

          const result = await response.json();
          const text = (result.transcript || "").trim().toLowerCase();

          if (text) {
            setTranscript(text);
            onCommand(text);
            // Clear transcript after 3 seconds
            setTimeout(() => setTranscript(null), 3000);
          }
        } catch (error) {
          console.error("STT Error:", error);
          // Fallback: try browser SpeechRecognition as backup
          setTranscript("⚠ Voice recognition failed");
          setTimeout(() => setTranscript(null), 2000);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsListening(true);

      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
          setIsListening(false);
        }
      }, 5000);
    } catch (error) {
      console.error("Microphone access error:", error);
      setIsListening(false);
    }
  }, [onCommand]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopRecording();
    } else if (!isProcessing) {
      startRecording();
    }
  }, [isListening, isProcessing, stopRecording, startRecording]);

  return (
    <div className="fixed top-8 right-8 z-50">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleListening}
        disabled={isProcessing}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-xl ${
          isProcessing
            ? "bg-amber-500/30 text-amber-300 cursor-wait"
            : isListening
            ? "bg-red-500 text-white animate-pulse"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        {isProcessing ? (
          <Loader2 size={24} className="animate-spin" />
        ) : isListening ? (
          <MicOff size={24} />
        ) : (
          <Mic size={24} />
        )}
      </motion.button>

      <AnimatePresence>
        {(isListening || isProcessing || transcript) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-16 right-0 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-3 text-xs text-white/80 whitespace-nowrap"
          >
            {isListening && (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Listening... say a command
              </span>
            )}
            {isProcessing && (
              <span className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                Transcribing with ElevenLabs...
              </span>
            )}
            {transcript && !isListening && !isProcessing && (
              <span className="text-emerald-400">"{transcript}"</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceCommand;
