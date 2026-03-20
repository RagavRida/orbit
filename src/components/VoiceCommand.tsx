import React, { useState, useEffect, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VoiceCommandProps {
  onCommand: (command: string) => void;
}

const VoiceCommand: React.FC<VoiceCommandProps> = ({ onCommand }) => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onresult = (event: any) => {
        const command = event.results[0][0].transcript.toLowerCase();
        onCommand(command);
        setIsListening(false);
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, [onCommand]);

  const toggleListening = useCallback(() => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
      setIsListening(true);
    }
  }, [isListening, recognition]);

  return (
    <div className="fixed top-8 right-8 z-50">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleListening}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-xl ${
          isListening ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        {isListening ? <MicOff size={24} /> : <Mic size={24} />}
      </motion.button>
      
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-16 right-0 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-3 text-xs text-white/80 whitespace-nowrap"
          >
            "Show AI startups", "Zoom to India"...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceCommand;
