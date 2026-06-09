import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"

interface Toast {
  id: number
  message: string
  variant: "success" | "error" | "info"
}

interface ToastContextValue {
  toast: (message: string, variant?: "success" | "error" | "info") => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, variant: "success" | "error" | "info" = "info") => {
    setToasts(prev => [...prev, { id: Date.now(), message, variant }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDone={() => removeToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

const variantStyles: Record<string, string> = {
  success: "bg-green-800 border-green-500",
  error: "bg-red-800 border-red-500",
  info: "bg-gray-800 border-gray-500",
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  })

  useEffect(() => {
    const timer = setTimeout(() => onDoneRef.current(), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`px-4 py-3 rounded-lg border text-white shadow-lg pointer-events-auto ${variantStyles[toast.variant]} min-w-[200px]`}
    >
      {toast.message}
    </motion.div>
  )
}
