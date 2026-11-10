import React, { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const ASSETS = {
  bg: '/assets/rune-duel-card-bg.png',
  sealed: '/assets/sealed.png',
  runes: {
    gale: '/assets/gale.png',
    flame: '/assets/flame.png',
    shadow: '/assets/shadow.png',
    stone: '/assets/stone.png',
  },
} as const;

type RuneType = keyof typeof ASSETS.runes;
type Card = { id: number; rune: RuneType; flipped: boolean; matched: boolean; clash: boolean };

const RUNES: RuneType[] = ['gale', 'flame', 'shadow', 'stone'];
const MATCHUPS: Record<RuneType, RuneType> = {
  gale: 'flame',
  flame: 'shadow',
  shadow: 'stone',
  stone: 'gale',
};
const RUNE_SYMBOLS: Record<RuneType, string> = { gale: '◌', flame: '✦', shadow: '◐', stone: '◆' };

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function makeDeck(): Card[] {
  return shuffle([...RUNES, ...RUNES, ...RUNES, ...RUNES]).map((rune, id) => ({
    id, rune, flipped: false, matched: false, clash: false,
  }));
}

export function RuneDuelMatch({ onBalanceChange }: { onBalanceChange?: (delta: number) => void }) {
  const [cards, setCards] = React.useState<Card[]>(makeDeck);
  const [selected, setSelected] = React.useState<number[]>([]);
  const [roundEarned, setRoundEarned] = React.useState(0);
  const [message, setMessage] = React.useState('Choose two runes to start matching!');
  const [busy, setBusy] = React.useState(false);
  const [showReward, setShowReward] = React.useState(false);

  React.useEffect(() => {
    if (cards.length > 0 && cards.every((card) => card.matched)) {
      setShowReward(true);
      const timer = window.setTimeout(() => setShowReward(false), 8000);
      return () => window.clearTimeout(timer);
    }
    setShowReward(false);
  }, [cards]);

  // Rewards are granted server-side with a 500/day cap for this game; the
  // header counter is gone — the HUD and wallet update via the RPC result.
  const award = React.useCallback(async (amount: number) => {
    setRoundEarned((value) => value + amount);
    const { data, error } = await supabase.rpc('award_game_stardust', { game: 'elemental', requested: amount });
    if (error) {
      setMessage('Could not save your reward. Please tell your teacher.');
      return;
    }
    const result = Array.isArray(data) ? data[0] : data as { granted: number; daily_total: number; cap: number };
    // Mirror the server-granted amount (cap-aware) into the header HUD.
    if (result && Number(result.granted) > 0) onBalanceChange?.(Number(result.granted));
    if (result && Number(result.granted) === 0) setMessage('Daily Stardust limit reached for this game — keep playing for fun!');
  }, [onBalanceChange]);

  const restart = () => {
    setCards(makeDeck());
    setSelected([]);
    setRoundEarned(0);
    setBusy(false);
    setShowReward(false);
    setMessage('Choose two runes to start matching!');
  };

  const choose = (id: number) => {
    if (busy || selected.length === 2) return;
    const card = cards.find((item) => item.id === id);
    if (!card || card.flipped || card.matched) return;

    const next = [...selected, id];
    setCards((current) => current.map((item) => item.id === id ? { ...item, flipped: true } : item));
    setSelected(next);
    if (next.length !== 2) return;

    const first = cards.find((item) => item.id === next[0])!;
    const second = card;
    const isPair = first.rune === second.rune;
    const winner = MATCHUPS[first.rune] === second.rune ? first : MATCHUPS[second.rune] === first.rune ? second : null;
    setBusy(true);

    window.setTimeout(() => {
      if (isPair) {
        setCards((current) => current.map((item) => next.includes(item.id) ? { ...item, matched: true } : item));
        void award(10);
        setMessage(`Perfect ${first.rune} pair! +10 Stardust.`);
      } else if (winner) {
        setCards((current) => current.map((item) => next.includes(item.id) ? { ...item, flipped: false, clash: true } : item));
        void award(10);
        setMessage(`${winner.rune.toUpperCase()} defeats its rival! +10 Stardust.`);
        window.setTimeout(() => setCards((current) => current.map((item) => ({ ...item, clash: false }))), 650);
      } else {
        setCards((current) => current.map((item) => next.includes(item.id) ? { ...item, flipped: false } : item));
        setMessage('Stalemate. The runes return to the shadows.');
      }
      setSelected([]);
      setBusy(false);
    }, isPair ? 650 : 900);
  };

  return <section className="rune-duel" style={{ backgroundImage: `url(${ASSETS.bg})` }}>
    <div className="rune-duel-header">
      <div><h2>Elemental <em>match</em></h2><p>Choose two runes to start matching!</p></div>

    </div>
    <div className="rune-grid" aria-label="Rune duel board">
      {cards.map((card) => <button key={card.id} className={`rune-card rune-${card.rune} ${card.flipped ? 'is-flipped' : ''} ${card.matched ? 'is-matched' : ''} ${card.clash ? 'is-clashing' : ''}`} onClick={() => choose(card.id)} disabled={card.matched || busy} aria-label={card.flipped ? `${card.rune} rune` : 'Sealed rune'}>
        <span className="rune-card-face rune-card-back"><img src={ASSETS.sealed} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><span>✦</span></span>
        <span className="rune-card-face rune-card-front"><img src={ASSETS.runes[card.rune]} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><span>{RUNE_SYMBOLS[card.rune]}</span><b>{card.rune}</b></span>
      </button>)}
    </div>
    <button className="rune-restart" onClick={restart}>Restart</button>
    {showReward && <div className="stardust-reward-pop" role="status">
      <span className="reward-star">✦</span>
      <div><strong>Round complete!</strong><span>You earned <b>{roundEarned}</b> Stardust this match.</span></div>
      <button className="reward-close" onClick={() => setShowReward(false)} aria-label="Dismiss">✕</button>
    </div>}
  </section>;
}
