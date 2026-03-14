import { getCardDisplay, getCardLabel } from '../utils/gameUi'

const SUIT_COLORS = {
  Hearts: 'text-red-700',
  Diamonds: 'text-red-700',
  Clubs: 'text-slate-900',
  Spades: 'text-slate-900',
  Joker: 'text-amber-500',
}

export function CardAsset({
  card,
  className = '',
  showCornerSuit = true,
  showCenterSymbol = true,
  centerSymbolClassName = 'text-[124%] leading-none sm:text-[152%]',
  jokerTextClassName = 'text-[32%] font-bold tracking-[0.1em]',
}) {
  const label = getCardLabel(card)
  const display = getCardDisplay(card)
  const suitColorClass = SUIT_COLORS[card?.suit] ?? 'text-slate-900'

  return (
    <div
      aria-label={label}
      role="img"
      className={`relative h-full w-full overflow-hidden rounded-[10%] border-2 border-slate-800 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.28)] ${className}`}
    >
      <div className={`absolute left-[10%] top-[8%] flex flex-col leading-none ${suitColorClass}`}>
        <span className="text-[1.35rem] font-bold leading-none tracking-tight sm:text-[1.25rem]">{display.rank}</span>
        {showCornerSuit ? (
          <span className="mt-[0.2rem] text-[1rem] leading-none sm:mt-[0.35rem] sm:text-[0.825rem]">{display.suit}</span>
        ) : null}
      </div>
      <div className={`absolute bottom-[8%] right-[10%] flex rotate-180 flex-col leading-none ${suitColorClass}`}>
        <span className="text-[1.35rem] font-bold leading-none tracking-tight sm:text-[1.25rem]">{display.rank}</span>
        {showCornerSuit ? (
          <span className="mt-[0.2rem] text-[1rem] leading-none sm:mt-[0.35rem] sm:text-[0.825rem]">{display.suit}</span>
        ) : null}
      </div>
      <div className={`absolute inset-0 flex flex-col items-center justify-center ${suitColorClass}`}>
        {display.accent ? <span className={`mb-[4%] ${jokerTextClassName}`}>{display.accent}</span> : null}
        {showCenterSymbol ? <span className={centerSymbolClassName}>{display.center}</span> : null}
        {display.accent ? <span className={`mt-[2%] ${jokerTextClassName}`}>JOKER</span> : null}
      </div>
    </div>
  )
}

export function CardBack({ className = '' }) {
  return (
    <div
      aria-label="Face-down deck"
      role="img"
      className={`relative h-full w-full overflow-hidden rounded-[10%] border-2 border-slate-800 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.28)] ${className}`}
    >
      <div
        className="absolute inset-[7%] rounded-[8%] border-2 border-white bg-red-800"
        style={{
          backgroundColor: '#b91c1c',
          backgroundImage:
            'linear-gradient(45deg, rgba(255,255,255,0.25) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.25) 75%), linear-gradient(45deg, rgba(255,255,255,0.25) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.25) 75%)',
          backgroundPosition: '0 0, 10px 10px',
          backgroundSize: '20px 20px',
        }}
      >
        <div className="absolute inset-[6%] rounded-[6%] border border-red-100/90" />
      </div>
    </div>
  )
}
