export function RecordPlaceholder() {
  return (
    <div className="w-32 h-32 rounded-lg bg-gray-700 flex-shrink-0 flex items-center justify-center">
      <svg viewBox="0 0 120 120" className="w-20 h-20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="56" fill="#1f1f1f" stroke="#4b5563" strokeWidth="2"/>
        <circle cx="60" cy="60" r="40" fill="none" stroke="#4b5563" strokeWidth="0.5" opacity="0.5"/>
        <circle cx="60" cy="60" r="28" fill="none" stroke="#4b5563" strokeWidth="0.5" opacity="0.5"/>
        <circle cx="60" cy="60" r="16" fill="#111827"/>
        <circle cx="60" cy="60" r="4" fill="#6b7280"/>
      </svg>
    </div>
  )
}
