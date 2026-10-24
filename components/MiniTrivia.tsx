import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface TriviaQuestion {
  id: number;
  category: 'Blender' | 'Tinkercad' | 'Animation' | 'Roblox' | 'Safety';
  question: string;
  options: string[];
  correctIndex: number;
  stardustReward: number;
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  { id: 1, category: 'Blender', question: 'In Blender, which shortcut key is used to extrude selected mesh geometry?', options: ['G', 'S', 'E', 'R'], correctIndex: 2, stardustReward: 50 },
  { id: 2, category: 'Blender', question: 'Which key opens the Move / Translation tool directly on an object?', options: ['G', 'Tab', 'X', 'I'], correctIndex: 0, stardustReward: 50 },
  { id: 3, category: 'Tinkercad', question: 'In Tinkercad, what tool combines two separate shapes into a single solid unit?', options: ['Hole', 'Group', 'Align', 'Duplicate'], correctIndex: 1, stardustReward: 50 },
  { id: 4, category: 'Tinkercad', question: 'What shape property turns a solid object into a cutting tool?', options: ['Transparent', 'Hole', 'Symmetric', 'Ghost'], correctIndex: 1, stardustReward: 50 },
  { id: 5, category: 'Animation', question: 'Which animation principle exaggerates weight and flexibility?', options: ['Anticipation', 'Squash and Stretch', 'Staging', 'Arcs'], correctIndex: 1, stardustReward: 75 },
  { id: 6, category: 'Animation', question: 'Preparing the audience for a major action is called what?', options: ['Follow Through', 'Exaggeration', 'Anticipation', 'Straight Ahead'], correctIndex: 2, stardustReward: 75 },
  { id: 7, category: 'Roblox', question: 'What is the primary programming language used for scripting in Roblox Studio?', options: ['Python', 'C++', 'JavaScript', 'Luau (Lua)'], correctIndex: 3, stardustReward: 50 },
  { id: 8, category: 'Roblox', question: 'Which Roblox Studio tool keeps parts in place against physics?', options: ['Anchor', 'Group', 'Lock-Key', 'Weld'], correctIndex: 0, stardustReward: 50 },
  { id: 9, category: 'Safety', question: 'Which is sensitive Personally Identifiable Information you should never share online?', options: ['Your favorite color', 'Your home address', 'Your favorite game', 'Your avatar name'], correctIndex: 1, stardustReward: 100 },
  { id: 10, category: 'Safety', question: 'What makes a password strong and secure?', options: ['Your birthdate and pet name', 'Common words backward', 'A mix of upper/lowercase letters, numbers, and symbols', 'Keeping it short'], correctIndex: 2, stardustReward: 100 },
];

const QUESTIONS_PER_QUIZ = 3;
const SECONDS_PER_QUESTION = 20;

function pickQuestions() {
  return [...TRIVIA_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_QUIZ);
}

export function MiniTrivia({ userId, demoMode = false }: { userId: string; demoMode?: boolean }) {
  const [questions, setQuestions] = React.useState<TriviaQuestion[]>([]);
  const [started, setStarted] = React.useState(false);
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [timeLeft, setTimeLeft] = React.useState(SECONDS_PER_QUESTION);
  const [earned, setEarned] = React.useState(0);
  const [status, setStatus] = React.useState('Choose an answer before the stars run out.');
  const [finished, setFinished] = React.useState(false);

  const question = questions[questionIndex];

  const award = React.useCallback(async (reward: number) => {
    if (demoMode || !userId) return;
    const { error } = await supabase.rpc('award_trivia_stardust', { reward_amount: reward });
    if (error) setStatus('Correct! Your reward could not be saved. Please tell your teacher.');
  }, [demoMode, userId]);

  const answer = useCallback((index: number | null) => {
    if (selectedIndex !== null || finished) return;
    const isCorrect = index !== null && index === question.correctIndex;
    setSelectedIndex(index);
    if (isCorrect) {
      setEarned((value) => value + question.stardustReward);
      setStatus(`Correct! +${question.stardustReward} Stardust`);
      void award(question.stardustReward);
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
    setQuestions(pickQuestions()); setQuestionIndex(0); setSelectedIndex(null); setTimeLeft(SECONDS_PER_QUESTION); setEarned(0); setFinished(false); setStarted(true); setStatus('Choose an answer before the stars run out.');
  };

  const next = () => {
    if (questionIndex === questions.length - 1) { setFinished(true); setStatus(`Quiz complete! You earned ${earned} Stardust.`); return; }
    setQuestionIndex((value) => value + 1); setSelectedIndex(null); setTimeLeft(SECONDS_PER_QUESTION); setStatus('Choose an answer before the stars run out.');
  };

  const restart = () => startQuiz();

  return <article className="trivia-card feature-card">
    <div className="card-kicker">STARDUST CHALLENGE</div>
    <div className="trivia-heading"><h2>Mini <em>trivia</em></h2><span className="trivia-progress">{finished ? 'DONE' : started ? `${questionIndex + 1} / ${questions.length}` : 'READY'}</span></div>
    {!started ? <div className="trivia-complete"><p>Test your skills across Blender, Tinkercad, animation, Roblox, and online safety.</p><button className="primary-action" onClick={startQuiz}>Start trivia</button></div> : finished ? <div className="trivia-complete"><p>{status}</p><button className="primary-action" onClick={restart}>Play again</button></div> : <>
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
