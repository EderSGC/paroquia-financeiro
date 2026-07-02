import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    return () => { timersRef.current.forEach(t => clearTimeout(t)); };
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timersRef.current.delete(timer);
    }, 3500);
    timersRef.current.add(timer);
  }, []);

  const bgColor = (type: ToastType) => {
    if (type === "success") return "#34C759";
    if (type === "error")   return "#FF3B30";
    return "rgba(29, 29, 31, 0.92)";
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
        pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <div key={t.id} className="toast-item" style={{ background: bgColor(t.type) }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
