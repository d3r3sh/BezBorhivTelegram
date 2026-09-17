interface Props {
  percent: number   // 0-100
  color?: string    // Tailwind bg class, default sage
}

export function ProgressBar({ percent, color = 'bg-sage' }: Props) {
  const clamped = Math.min(100, Math.max(0, percent))
  return (
    <div className="h-1.5 w-full rounded-full bg-sage-light overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
