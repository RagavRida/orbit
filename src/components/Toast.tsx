import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, AlertCircle, CheckCircle } from "lucide-react";

export interface ToastMessage {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl backdrop-blur-xl border shadow-2xl text-sm font-medium max-w-md ${
              toast.type === "error"
                ? "bg-red-500/20 border-red-500/30 text-red-200"
                : toast.type === "success"
                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-200"
                : "bg-white/10 border-white/20 text-white/80"
            }`}
          >
            {toast.type === "error" ? (
              <AlertCircle size={18} className="flex-shrink-0" />
            ) : (
              <CheckCircle size={18} className="flex-shrink-0" />
            )}
            <span className="line-clamp-2">{toast.message}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-white/40 hover:text-white transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Hook for managing toasts
let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (message: string, type: "error" | "success" | "info" = "info") => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
}

export default Toast;
