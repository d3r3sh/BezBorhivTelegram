import { useEffect, useState } from 'react'
import WebApp from '@twa-dev/sdk'
import { loansApi } from '../api/loans'
import { formatDate } from '../utils/format'
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
    WebApp.showConfirm(
      `Відновити кредит «${loan.name}»?`,
      async (ok) => {
        if (!ok) return
        await loansApi.unarchive(loan.id)
        reload()
      }
    )
  }

  const handleDelete = (loan: Loan) => {
    WebApp.showConfirm(
      `Видалити кредит «${loan.name}» назавжди?`,
      async (ok) => {
        if (!ok) return
        await loansApi.delete(loan.id)
        reload()
      }
    )
  }

  if (loading) return <LoadingSpinner className="h-screen" />

  return (
    <div className="min-h-screen bg-cream safe-top safe-bottom pb-6">
      <div className="bg-white shadow-card-sm px-4 pt-4 pb-4">
        <h1 className="text-xl font-bold text-text-primary">Архів</h1>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-3">
        {loans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl">📦</span>
            <p className="text-text-secondary text-center">
              Архів порожній.<br />Закриті кредити з'являться тут.
            </p>
          </div>
        ) : (
          loans.map(loan => (
            <div
              key={loan.id}
              className="bg-white rounded-card shadow-card-sm p-4"
            >
              {/* Loan info */}
              <button
                className="w-full text-left"
                onClick={() => onLoanClick(loan.id)}
              >
                <p className="font-semibold text-text-primary">{loan.name}</p>
                <p className="text-sm text-text-secondary mt-0.5">
                  {loan.archived_at
                    ? `Закрито ${formatDate(loan.archived_at.slice(0, 10))}`
                    : 'Архівовано'}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Внесено: {loan.payments_made} платежів
                </p>
              </button>

              {/* Actions */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleUnarchive(loan)}
                  className="flex-1 text-sm text-sage border border-sage/40 rounded-button py-2 font-medium"
                >
                  Відновити
                </button>
                <button
                  onClick={() => handleDelete(loan)}
                  className="flex-1 text-sm text-terracotta border border-terracotta/40 rounded-button py-2 font-medium"
                >
                  Видалити
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
