import React from 'react';
import ReactDOM from 'react-dom/client';
import { PixelingsChat } from '../components/PixelingsChat';
import { StardustShop } from '../components/StardustShop';
import { InventoryPage } from '../components/InventoryPage';
import { MiniTrivia } from '../components/MiniTrivia';
import { RuneDuelMatch } from '../components/RuneDuelMatch';
import { MiniChat } from '../components/MiniChat';
import { PtlPosts } from '../components/PtlPosts';
import { ChatRoom } from '../components/chatRooms';
import { AccessCodeLogin } from '../components/AccessCodeLogin';
import { TeacherDashboard } from '../components/TeacherDashboard';
import { TeacherNotificationCenter } from '../components/TeacherNotificationCenter';
import { avatarItemById, profileItems } from '../components/avatarItems';
import { supabase } from '../lib/supabaseClient';
import './styles.css';
import './mobile.css';

const logoSrc = `${import.meta.env.BASE_URL}pixels-tech-lab-logo.png`;

function App() {
  const showInstantTest = import.meta.env.DEV && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const [loginType, setLoginType] = React.useState<'staff' | 'kid'>('kid');
  const [email, setEmail] = React.useState('');
  const [emailPassword, setEmailPassword] = React.useState('');
  const [kidEmailVerified, setKidEmailVerified] = React.useState(false);
  const [firstName, setFirstName] = React.useState('');
  const [accessCode, setAccessCode] = React.useState('');
  const [computer, setComputer] = React.useState('');
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [isTeacher, setIsTeacher] = React.useState(false);
  const [isInstantPreview, setIsInstantPreview] = React.useState(false);
  const [userId, setUserId] = React.useState('');
  // The authenticated Supabase account owns wallet/inventory data. Keep this
  // separate from userId, which is the selected child profile used by chat.
  const [authUserId, setAuthUserId] = React.useState('');
  const [role, setRole] = React.useState('computer');
  const [approvedNickname, setApprovedNickname] = React.useState('');
  const [profileAvatarId, setProfileAvatarId] = React.useState('');
  const [profileBackgroundId, setProfileBackgroundId] = React.useState('');
  const [chatCosmetics, setChatCosmetics] = React.useState({ glow: '', tag: '', stickers: '', vfx: '', style: '' });
  const [loginError, setLoginError] = React.useState('');
  const [failedStaffAttempts, setFailedStaffAttempts] = React.useState(0);
  const [failedKidAttempts, setFailedKidAttempts] = React.useState(0);
  const [lockoutUntil, setLockoutUntil] = React.useState<number | null>(null);
  const [resetMode, setResetMode] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [resetNotice, setResetNotice] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'home' | 'chat' | 'games' | 'shop' | 'inventory'>('home');
  const [chatRoom, setChatRoom] = React.useState<ChatRoom>('Blender');
  const [showStudentManager, setShowStudentManager] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [unreadAlertCount, setUnreadAlertCount] = React.useState(0);
  const [lastActivity, setLastActivity] = React.useState<number>(Date.now());
  // Durable Stardust wallet + inventory, loaded once per authenticated session
  // and shared across the shop and inventory tabs so purchases survive tab switches.
  const [walletBalance, setWalletBalance] = React.useState<number | null>(null);
  const [ownedItems, setOwnedItems] = React.useState<string[]>([]);
  const [allChatsLocked, setAllChatsLocked] = React.useState(false);
  const [chatLockNotice, setChatLockNotice] = React.useState('');
  const [changingAllChats, setChangingAllChats] = React.useState(false);
  const [manualChatOverrides, setManualChatOverrides] = React.useState<Record<string, boolean>>({});
  const kidLoginInProgress = React.useRef(false);

  // Shared chat state lifted to App level to sync Main Chat and Mini Chat
  const [sharedMessages, setSharedMessages] = React.useState<import('../src/hooks/usePixelingsChat').Message[]>([]);
  const [sharedIsLive, setSharedIsLive] = React.useState<boolean>(false);
  const [sharedLoading, setSharedLoading] = React.useState<boolean>(true);

  const loadAuthenticatedUser = async (session: { user: { id: string } } | null) => {
    if (!session?.user || kidLoginInProgress.current) return;
    setAuthUserId(session.user.id);
    setUserId(session.user.id);
    const { data: profile, error } = await supabase.from('profiles').select('username, role, approved_nickname, avatar_url, background_url, equipped_chat_glow, equipped_chat_tag, equipped_chat_stickers, equipped_chat_vfx, equipped_chat_style').eq('id', session.user.id).single();
    if (error || !profile) {
      setLoginError('This teacher or moderator account is not provisioned yet. Run supabase/staff_profiles.sql in the Supabase SQL Editor, then try again.');
      return;
    }
    setComputer(profile.username);
    setRole(profile.role);
    setIsTeacher(profile.role !== 'computer');
    setIsInstantPreview(false);
    setApprovedNickname(profile.approved_nickname || '');
    setProfileAvatarId(profile.avatar_url || 'profile-happy-slime');
    setProfileBackgroundId(profile.background_url || 'background-happy-slime');
    setChatCosmetics({ glow: profile.equipped_chat_glow || '', tag: profile.equipped_chat_tag || '', stickers: profile.equipped_chat_stickers || '', vfx: profile.equipped_chat_vfx || '', style: profile.equipped_chat_style || '' });
    setLoggedIn(true);
  };

  React.useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setResetMode(true);
        setLoggedIn(false);
        return;
      }
      if (event === 'SIGNED_OUT') {
        kidLoginInProgress.current = false;
        setLoggedIn(false);
        setAuthUserId('');
        setUserId('');
        setComputer('');
        setRole('computer');
        setIsTeacher(false);
        setIsInstantPreview(false);
        setApprovedNickname('');
        setProfileAvatarId('');
        setProfileBackgroundId('');
        setChatCosmetics({ glow: '', tag: '', stickers: '', vfx: '', style: '' });
        setWalletBalance(null);
        setOwnedItems([]);
        setEmailPassword('');
        setKidEmailVerified(false);
        setFirstName('');
        setAccessCode('');
        setActiveTab('home');
        return;
      }
      if (!session?.user) return;
      // Kids authenticate the shared classroom account first, then select
      // their individual profile with a name and access code. Do not let the
      // classroom session skip that second step.
      if (kidLoginInProgress.current) return;
      void loadAuthenticatedUser(session);
    });
    void supabase.auth.getSession().then(({ data }) => loadAuthenticatedUser(data.session));
    return () => authListener.subscription.unsubscribe();
  }, []);

  // Auto-timeout: Sign out after 30 minutes of inactivity
  React.useEffect(() => {
    if (!loggedIn) return;
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivity > 30 * 60 * 1000) {
        void supabase.auth.signOut();
        setLoggedIn(false);
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [loggedIn, lastActivity]);

  // Global activity tracker
  React.useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
    };
  }, []);

  // Load wallet + inventory once per authenticated session. Kept at the app
  // level so purchases persist across tab switches (shop <-> inventory).
  React.useEffect(() => {
    if (isInstantPreview) { setWalletBalance(50000); setOwnedItems(['profile-happy-slime', 'background-happy-slime']); return; }
    if (!authUserId) { setWalletBalance(null); setOwnedItems([]); return; }
    let cancelled = false;
    supabase.from('stardust_wallets').select('balance').eq('user_id', authUserId).single()
      .then(({ data }) => { if (!cancelled && data) setWalletBalance((data as { balance: number }).balance); });
    supabase.from('stardust_inventory').select('item_id').eq('user_id', authUserId)
      .then(({ data }) => { if (!cancelled) setOwnedItems((data as { item_id: string }[] | null)?.map((entry) => entry.item_id) ?? []); });
    return () => { cancelled = true; };
  }, [authUserId, isInstantPreview]);

  const handleLogin = async () => {
    setLoginError('');

    // Check for account lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000 / 60);
      setLoginError(`Too many failed attempts. Please try again in ${remaining} minute${remaining === 1 ? '' : 's'}.`);
      return;
    }

    if (!email.trim() || !email.includes('@') || !emailPassword) {
      setLoginError('Enter a valid email address and password.');
      return;
    }
    if (loginType === 'staff') {
      kidLoginInProgress.current = false;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: emailPassword,
      });
      if (error || !data.user) { setFailedStaffAttempts((attempts) => attempts + 1); setLoginError('That work email or password was not recognized.'); return; }
      setAuthUserId(data.user.id);
      return;
    }
    if (!kidEmailVerified) {
      kidLoginInProgress.current = true;
      const { data: classroom, error: classroomError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: emailPassword,
      });
      if (classroomError || !classroom.user) { kidLoginInProgress.current = false; setLoginError('That classroom email or password was not recognized.'); return; }
      setKidEmailVerified(true);
      return;
    }
    if (!firstName.trim() || !accessCode.trim()) {
      setLoginError('Enter your first name and the code your teacher gave you.');
      return;
    }

    // Verify Kid Login
    const { data: child, error } = await supabase.rpc('verify_child_login', {
      child_name: firstName.trim(),
      child_code: accessCode.trim(),
    });

    const selectedChild = Array.isArray(child) ? child[0] : child;

    if (error || !selectedChild) {
      const newAttempts = failedKidAttempts + 1;
      setFailedKidAttempts(newAttempts);
      if (newAttempts >= 5) {
        setLockoutUntil(Date.now() + 5 * 60 * 1000); // Lock for 5 minutes
        setFailedKidAttempts(0);
      }
      setLoginError('That first name and code were not recognized.');
      return;
    }

    // Success: Clear failures
    setFailedKidAttempts(0);
    setLockoutUntil(null);

    // Ensure we are authenticated with the shared account before finalizing profile
    const { data: classroom, error: classroomError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: emailPassword,
    });
    if (classroomError || !classroom.user) { setLoginError('That classroom email or password was not recognized.'); return; }

    setAuthUserId(classroom.user.id);
    setUserId(selectedChild.id);
    setComputer(selectedChild.username);
    setRole('computer');
    setApprovedNickname(selectedChild.approved_nickname || '');
    const { data: childProfile } = await supabase.from('profiles').select('avatar_url, background_url, equipped_chat_glow, equipped_chat_tag, equipped_chat_stickers, equipped_chat_vfx, equipped_chat_style').eq('id', selectedChild.id).single();
    setProfileAvatarId(childProfile?.avatar_url || 'profile-happy-slime');
    setProfileBackgroundId(childProfile?.background_url || 'background-happy-slime');
    setChatCosmetics({ glow: childProfile?.equipped_chat_glow || '', tag: childProfile?.equipped_chat_tag || '', stickers: childProfile?.equipped_chat_stickers || '', vfx: childProfile?.equipped_chat_vfx || '', style: childProfile?.equipped_chat_style || '' });
    setIsTeacher(false);
    setIsInstantPreview(false);
      setLoggedIn(true);
  };

  const handleStaffLogin = async () => {
    setLoginError('');
    if (!email.trim() || !email.includes('@') || !emailPassword) {
      setLoginError('Enter a valid email address and password.');
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: emailPassword,
    });
    if (error || !data.user) { setFailedStaffAttempts((attempts) => attempts + 1); setLoginError('That work email or password was not recognized.'); return; }
    setAuthUserId(data.user.id);
    void loadAuthenticatedUser(data);
  };

  const toggleAllChats = async () => {
    const nextLocked = !allChatsLocked;
    setChangingAllChats(true);
    setChatLockNotice('');
    if (!isTeacher) {
      setChangingAllChats(false);
      return;
    }
    if (!email) {
      setAllChatsLocked(nextLocked);
      setManualChatOverrides({});
      setChangingAllChats(false);
      return;
    }
    const { error } = isTeacher
      ? await supabase.from('sessions').update({
        status: nextLocked ? 'locked' : 'live',
        lock_reason: nextLocked ? 'All chats are paused by a teacher or moderator.' : null,
        locked_at: nextLocked ? new Date().toISOString() : null,
        locked_by: nextLocked ? userId : null,
      }).neq('name', '')
      : { error: null };
    if (error) {
      setChatLockNotice('Could not update all chat rooms. Please try again.');
    } else {
      setAllChatsLocked(nextLocked);
      setManualChatOverrides({});
      setChatLockNotice(nextLocked ? 'All chat rooms are locked.' : 'All chat rooms are unlocked.');
    }
    setChangingAllChats(false);
  };

  const requestPasswordReset = async () => {
    setLoginError('');
    setResetNotice('');
    if (!email.trim() || !email.includes('@')) {
      setLoginError('Enter your work email first, then choose reset password.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin });
    if (error) { setLoginError('We could not send the password reset email.'); return; }
    setResetNotice('Password reset link sent. Check your email.');
  };

  // Handle navigation to Student Manager
  const openStudentManager = () => {
    if (!isTeacher) {
      setLoginError('Only teachers can access the student manager.');
      return;
    }
    setShowStudentManager(true);
  };

  const saveNewPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setResetNotice('');
    if (newPassword.length < 8) { setResetNotice('Use at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setResetNotice('Passwords do not match.'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setResetNotice('We could not update your password. Please request a new link.'); return; }
    setResetMode(false);
    setNewPassword('');
    setConfirmPassword('');
    setResetNotice('Password updated. You can sign in now.');
  };

  const handleLogout = async () => {
    setLoginError('');
    kidLoginInProgress.current = false;
    if (!isInstantPreview) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setLoginError('We could not log you out. Please try again.');
        return;
      }
    }
    setLoggedIn(false);
    setAuthUserId('');
    setUserId('');
    setComputer('');
    setRole('computer');
    setIsTeacher(false);
    setIsInstantPreview(false);
    setApprovedNickname('');
    setProfileAvatarId('');
    setProfileBackgroundId('');
    setChatCosmetics({ glow: '', tag: '', stickers: '', vfx: '', style: '' });
    setEmailPassword('');
    setKidEmailVerified(false);
    setFirstName('');
    setAccessCode('');
    setActiveTab('home');
  };

  // TEST-ONLY: remove this handler and the matching button below before launch.
  const handleInstantTestAccess = (view: 'teacher' | 'student' | React.MouseEvent<HTMLButtonElement> = 'teacher') => {
    const teacherView = view !== 'student';
    setAuthUserId('');
    setUserId(teacherView ? 'test-moderator' : 'test-student');
    setComputer(teacherView ? 'Test Teacher' : 'Test Student');
    setRole(teacherView ? 'moderator' : 'computer');
    setIsTeacher(teacherView);
    setIsInstantPreview(true);
    setProfileAvatarId('profile-happy-slime');
    setOwnedItems(['profile-happy-slime', 'background-happy-slime']);
    setApprovedNickname('');
    setLoggedIn(true);
  };

  if (resetMode) return <main className="app-shell login-shell">
    <section className="login-card">
    <img className="brand-logo login-logo" src={logoSrc} alt="Pixels Tech Lab" />
    <h1 className="login-title">Reset <em>password</em></h1>
      <p className="hero-copy">Choose a new password for your teacher or moderator account.</p>
      <form onSubmit={saveNewPassword}>
        <label className="login-label" htmlFor="new-password">New password</label>
        <input id="new-password" className="login-input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
        <label className="login-label" htmlFor="confirm-password">Confirm password</label>
        <input id="confirm-password" className="login-input" type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        {resetNotice && <p className="login-error">{resetNotice}</p>}
        <button className="login-button" type="submit">Save new password</button>
      </form>
    </section>
  </main>;

  if (!loggedIn) return <main className="app-shell login-shell">
    <section className="login-card">
      <img className="brand-logo login-logo" src={logoSrc} alt="Pixels Tech Lab" />
      <h1 className="login-title">Pixelings <em>Chat</em></h1>
      <p className="hero-copy">Use your work email, or sign in to the classroom and choose your own Pixelings account.</p>
      <form onSubmit={(event) => { event.preventDefault(); void handleLogin(); }}>
      {!kidEmailVerified && <div className="login-tabs" role="tablist" aria-label="Login type">
        <button type="button" className={loginType === 'kid' ? 'active' : ''} onClick={() => { setLoginType('kid'); setLoginError(''); }}>Kids</button>
        <button type="button" className={loginType === 'staff' ? 'active' : ''} onClick={() => { setLoginType('staff'); setLoginError(''); }}>Teacher / moderator</button>
      </div>}
      {!kidEmailVerified ? <>
        <label className="login-label" htmlFor="email">{loginType === 'kid' ? 'Classroom email' : 'Work email'}</label>
        <input id="email" className="login-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <label className="login-label" htmlFor="email-password">{loginType === 'kid' ? 'Classroom password' : 'Password'}</label>
        <input id="email-password" className="login-input" type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Password" />
        {loginType === 'staff' && <p className="login-help login-help-left">Use the password for your email. Staff accounts are matched to their teacher or moderator role.</p>}
      </> : <>
        <div className="verification-kicker">CLASSROOM VERIFIED</div>
        <p className="hero-copy">Now choose your individual Pixelings account.</p>
        <label className="login-label" htmlFor="first-name">Your first name</label>
        <input id="first-name" className="login-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" autoCapitalize="words" />
        <div className="login-label">Your account code</div>
        <div className="code-display" aria-label="Account code">{accessCode ? accessCode.split('').map(() => '•').join(' ') : 'Enter code below'}</div>
        <div className="virtual-numpad" aria-label="Virtual number pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => <button type="button" key={digit} onClick={() => setAccessCode((code) => code.length < 6 ? `${code}${digit}` : code)}>{digit}</button>)}
          <button type="button" onClick={() => setAccessCode('')}>Clear</button>
          <button type="button" onClick={() => setAccessCode((code) => code.length < 6 ? `${code}0` : code)}>0</button>
          <button type="button" onClick={() => setAccessCode((code) => code.slice(0, -1))}>⌫</button>
        </div>
      </>}
      {loginError && <p className="login-error">{loginError}</p>}
      {resetNotice && <p className="login-help" role="status">{resetNotice}</p>}
      <button className="login-button" type="submit" disabled={kidEmailVerified ? !firstName || accessCode.length < 4 : !email || !emailPassword}>{kidEmailVerified ? 'Verify account' : (loginType === 'kid' ? 'Continue' : 'Sign in')}</button>
      </form>
      {loginType === 'staff' && <button type="button" className="reset-link-button" disabled={!email.trim() || !email.includes('@')} onClick={requestPasswordReset}>Reset password</button>}
      {/* TEST-ONLY: remove this button before launch. */}
      {showInstantTest && <button type="button" className="instant-test-button" onClick={handleInstantTestAccess}>⚡ Instant access (testing only)</button>}
      {showInstantTest && <div className="instant-test-panel">
        <div className="instant-test-kicker">DEVELOPER PREVIEW</div>
        <p>Open the app as either side of the classroom.</p>
        <div className="instant-test-actions">
          <button type="button" className="instant-test-button teacher-test-button" onClick={() => handleInstantTestAccess('teacher')}>
            <strong>Teacher view</strong><span>Moderation &amp; classroom controls</span>
          </button>
          <button type="button" className="instant-test-button student-test-button" onClick={() => handleInstantTestAccess('student')}>
            <strong>Student view</strong><span>Regular student permissions</span>
          </button>
        </div>
      </div>}
      <small className="login-help">Kids share one classroom email, then use their own first name and code.</small>
    </section>
  </main>;

  return (
    <main className={`app-shell ${activeTab === 'chat' ? 'chat-page-shell' : ''}`}>
      <header className="site-header">
        <div className="site-header-inner">
          <button className="brand-mark" type="button" onClick={() => { setActiveTab('home'); setShowStudentManager(false); }} aria-label="Go to Pixels Tech Lab home">
            <img src={logoSrc} alt="Pixels Tech Lab" />
          </button>
          <nav className="site-nav" aria-label="Primary navigation">
            <button className={`nav-tab ${activeTab === 'home' && !showStudentManager ? 'active' : ''}`} onClick={() => { setActiveTab('home'); setShowStudentManager(false); }}>Home</button>
            <button className={`nav-tab ${activeTab === 'chat' && !showStudentManager ? 'active' : ''}`} onClick={() => { setActiveTab('chat'); setShowStudentManager(false); }}>Chat</button>
            <button className={`nav-tab ${activeTab === 'games' && !showStudentManager ? 'active' : ''}`} onClick={() => { setActiveTab('games'); setShowStudentManager(false); }}>Games</button>
            <button className={`nav-tab ${activeTab === 'shop' && !showStudentManager ? 'active' : ''}`} onClick={() => { setActiveTab('shop'); setShowStudentManager(false); }}>Stardust Shop</button>
            <button className={`nav-tab ${activeTab === 'inventory' && !showStudentManager ? 'active' : ''}`} onClick={() => { setActiveTab('inventory'); setShowStudentManager(false); }}>Inventory</button>
            {isTeacher && <button className={`nav-tab ${showStudentManager ? 'active' : ''}`} onClick={() => setShowStudentManager(!showStudentManager)}>Students</button>}
          </nav>
          <div className="site-nav-actions">
            {isTeacher && <button className="global-chat-lock" onClick={toggleAllChats} disabled={changingAllChats}>
              {changingAllChats ? 'Updating…' : allChatsLocked ? 'Unlock chats' : 'Lock chats'}
            </button>}
            {isTeacher && <button className="notif-toggle-btn" onClick={() => setShowNotifications(!showNotifications)} title="Priority Alerts" aria-label={`Priority alerts${unreadAlertCount > 0 ? `, ${unreadAlertCount} unread` : ''}`} aria-expanded={showNotifications}>
              <svg className="notif-bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadAlertCount > 0 && <span className="notif-dot" aria-hidden="true"></span>}
            </button>}
            <span className="nav-account">
              <span className="nav-profile-art" style={{ backgroundImage: `url(${avatarItemById.get(profileBackgroundId)?.src || avatarItemById.get('background-happy-slime')?.src})` }}>
                <img src={(avatarItemById.get(profileAvatarId) || avatarItemById.get('profile-happy-slime') || profileItems[0])!.src} alt="" />
              </span>
              {approvedNickname || computer}
            </span>
            <button className="logout-button" type="button" onClick={handleLogout}>Log out</button>
          </div>
        </div>
      </header>
      
      
      {isTeacher && showNotifications && <div className="teacher-alerts-container" style={{ position: 'fixed', top: '80px', right: '20px', zIndex: 100 }}>
        <TeacherNotificationCenter onUnreadChange={setUnreadAlertCount} />
      </div>}

      {chatLockNotice && <p className="global-chat-notice" role="status">{chatLockNotice}</p>}
      {showStudentManager ? (
        <TeacherDashboard />
      ) : (
        <>
          {activeTab === 'home' ? <>
          <section className="hero home-hero">
            <h1>Welcome <em>Pixelings!</em></h1>
            <p className="hero-copy">A cozy little corner to chat and spend your Stardust.</p>
          </section>
          <section className="home-grid">
            <article className="welcome-card feature-card">
              <div className="card-kicker">TODAY IN THE LOUNGE</div>
              <h2>Make something <em>sparkle.</em></h2>
              <p>Drop into chat or show off your collection in the Stardust Shop.</p>
              <button className="primary-action" onClick={() => setActiveTab('chat')}>Open the chat →</button>
            </article>
          </section>
          <section className="home-section">
            <div className="section-heading home-section-heading">
              <div>
                <div className="card-kicker">PIXELS TECH LAB</div>
                <h2>PTL <em>News</em></h2>
              </div>
              <span className="section-label">LATEST UPDATES</span>
            </div>
            <p className="section-copy">Short updates, announcements, and useful things happening around Pixels Tech Lab.</p>
            <div className="legacy-static"><div className="news-grid">
              <article className="news-card">
                <div className="news-meta">LAB NOTE · OCT 14, 2026</div>
                <h3>Welcome to the new Pixelings lounge</h3>
                <p>Chat, share what you are building, and keep an eye on this space for new lab updates.</p>
              </article>
              <article className="news-card">
                <div className="news-meta">COMING SOON</div>
                <h3>More ways to show your work</h3>
                <p>We are planning new ways for Pixelings to spotlight projects, ideas, and creative experiments.</p>
              </article>
            </div></div>
            <PtlPosts section="news" canEdit={isTeacher && Boolean(authUserId)} userId={authUserId} />
          </section>
          <section className="home-section tales-section">
            <div className="section-heading home-section-heading">
              <div>
                <div className="card-kicker">BEHIND THE BUILD</div>
                <h2>Tales from the <em>Tech Lab</em></h2>
              </div>
              <span className="section-label">STORIES & SPOTLIGHTS</span>
            </div>
            <p className="section-copy">A home for behind-the-scenes stories, project spotlights, creative lessons, and the people who make the lab interesting.</p>
            <div className="legacy-static"><div className="story-card">
              <div className="story-icon">✦</div>
              <div>
                <div className="news-meta">THE IDEA BEHIND THE SECTION</div>
                <h3>Show the messy, clever, human side of making things.</h3>
                <p>Tales can feature a Pixelings project, a quick lesson learned, an interview, or a peek at how something in the lab came together.</p>
              </div>
            </div></div>
            <PtlPosts section="tales" canEdit={isTeacher && Boolean(authUserId)} userId={authUserId} />
          </section>
          </>
          : activeTab === 'chat' ? <>
          <section className="chat-page-title">
            <h1>Pixelings <em>Chat</em></h1>
          </section>
          <PixelingsChat 
            room={chatRoom} 
            onRoomChange={setChatRoom} 
            currentUserId={userId} 
            currentUsername={approvedNickname || computer} 
            currentUsernameHandle={computer} 
            currentProfile={{ avatarUrl: profileAvatarId, backgroundUrl: profileBackgroundId }} 
            chatCosmetics={chatCosmetics} 
            isAdmin={isTeacher || role !== 'computer'} 
            isModerator={isTeacher || role !== 'computer'} 
            demoMode={isInstantPreview} 
            allChatsLocked={allChatsLocked} 
            manualChatOverride={manualChatOverrides[chatRoom]} 
            onManualStatusChange={(live) => setManualChatOverrides((overrides) => ({ ...overrides, [chatRoom]: live }))}
            externalState={{
              messages: sharedMessages,
              setMessages: setSharedMessages,
              isLive: sharedIsLive,
              setIsLive: setSharedIsLive,
              loading: sharedLoading,
              setLoading: setSharedLoading
            }}
          />
          <p className="demo-note">Preview mode · moderation is required for flagged messages</p>
          </>
          : activeTab === 'games' ? <>
            <section className="hero"><h1>Mini <em>Games</em></h1><p className="hero-copy">Take a quick break, test your memory, and collect a little Stardust.</p></section>
            <RuneDuelMatch />
            <MiniTrivia userId={userId} demoMode={isInstantPreview} />
          </>
          : activeTab === 'inventory' ? <>
            <section className="hero"><h1>My <em>Inventory</em></h1><p className="hero-copy">Equip your profile picture and chat cosmetics from everything you own.</p></section>
            <InventoryPage accountId={authUserId} demoMode={isInstantPreview} balance={walletBalance} ownedItems={ownedItems} onOwnedChange={setOwnedItems} onBalanceChange={setWalletBalance} onProfileChange={(avatarId, backgroundId) => { setProfileAvatarId(avatarId); setProfileBackgroundId(backgroundId); }} onChatCosmeticsChange={setChatCosmetics} />
          </>
          : <>
            <section className="hero"><h1>Stardust <em>Shop</em></h1><p className="hero-copy">Spend your sparkle on chat upgrades, identity flexes, and delightful chaos.</p></section>
            <StardustShop accountId={authUserId} demoMode={isInstantPreview} canManage={isTeacher} balance={walletBalance} ownedItems={ownedItems} onOwnedChange={setOwnedItems} onBalanceChange={setWalletBalance} />
          </>}
          {activeTab !== 'chat' && <MiniChat 
            room={chatRoom} 
            onRoomChange={setChatRoom} 
            userId={userId} 
            username={approvedNickname || computer} 
            chatCosmetics={chatCosmetics} 
            demoMode={isInstantPreview}
            externalState={{
              messages: sharedMessages,
              setMessages: setSharedMessages,
              isLive: sharedIsLive,
              setIsLive: setSharedIsLive,
              loading: sharedLoading,
              setLoading: setSharedLoading
            }}
          />}
        </>
      )}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
