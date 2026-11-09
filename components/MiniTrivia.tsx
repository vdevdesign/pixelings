import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TRIVIA_QUESTIONS, TRIVIA_CATEGORIES, type TriviaQuestion, type TriviaCategory } from './triviaLibrary';

const QUESTIONS_PER_QUIZ = 3;
const SECONDS_PER_QUESTION = 20;

const CATEGORY_LABELS: Record<TriviaCategory, string> = {
  'Blender': '🧊 Blender',
  'Tinkercad': '🧱 Tinkercad',
  'E-Sports': '🎮 E-Sports',
  'Minecraft Commands': '⛏️ Minecraft Commands',
  'Roblox': '🟥 Roblox Game Design',
  'Animation': '🎨 Game Art & Animation',
  'Safety': '🛡️ Online Safety',
};


function pickQuestions(category: TriviaCategory | 'all') {
  const pool = category === 'all' ? TRIVIA_QUESTIONS : TRIVIA_QUESTIONS.filter((item) => item.category === category);
  return [...pool].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_QUIZ);
}

export function MiniTrivia({ userId, demoMode = false, onBalanceChange }: { userId: string; demoMode?: boolean; onBalanceChange?: (balance: number) => void }) {
  const [category, setCategory] = useState<TriviaCategory | 'all'>('all');
  const [questions, setQuestions] = React.useState<TriviaQuestion[]>([]);
  const [started, setStarted] = React.useState(false);
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [timeLeft, setTimeLeft] = React.useState(SECONDS_PER_QUESTION);
  const [earned, setEarned] = React.useState(0);
  const [status, setStatus] = React.useState('Choose an answer before the stars run out.');
  const [finished, setFinished] = React.useState(false);
  const [rewardDismissed, setRewardDismissed] = React.useState(false);

  const question = questions[questionIndex];

  const award = React.useCallback(async (reward: number) => {
    if (demoMode || !userId) return;
    // Server clamps each answer and enforces the 500/day cap for this game.
    const { data, error } = await supabase.rpc('award_game_stardust', { game: 'trivia', requested: reward });
    if (error) {
      setStatus('Correct! Your reward could not be saved. Please tell your teacher.');
      return;
    }
    const result = Array.isArray(data) ? data[0] : data as { granted: number; daily_total: number; cap: number };
    if (result && Number(result.granted) === 0) setStatus(`Correct! Daily limit reached for trivia — keep playing for fun!`);
  }, [demoMode, userId, onBalanceChange]);

  const answer = useCallback((index: number | null) => {
    if (selectedIndex !== null || finished) return;
    const isCorrect = index !== null && index === question.correctIndex;
    setSelectedIndex(index);
    if (isCorrect) {
      setEarned((value) => value + 50);
      setStatus('Correct! +50 Stardust');
      void award(50);
    } else {
      setStatus(index === null ? `Time's up! The answer was ${question.options[question.correctIndex]}.` : `Not quite — the answer was ${question.options[question.correctIndex]}.`);
    }
  }, [award, finished, question, selectedIndex]);

  useEffect(() => {
    if (!started || selectedIndex !== null || finished) return;
    const timer = window.setInterval(() => setTimeLeft((value) => {
      if (value <= 1) { window.clearInterval(timer); answer(null); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [answer, finished, selectedIndex, questionIndex, started]);

  const startQuiz = () => {
    setQuestions(pickQuestions(category)); setQuestionIndex(0); setSelectedIndex(null); setTimeLeft(SECONDS_PER_QUESTION); setEarned(0); setFinished(false); setRewardDismissed(false); setStarted(true); setStatus('Choose an answer before the stars run out.');
  };

  const exitQuiz = () => {
    setStarted(false); setFinished(false); setQuestionIndex(0); setSelectedIndex(null); setQuestions([]); setStatus('Choose an answer before the stars run out.');
  };

  const next = () => {
    if (questionIndex === questions.length - 1) {
      setFinished(true);
      setStatus(`Quiz complete! You earned ${earned} Stardust.`);
      window.setTimeout(() => setRewardDismissed(true), 8000);
      return;
    }
    setQuestionIndex((value) => value + 1); setSelectedIndex(null); setTimeLeft(SECONDS_PER_QUESTION); setStatus('Choose an answer before the stars run out.');
  };

  const restart = () => startQuiz();

  return <article className="trivia-card">
    {finished && !rewardDismissed && <div className="stardust-reward-pop reward-inline" role="status">
      <span className="reward-star">✦</span>
      <div><strong>Quiz complete!</strong><span>You earned <b>{earned}</b> Stardust.</span></div>
      <button className="reward-close" onClick={() => setRewardDismissed(true)} aria-label="Dismiss">✕</button>
    </div>}
    <div className="trivia-heading"><h2>Stardust <em>Trivia</em></h2>
      {started && !finished && <button className="trivia-exit" onClick={exitQuiz} aria-label="Exit trivia">✕ Exit game</button>}
      <span className="trivia-progress">{finished ? 'DONE' : started ? `${questionIndex + 1} / ${questions.length}` : 'READY'}</span>
    </div>
    {!started ? <div className="trivia-complete">
      <p>Test your skills across the lab's classes and collect Stardust.</p>
      <div className="trivia-category-picker">
        <span className="trivia-picker-label">Pick a class category:</span>
        <div className="trivia-category-options">
          <button className={`trivia-category ${category === 'all' ? 'selected' : ''}`} onClick={() => setCategory('all')}>🎲 Mixed (all classes)</button>
          {TRIVIA_CATEGORIES.map((item) => (
            <button key={item} className={`trivia-category ${category === item ? 'selected' : ''}`} onClick={() => setCategory(item)}>{CATEGORY_LABELS[item]}</button>
          ))}
        </div>
      </div>
      <button className="primary-action trivia-start-button" onClick={startQuiz}>Play trivia</button>
    </div> : finished ? <div className="trivia-complete"><p>{status}</p>
      <div className="trivia-complete-actions">
        <button className="primary-action" onClick={startQuiz}>Play again</button>
        <button className="trivia-exit" onClick={exitQuiz}>Choose another class</button>
      </div>
    </div> : <>
      <div className="trivia-meta"><span>{question.category}</span><strong>00:{String(timeLeft).padStart(2, '0')}</strong></div>
      <p className="trivia-question">{question.question}</p>
      <div className="trivia-options">{question.options.map((option, index) => {
        const correct = index === question.correctIndex;
        const chosen = index === selectedIndex;
        return <button key={option} className={`trivia-option ${selectedIndex !== null && correct ? 'correct' : ''} ${chosen && !correct ? 'wrong' : ''}`} disabled={selectedIndex !== null} onClick={() => answer(index)}>{option}</button>;
      })}</div>
      <div className="trivia-footer"><span className="trivia-status">{status}</span>{selectedIndex !== null && <button className="trivia-next" onClick={next}>{questionIndex === questions.length - 1 ? 'Finish' : 'Next'}</button>}</div>
    </>}
  </article>;
}
