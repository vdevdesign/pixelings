import React from 'react';
import ReactDOM from 'react-dom/client';
import { PixelingsChat } from '../components/PixelingsChat';
import { StardustShop } from '../components/StardustShop';
import { MiniTrivia } from '../components/MiniTrivia';
import { RuneDuelMatch } from '../components/RuneDuelMatch';
import { supabase } from '../lib/supabaseClient';
import './styles.css';

function App() {
  const [computer, setComputer] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [isTeacher, setIsTeacher] = React.useState(false);
  const [userId, setUserId] = React.useState('');
  const [role, setRole] = React.useState('computer');
  const [approvedNickname, setApprovedNickname] = React.useState('');
  const [loginError, setLoginError] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'home' | 'chat'>('home');

  const handleLogin = async () => {
    setLoginError('');
    if (isTeacher) {
      setUserId(computer.toLowerCase());
      setLoggedIn(true);
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${computer.toLowerCase()}@pixelstechlab.local`, password,
    });
    if (error || !data.user) { setLoginError('That computer account or password was not recognized.'); return; }
    setUserId(data.user.id);
    const { data: profile } = await supabase.from('profiles').select('username, role, approved_nickname').eq('id', data.user.id).single();
    if (profile) { setComputer(profile.username); setRole(profile.role); setApprovedNickname(profile.approved_nickname || ''); }
    setLoggedIn(true);
  };

  if (!loggedIn) return <main className="app-shell login-shell">
    <section className="login-card">
      <div className="eyebrow"><span className="eyebrow-dot" /> PIXELS TECH LAB</div>
      <h1 className="login-title">Pixelings <em>Chat</em></h1>
      <p className="hero-copy">Sign in with the account for this computer to join the room.</p>
      <label className="login-label" htmlFor="computer">Computer account</label>
      <select id="computer" value={computer} onChange={(e) => setComputer(e.target.value)} className="login-input">
        <option value="">Select a computer</option>{Array.from({ length: 20 }, (_, i) => <option key={i} value={`Pixels${i + 1}`}>Pixels{i + 1}</option>)}
      </select>
      <input className="login-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label className="teacher-check"><input type="checkbox" checked={isTeacher} onChange={(e) => setIsTeacher(e.target.checked)} /> Teacher / moderator preview</label>
      {loginError && <p className="login-error">{loginError}</p>}
      <button className="login-button" disabled={!computer || (!isTeacher && !password)} onClick={handleLogin}>{isTeacher ? 'Open preview' : 'Sign in'}</button>
      <small className="login-help">Accounts and passwords are managed by your teacher.</small>
    </section>
  </main>;

  return (
    <main className="app-shell">
      <nav className="site-nav" aria-label="Primary navigation">
        <button className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>Home</button>
        <button className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Chat</button>
        <span className="nav-account">{approvedNickname || computer}</span>
      </nav>
      {activeTab === 'home' ? <>
      <section className="hero home-hero">
        <div className="eyebrow"><span className="eyebrow-dot" /> PIXELS TECH LAB / COMMUNITY LOUNGE</div>
        <h1>Welcome <em>Pixelings!</em></h1>
        <p className="hero-copy">A cozy little corner to chat, play, and spend your Stardust.</p>
      </section>
      <section className="home-grid">
        <article className="welcome-card feature-card">
          <div className="card-kicker">TODAY IN THE LOUNGE</div>
          <h2>Make something <em>sparkle.</em></h2>
          <p>Drop into chat, try a minigame, or show off your collection in the Stardust Shop.</p>
          <button className="primary-action" onClick={() => setActiveTab('chat')}>Open the chat →</button>
        </article>
        <MiniGames />
      </section>
      <RuneDuelMatch />
      <MiniTrivia userId={userId} demoMode={isTeacher} />
      <StardustShop userId={userId} demoMode={isTeacher} />
      </> : <>
      <section className="hero chat-hero">
        <div className="eyebrow"><span className="eyebrow-dot" /> PIXELS TECH LAB / COMMUNITY LOUNGE</div>
        <h1>Pixelings <em>Chat</em></h1>
        <p className="hero-copy">A cozy, real-time chat for the people making and playing together.</p>
      </section>
      <PixelingsChat sessionId="demo-session" currentUserId={userId} currentUsername={approvedNickname || computer} isAdmin={isTeacher || role !== 'computer'} isModerator={isTeacher || role !== 'computer'} demoMode={isTeacher} />
      <p className="demo-note">Preview mode · moderation is required for flagged messages</p>
      </>}
    </main>
  );
}

function MiniGames() {
  const [score, setScore] = React.useState(0);
  const [message, setMessage] = React.useState('Pick a game to play');
  const playCoin = () => { setScore((value) => value + 10); setMessage('You found a Stardust coin! +10'); };
  const playLucky = () => { const win = Math.random() > .35; setScore((value) => value + (win ? 25 : 0)); setMessage(win ? 'Lucky constellation! +25' : 'The stars say: try again.'); };
  return <article className="games-card feature-card"><div className="card-kicker">ARCADE CABINET</div><div className="games-heading"><h2>Mini <em>games</em></h2><span className="score-pill">✦ {score}</span></div><p>{message}</p><div className="game-buttons"><button onClick={playCoin}>Catch the coin <span>+10</span></button><button onClick={playLucky}>Lucky stars <span>+25</span></button></div></article>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
