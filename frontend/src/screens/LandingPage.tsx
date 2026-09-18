const BOT_URL = 'https://t.me/bezborhivbot'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8 text-center">
        <div className="text-7xl mb-6">💳</div>

        <h1 className="text-4xl font-bold text-text-primary mb-3 leading-tight">
          БезБоргів
        </h1>
        <p className="text-lg text-text-secondary mb-10 max-w-xs leading-relaxed">
          Відстежуй кредити, плануй погашення і закривай борги швидше
        </p>

        <a
          href={BOT_URL}
          className="inline-flex items-center gap-3 bg-sage text-white
                     text-lg font-semibold px-8 py-4 rounded-button shadow-card
                     active:scale-95 transition-transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.367l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.958.192z"/>
          </svg>
          Відкрити в Telegram
        </a>

        <p className="text-sm text-text-secondary mt-4">
          Безкоштовно · Тільки в Telegram
        </p>
      </div>

      {/* Features */}
      <div className="px-6 pb-12">
        <div className="bg-white rounded-card shadow-card p-6 flex flex-col gap-5 max-w-sm mx-auto">
          {[
            { icon: '📊', title: 'Всі кредити в одному місці', desc: 'Іпотека, авто, розстрочки — один список' },
            { icon: '🎯', title: 'Стратегія погашення', desc: 'Лавина або Сніжний ком — закрий борги раніше' },
            { icon: '📅', title: 'Календар платежів', desc: 'Наочно бачиш коли і скільки платити' },
            { icon: '🔔', title: 'Нагадування', desc: 'Бот нагадає за 3 дні, 1 день і в день платежу' },
          ].map(f => (
            <div key={f.title} className="flex items-start gap-4">
              <span className="text-2xl flex-none">{f.icon}</span>
              <div>
                <p className="font-semibold text-text-primary text-sm">{f.title}</p>
                <p className="text-text-secondary text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-8">
        <a href={BOT_URL} className="text-sage font-medium text-sm">
          @bezborhivbot
        </a>
      </div>
    </div>
  )
}
