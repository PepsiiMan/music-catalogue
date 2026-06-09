import { motion, AnimatePresence } from "motion/react"

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", onConfirm, onCancel }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onCancel}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="bg-gray-800 rounded-xl p-6 max-w-sm w-full border border-gray-700 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-gray-400 mt-2">{message}</p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
