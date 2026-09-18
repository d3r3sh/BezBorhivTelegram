interface Tab {
  value: string
  label: string
}

interface Props {
  tabs: Tab[]
  value: string
  onChange: (value: string) => void
}

export function SegmentControl({ tabs, value, onChange }: Props) {
  return (
    <div className="segment-control">
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`segment-tab ${value === tab.value ? 'segment-tab-active' : 'segment-tab-inactive'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
