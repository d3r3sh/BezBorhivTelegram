import { useEffect, useState } from 'react'
import WebApp from '@twa-dev/sdk'
import { loansApi } from '../api/loans'
import { formatAmount, formatDate } from '../utils/format'
import { useBackButton } from '../hooks/useTelegram'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { Loan } from '../api/types'

interface Props {
  onBack: () => void
  onLoanClick: (loanId: string) => void
}

export function ArchiveScreen({ onBack, onLoanClick }: Props) {
  useBackButton(onBack)

  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)

  const reload = async () => {
    try {
      const list = await loansApi.archived()
      setLoans(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  const handleUnarchive = (loan: Loan) => {
    WebApp.showConfirm(`Відновити кредит «${loan.name}»?`, async (ok) => {
      if (!ok) return
      await loansApi.unarchive(loan.id)
      reload()
    })
  }

  const handleDelete = (loan: Loan) => {
    WebApp.showConfirm(`Видалити кредит «${loan.name}» назавжди?`, async (ok) => {
      if (!ok) return
      await loansApi.delete(loan.id)
      reload()
    })
  }

  if (loading) return <LoadingSpinner className="h-screen" />

  return (
    <div className="min-h-screen pb-8" style={{ background: 'var(--bg)', paddingTop: 'max(60px, env(safe-area-inset-top, 0px) + 16px)' }}>

      {/* ── Header ── */}
      <div className="px-5 pb-4">
        <h1 className="font-serif font-semibold text-[30px] leading-none" style={{ color: 'var(--text-primary)' }}>
          Архів
        </h1>
      </div>

      <div className="px-5 flex flex-col gap-3">

        {/* Empty state */}
        {loans.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <div
              className="w-[110px] h-[110px] rounded-icon flex items-center justify-center"
              style={{ boxShadow: '8px 8px 14px rgba(199,195,186,0.75), -8px -8px 14px rgba(253,251,246,1.0)', background: 'var(--bg)' }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.3" strokeLinecap="round">
                <rect x="2" y="4" width="20" height="5" rx="1"/>
                <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/>
                <path d="M10 13h4"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="font-serif font-semibold text-[24px] mb-2" style={{ color: 'var(--text-primary)' }}>
                Архів порожній
              </p>
              <p className="text-[15px] max-w-[260px]" style={{ color: 'var(--text-secondary)' }}>
                Закриті кредити з'являться тут
              </p>
            </div>
          </div>
        )}

        {/* Archive rows */}
        {loans.map(loan => (
          <div key={loan.id} className="neu-raised rounded-card p-5">
            <div className="flex items-start gap-3">
              {/* Check icon */}
              <div
                className="w-10 h-10 rounded-icon flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--sage)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <button className="flex-1 text-left" onClick={() => onLoanClick(loan.id)}>
                <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{loan.name}</p>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {loan.archived_at
                    ? `Закрито ${formatDate(loan.archived_at.slice(0, 10))}`
                    : 'Архівовано'}
                </p>
              </button>

              <p className="text-[14px] font-semibold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                {formatAmount(loan.initial_amount)}
              </p>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleUnarchive(loan)}
                className="flex-1 text-[13px] font-semibold rounded-button py-2.5 active:opacity-70"
                style={{ color: 'var(--sage)', border: '1.5px solid rgba(92,138,107,0.4)' }}
              >
                Відновити
              </button>
              <button
                onClick={() => handleDelete(loan)}
                className="flex-1 text-[13px] font-semibold rounded-button py-2.5 active:opacity-70"
                style={{ color: 'var(--terracotta)', border: '1.5px solid rgba(196,100,74,0.4)' }}
              >
                Видалити
              </button>
            </div>
          </div>
        ))}

      </div>
    </div>
  )
}
