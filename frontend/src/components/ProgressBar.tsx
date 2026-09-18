interface Props {
  percent: number
  overdue?: boolean
}

export function ProgressBar({ percent, overdue = false }: Props) {
  const clamped = Math.min(100, Math.max(0, percent))
  return (
    <div className="progress-track">
      <div
        className={`progress-fill ${overdue ? 'progress-fill-overdue' : ''}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
