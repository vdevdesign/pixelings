import React from 'react';
import ReactDOM from 'react-dom/client';
import { PixelingsChat } from '../components/PixelingsChat';
import { StardustShop } from '../components/StardustShop';
import { InventoryPage } from '../components/InventoryPage';
import { MiniTrivia } from '../components/MiniTrivia';
import { RuneDuelMatch } from '../components/RuneDuelMatch';
import { MiniChat } from '../components/MiniChat';
import { PtlPosts } from '../components/PtlPosts';
import { QuickNeedsOverlay } from '../components/QuickNeedsOverlay';
import { ChatRoom } from '../components/chatRooms';
import { AccessCodeLogin } from '../components/AccessCodeLogin';
import { TeacherDashboard } from '../components/TeacherDashboard';
import { TeacherNotificationCenter } from '../components/TeacherNotificationCenter';
import { avatarItemById, profileItems } from '../components/avatarItems';
import { supabase } from '../lib/supabaseClient';
import './styles.css';
import './mobile.css';

const logoSrc = `${import.meta.env.BASE_URL}pixels-tech-lab-logo.png`;

// Compact SVG glyphs for the navigation tabs, keeping the header uncluttered.
const NAV_ICONS: Record<string, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  chat: <><path d="M21 12a8 8 0 0 1-8 8H4l1.6-3.2A8 8 0 1 1 21 12Z" /><circle cx="9" cy="12" r=".6" fill="currentColor" /><circle cx="13" cy="12" r=".6" fill="currentColor" /><circle cx="17" cy="12" r=".6" fill="currentColor" /></>,
  games: <><rect x="2.5" y="7" width="19" height="11" rx="5" /><path d="M7 10.5v4M5 12.5h4" /><circle cx="16" cy="11.5" r=".9" fill="currentColor" /><circle cx="18.5" cy="14" r=".9" fill="currentColor" /></>,
  shop: <><path d="M4 8h16l-1.2 12H5.2L4 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  inventory: <><rect x="3.5" y="4" width="17" height="17" rx="2.5" /><path d="M3.5 9h17" /><path d="M9 4v5" /></>,
  students: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /><path d="M3 9.5 12 5l9 4.5" /></>,
};

function NavIcon({ name }: { name: keyof typeof NAV_ICONS | string }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{NAV_ICONS[name] ?? null}</svg>;
}

// Browsers restore the previous scroll position on reload; always start at the top.
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

// Persisted kid sessions: a student stays logged in across reloads until they
// log out, but after an hour of inactivity they must re-enter their name and
// access code (the classroom email/password stays valid in the background).
const KID_SESSION_KEY = 'pixelings-kid-session';
const IDLE_LIMIT_MS = 60 * 60 * 1000; // 1 hour minimum before the code is required again
interface StoredKidSession {
  authUserId: string;
  userId: string;
  computer: string;
  approvedNickname: string;
  profileAvatarId: string;
  profileBackgroundId: string;
  chatCosmetics: { glow: string; tag: string; stickers: string; vfx: string; style: string; nameColor: string };
  lastSeen: number;
}
function readKidSession(): StoredKidSession | null {
  try {
    const raw = localStorage.getItem(KID_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredKidSession;
    return parsed && parsed.authUserId && parsed.userId ? parsed : null;
  } catch { return null; }
}
function writeKidSession(session: StoredKidSession) {
  try { localStorage.setItem(KID_SESSION_KEY, JSON.stringify(session)); } catch { /* private mode */ }
}
function clearKidSession() {
  try { localStorage.removeItem(KID_SESSION_KEY); } catch { /* private mode */ }
}

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
  const [chatCosmetics, setChatCosmetics] = React.useState({ glow: '', tag: '', stickers: '', vfx: '', style: '', nameColor: '' });
  const [loginError, setLoginError] = React.useState('');
  const [failedStaffAttempts, setFailedStaffAttempts] = React.useState(0);
  const [failedKidAttempts, setFailedKidAttempts] = React.useState(0);
  const [lockoutUntil, setLockoutUntil] = React.useState<number | null>(null);
  const [resetMode, setResetMode] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [resetNotice, setResetNotice] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'home' | 'chat' | 'games' | 'shop' | 'inventory'>('home');

  // Each tab swap starts at the top of the page, like a fresh navigation.
  React.useEffect(() => { window.scrollTo(0, 0); }, [activeTab]);
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
  // Moderation queue from the chat, mirrored up here so the header bell shows
  // flagged messages and nickname requests alongside Priority Alerts.
  const [moderationQueue, setModerationQueue] = React.useState<{
    reviewQueue: { id: string; sender_name: string; content: string; moderation_reason?: string | null }[];
    nicknameRequests: { id: string; username: string; nickname: string }[];
    handlers: { approveMessage: (id: string) => void; rejectMessage: (id: string) => void; approveNickname: (id: string) => void; rejectNickname: (id: string) => void };
  }>({ reviewQueue: [], nicknameRequests: [], handlers: { approveMessage: () => {}, rejectMessage: () => {}, approveNickname: () => {}, rejectNickname: () => {} } });
  const [claimMode, setClaimMode] = React.useState(false);
  const [claimName, setClaimName] = React.useState('');
  const [claimCode, setClaimCode] = React.useState('');
  const [claimEmail, setClaimEmail] = React.useState('');
  const [claimPassword, setClaimPassword] = React.useState('');
  const [claimBusy, setClaimBusy] = React.useState(false);
  const [claimNotice, setClaimNotice] = React.useState('');

  // All-in-one sign-up + claim: one submit creates the student's own email
  // account AND links their school kid profile (first name + access code).
  // A teacher approves, then wallet, inventory and chat messages transfer
  // from the classroom account to the new login.
  const signUpAndClaim = async () => {
    setClaimNotice('');
    if (!claimEmail.trim() || !claimEmail.includes('@') || claimPassword.length < 8) {
      setClaimNotice('Enter your email and a password of at least 8 characters.');
      return;
    }
    if (!claimName.trim() || claimCode.trim().length < 4) {
      setClaimNotice('Enter your first name and access code.');
      return;
    }
    setClaimBusy(true);
    try {
      const { data: signedUp, error: signUpError } = await supabase.auth.signUp({
        email: claimEmail.trim().toLowerCase(),
        password: claimPassword,
      });
      if (signUpError || !signedUp.user) {
        setClaimNotice(signUpError?.message.includes('already') ? 'That email already has an account — sign in first, then submit the claim.' : 'Could not create that account. Try again.');
        return;
      }
      const { data, error } = await supabase.rpc('request_account_claim', { child_name: claimName.trim(), child_code: claimCode.trim() });
      if (error) {
        setClaimNotice(error.message.includes('recognized') ? 'Account created, but that first name and code were not recognized. Sign in later and try the claim again.' : 'Account created, but the claim could not be submitted. Sign in later and try again.');
        return;
      }
      setClaimNotice('Account created and claim submitted! Check your inbox to confirm your email. Your teacher will approve the transfer of your Stardust, inventory and messages.');
      setClaimEmail('');
      setClaimPassword('');
      setClaimCode('');
    } finally {
      setClaimBusy(false);
    }
  };

  // Signed-in students with a pending claim just land on their claim status.
  // App-wide nickname-request poll: the chat hook only loads pending nicknames
  // while the Chat tab is mounted, so the bell badge would vanish on Home,
  // Games, Shop, etc. Poll here too (every 30s) and merge results into the
  // moderation queue whenever the chat component is not already supplying
  // fresher data.
  React.useEffect(() => {
    if (!isTeacher || isInstantPreview || activeTab === 'chat') return;
    let cancelled = false;
    const pull = async () => {
      const { data } = await supabase.from('profiles').select('id, username, pending_nickname').eq('nickname_status', 'pending');
      if (cancelled) return;
      const requests = (data || [] as { id: string; username: string; pending_nickname: string }[]).map((row) => ({ id: row.id, username: row.username, nickname: row.pending_nickname }));
      setModerationQueue((queue) => queue.nicknameRequests.length === requests.length && requests.every((r, i) => queue.nicknameRequests[i]?.id === r.id) ? queue : {
        ...queue,
        nicknameRequests: requests,
        handlers: {
          approveMessage: queue.handlers.approveMessage,
          rejectMessage: queue.handlers.rejectMessage,
          approveNickname: (id) => { void supabase.rpc('approve_nickname', { student_id: id, approve: true }).then(() => pull()); },
          rejectNickname: (id) => { void supabase.rpc('approve_nickname', { student_id: id, approve: false }).then(() => pull()); },
        },
      });
    };
    void pull();
    const timer = window.setInterval(pull, 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [isTeacher, isInstantPreview, activeTab]);

  React.useEffect(() => {
    if (!authUserId || isInstantPreview) return;
    void supabase.from('account_claims').select('id, status').eq('requested_by', authUserId).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        const claim = (data as { status: string }[] | null)?.[0];
        if (claim) setClaimNotice(claim.status === 'pending' ? 'Your account claim is waiting for teacher approval.' : claim.status === 'approved' ? 'Your account has been claimed! Sign in with your own email and password.' : '');
      });
  }, [authUserId, loggedIn, isInstantPreview]);

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
    setChatCosmetics({ glow: profile.equipped_chat_glow || '', tag: profile.equipped_chat_tag || '', stickers: profile.equipped_chat_stickers || '', vfx: profile.equipped_chat_vfx || '', style: profile.equipped_chat_style || '', nameColor: (profile as { equipped_chat_name_color?: string | null }).equipped_chat_name_color || '' });
    setLoggedIn(true);
  };

  React.useEffect(() => {
    // Restore a persisted kid session before wiring auth listeners so the
    // INITIAL_SESSION event doesn't overwrite the kid identity with the
    // shared classroom account's profile.
    const storedKid = readKidSession();
    if (storedKid && Date.now() - storedKid.lastSeen < IDLE_LIMIT_MS) {
      kidLoginInProgress.current = true;
      setAuthUserId(storedKid.authUserId);
      setUserId(storedKid.userId);
      setComputer(storedKid.computer);
      setRole('computer');
      setIsTeacher(false);
      setIsInstantPreview(false);
      setApprovedNickname(storedKid.approvedNickname);
      setProfileAvatarId(storedKid.profileAvatarId || 'profile-happy-slime');
      setProfileBackgroundId(storedKid.profileBackgroundId || 'background-happy-slime');
      setChatCosmetics(storedKid.chatCosmetics);
      setLastActivity(Math.max(storedKid.lastSeen, Date.now() - IDLE_LIMIT_MS + 1));
      setLoggedIn(true);
    } else if (storedKid) {
      // Stale beyond the idle limit: drop it and ask for the code again.
      clearKidSession();
      setKidEmailVerified(true);
    }
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
        setChatCosmetics({ glow: '', tag: '', stickers: '', vfx: '', style: '', nameColor: '' });
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

  // Idle timeout: after an hour of inactivity kids must re-enter their name
  // and access code (classroom auth survives); staff are signed out fully.
  React.useEffect(() => {
    if (!loggedIn) return;
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivity > IDLE_LIMIT_MS) {
        if (readKidSession()) {
          clearKidSession();
          setLoggedIn(false);
          setKidEmailVerified(true); // skip the email/password step, code only
          setFirstName('');
          setAccessCode('');
          setActiveTab('home');
        } else {
          void supabase.auth.signOut();
          setLoggedIn(false);
        }
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [loggedIn, lastActivity]);

  // Global activity tracker (also keeps the persisted kid session fresh)
  React.useEffect(() => {
    const updateActivity = () => {
      const now = Date.now();
      setLastActivity(now);
      const stored = readKidSession();
      // Throttle writes: refresh the stored timestamp at most every 30 seconds.
      if (stored && now - stored.lastSeen > 30 * 1000) writeKidSession({ ...stored, lastSeen: now });
    };
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
      if (classroomError || !classroom.user) { kidLoginInProgress.current = false; setLoginError('That email or password was not recognized.'); return; }
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
    if (classroomError || !classroom.user) { setLoginError('That email or password was not recognized.'); return; }

    setAuthUserId(classroom.user.id);
    setUserId(selectedChild.id);
    setComputer(selectedChild.username);
    setRole('computer');
    setApprovedNickname(selectedChild.approved_nickname || '');
    const { data: childProfile } = await supabase.from('profiles').select('avatar_url, background_url, equipped_chat_glow, equipped_chat_tag, equipped_chat_stickers, equipped_chat_vfx, equipped_chat_style').eq('id', selectedChild.id).single();
    setProfileAvatarId(childProfile?.avatar_url || 'profile-happy-slime');
    setProfileBackgroundId(childProfile?.background_url || 'background-happy-slime');
    const childCosmetics = { glow: childProfile?.equipped_chat_glow || '', tag: childProfile?.equipped_chat_tag || '', stickers: childProfile?.equipped_chat_stickers || '', vfx: childProfile?.equipped_chat_vfx || '', style: childProfile?.equipped_chat_style || '', nameColor: (childProfile as { equipped_chat_name_color?: string | null } | null)?.equipped_chat_name_color || '' };
    setChatCosmetics(childCosmetics);
    setIsTeacher(false);
    setIsInstantPreview(false);
      setLoggedIn(true);
    // Persist so a page reload keeps the kid logged in (until idle > 1 hour).
    writeKidSession({
      authUserId: classroom.user.id,
      userId: selectedChild.id,
      computer: selectedChild.username,
      approvedNickname: selectedChild.approved_nickname || '',
      profileAvatarId: childProfile?.avatar_url || 'profile-happy-slime',
      profileBackgroundId: childProfile?.background_url || 'background-happy-slime',
      chatCosmetics: childCosmetics,
      lastSeen: Date.now(),
    });
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
      }).neq('name', 'Teacher Lounge')
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
      setLoginError('Enter the email first, then choose reset password.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin });
    if (error) { setLoginError('We could not send the password reset email.'); return; }
    setResetNotice('Password reset link sent. Check your inbox.');
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
    clearKidSession();
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
    setChatCosmetics({ glow: '', tag: '', stickers: '', vfx: '', style: '', nameColor: '' });
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
      <p className="hero-copy">Sign in with your email, or create your own account and claim your Pixelings profile.</p>
      <form onSubmit={(event) => { event.preventDefault(); void handleLogin(); }}>
      {!kidEmailVerified && <div className="login-tabs" role="tablist" aria-label="Login type">
        <button type="button" className={loginType === 'kid' ? 'active' : ''} onClick={() => { setLoginType('kid'); setLoginError(''); }}>Kids</button>
        <button type="button" className={loginType === 'staff' ? 'active' : ''} onClick={() => { setLoginType('staff'); setLoginError(''); }}>Teacher / moderator</button>
      </div>}
      {!kidEmailVerified ? <>
        <label className="login-label" htmlFor="email">Email</label>
        <input id="email" className="login-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <label className="login-label" htmlFor="email-password">Password</label>
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
      {loginType === 'kid' && !kidEmailVerified && <button type="button" className="reset-link-button" disabled={!email.trim() || !email.includes('@')} onClick={requestPasswordReset}>Reset password</button>}
      {!kidEmailVerified && loginType === 'kid' && <button type="button" className="claim-toggle-button" onClick={() => setClaimMode((open) => !open)}>{claimMode ? 'Cancel' : 'Claim your account'}</button>}
      {claimMode && <div className="claim-panel">
        <div className="verification-kicker">CREATE YOUR OWN LOGIN</div>
        <p className="login-help login-help-left">Fill this out once — we create your account and connect your school profile in the same step. After a teacher approves, your Stardust, inventory and chat messages move to this login. Use it from now on instead of the classroom email.</p>
        <label className="login-label" htmlFor="claim-email">Your email</label>
        <input id="claim-email" className="login-input" type="email" value={claimEmail} onChange={(e) => setClaimEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        <label className="login-label" htmlFor="claim-password">Choose a password</label>
        <input id="claim-password" className="login-input" type="password" value={claimPassword} onChange={(e) => setClaimPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} />
        <div className="claim-signup-divider" aria-hidden="true">then prove who you are</div>
        <label className="login-label" htmlFor="claim-name">Your school first name</label>
        <input id="claim-name" className="login-input" value={claimName} onChange={(e) => setClaimName(e.target.value)} placeholder="First name" autoCapitalize="words" />
        <label className="login-label" htmlFor="claim-code">Your access code from your teacher</label>
        <input id="claim-code" className="login-input" value={claimCode} onChange={(e) => setClaimCode(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="e.g. 123456" inputMode="numeric" />
        <button type="button" className="login-button claim-submit-button" disabled={claimBusy} onClick={() => void signUpAndClaim()}>{claimBusy ? 'Creating…' : 'Create account & claim profile'}</button>
        {claimNotice && <p className="login-help login-help-left" role="status">{claimNotice}</p>}
      </div>}
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
      <small className="login-help">Kids sign in with the classroom email, then pick their own name and code.</small>
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
            <button className={`nav-tab ${activeTab === 'home' && !showStudentManager ? 'active' : ''}`} onClick={() => { setActiveTab('home'); setShowStudentManager(false); }} title="Home" aria-label="Home"><NavIcon name="home" /><span className="nav-tab-label">Home</span></button>
            <button className={`nav-tab ${activeTab === 'chat' && !showStudentManager ? 'active' : ''}`} onClick={() => { setActiveTab('chat'); setShowStudentManager(false); }} title="Chat" aria-label="Chat"><NavIcon name="chat" /><span className="nav-tab-label">Chat</span></button>
            <button className={`nav-tab ${activeTab === 'games' && !showStudentManager ? 'active' : ''}`} onClick={() => { setActiveTab('games'); setShowStudentManager(false); }} title="Games" aria-label="Games"><NavIcon name="games" /><span className="nav-tab-label">Games</span></button>
            <button className={`nav-tab ${activeTab === 'shop' && !showStudentManager ? 'active' : ''}`} onClick={() => { setActiveTab('shop'); setShowStudentManager(false); }} title="Stardust Shop" aria-label="Stardust Shop"><NavIcon name="shop" /><span className="nav-tab-label">Shop</span></button>
            <button className={`nav-tab ${activeTab === 'inventory' && !showStudentManager ? 'active' : ''}`} onClick={() => { setActiveTab('inventory'); setShowStudentManager(false); }} title="Inventory" aria-label="Inventory"><NavIcon name="inventory" /><span className="nav-tab-label">Inventory</span></button>
            {isTeacher && <button className={`nav-tab ${showStudentManager ? 'active' : ''}`} onClick={() => setShowStudentManager(!showStudentManager)} title="Students" aria-label="Students"><NavIcon name="students" /><span className="nav-tab-label">Students</span></button>}
          </nav>
          <div className="site-nav-actions">
            <span className="nav-account">
              <span className="nav-profile-art" style={{ backgroundImage: `url(${avatarItemById.get(profileBackgroundId)?.src || avatarItemById.get('background-happy-slime')?.src})` }}>
                <img src={(avatarItemById.get(profileAvatarId) || avatarItemById.get('profile-happy-slime') || profileItems[0])!.src} alt="" />
              </span>
              {approvedNickname || computer}
            </span>
            <button className="logout-button" type="button" onClick={handleLogout}>Log out</button>
          </div>
          {loggedIn && <div className="stardust-hud" title="Your Stardust balance">✦ <strong>{walletBalance ?? 0}</strong><span>STARDUST</span></div>}
        </div>
      </header>
      
      
      {isTeacher && showNotifications && <div className="teacher-alerts-container">
        <TeacherNotificationCenter
          onUnreadChange={setUnreadAlertCount}
          reviewQueue={moderationQueue.reviewQueue}
          nicknameRequests={moderationQueue.nicknameRequests}
          onApproveMessage={moderationQueue.handlers.approveMessage}
          onRejectMessage={moderationQueue.handlers.rejectMessage}
          onApproveNickname={moderationQueue.handlers.approveNickname}
          onRejectNickname={moderationQueue.handlers.rejectNickname}
        />
      </div>}

      {isTeacher && <button className="global-chat-lock" onClick={toggleAllChats} disabled={changingAllChats}>
        {changingAllChats ? 'Updating…' : allChatsLocked ? 'Unlock all chats' : 'Lock all chats'}
      </button>}
      {isTeacher && <button className="notif-fab" onClick={() => setShowNotifications(!showNotifications)} title="Priority Alerts" aria-label={`Priority alerts${unreadAlertCount > 0 ? `, ${unreadAlertCount} unread` : ''}`} aria-expanded={showNotifications}>
        <svg className="notif-diamond" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <rect x="7.5" y="7.5" width="9" height="9" transform="rotate(45 12 12)" />
        </svg>
        {unreadAlertCount > 0 && <span className="notif-dot" aria-hidden="true"></span>}
      </button>}

      {chatLockNotice && <p className="global-chat-notice" role="status">{chatLockNotice}</p>}
      {/* App-wide quick-needs overlay: every page except the Student Manager. */}
      {/* Quick-needs shortcut is app-wide (every tab) so students can always reach
          the teacher; only hidden from the Student Manager and staff views. */}
      {loggedIn && !showStudentManager && !isTeacher && <QuickNeedsOverlay room={chatRoom} userId={userId} username={approvedNickname || computer} />}
      {showStudentManager ? (
        <TeacherDashboard />
      ) : (
        <>
          {activeTab === 'home' ? <>
          <section className="hero home-hero">
            <h1>Welcome <em>Pixelings!</em></h1>
            <button className="primary-action home-chat-action" onClick={() => setActiveTab('chat')}>Open chat</button>
          </section>
          <div className="home-sections-grid">
          <section className="home-section">
            <div className="section-heading home-section-heading">
              <h2>PTL <em>News</em></h2>
            </div>
            <p className="section-copy">Short updates, announcements, and useful things happening around Pixels Tech Lab.</p>
            <PtlPosts section="news" canEdit={isTeacher && Boolean(authUserId)} userId={authUserId} />
          </section>
          <section className="home-section tales-section">
            <div className="section-heading home-section-heading">
              <h2>Tales from the <em>Tech Lab</em></h2>
            </div>
            <p className="section-copy">A home for behind-the-scenes stories, project spotlights, creative lessons, and the people who make the lab interesting.</p>
            <PtlPosts section="tales" canEdit={isTeacher && Boolean(authUserId)} userId={authUserId} />
          </section>
          </div>
          </>
          : activeTab === 'chat' ? <>
          <PixelingsChat  
            room={chatRoom} 
            onRoomChange={setChatRoom} 
            currentUserId={userId} 
            currentUsername={approvedNickname || computer} 
            currentUsernameHandle={computer} 
            currentProfile={{ avatarUrl: profileAvatarId, backgroundUrl: profileBackgroundId }} 
            chatCosmetics={chatCosmetics} 
            ownedItems={ownedItems}
            onChatStyleChange={async (style) => {
              if (!isInstantPreview && userId) {
                const { data, error } = await supabase.from('profiles')
                  .update({ equipped_chat_style: style || null })
                  .eq('id', userId)
                  .select('id')
                  .maybeSingle();
                if (error) throw error;
                if (!data) throw new Error('Your profile could not be updated. Please ask your teacher to check permissions.');
              }
              setChatCosmetics((current) => ({ ...current, style }));
            }}
            isAdmin={isTeacher || role !== 'computer'}  
            isModerator={isTeacher || role !== 'computer'} 
            demoMode={isInstantPreview} 
            allChatsLocked={allChatsLocked} 
            manualChatOverride={manualChatOverrides[chatRoom]} 
            onManualStatusChange={(live) => setManualChatOverrides((overrides) => ({ ...overrides, [chatRoom]: live }))}
            onModerationQueue={setModerationQueue}
          />
          <p className="demo-note">Preview mode · moderation is required for flagged messages</p>
          </>
          : activeTab === 'games' ? <>
            <section className="hero"><h1>Cosmic <em>Arcade</em></h1></section>
            <section className="daily-cap-note" role="note">✦ Daily earning limit: <strong>500 Stardust per game</strong> — play as much as you like, but rewards pause once a game hits its daily cap. Limits reset at midnight.</section>
            <MiniTrivia userId={userId} demoMode={isInstantPreview} onBalanceChange={(granted) => setWalletBalance((value) => (value ?? 0) + granted)} />
            <RuneDuelMatch onBalanceChange={(granted) => setWalletBalance((value) => (value ?? 0) + granted)} />
          </>
          : activeTab === 'inventory' ? <>
            <section className="hero"><h1>My <em>Inventory</em></h1></section>
            <InventoryPage accountId={authUserId} demoMode={isInstantPreview} balance={walletBalance} ownedItems={ownedItems} onOwnedChange={setOwnedItems} onBalanceChange={setWalletBalance} onProfileChange={(avatarId, backgroundId) => { setProfileAvatarId(avatarId); setProfileBackgroundId(backgroundId); }} onChatCosmeticsChange={(cosmetics) => setChatCosmetics((current) => ({ ...current, ...cosmetics }))} />
          </>
          : <>
            <section className="hero"><h1>Stardust <em>Shop</em></h1></section>
            <StardustShop accountId={authUserId} demoMode={isInstantPreview} canManage={isTeacher} balance={walletBalance} ownedItems={ownedItems} onOwnedChange={setOwnedItems} onBalanceChange={setWalletBalance} />
          </>}
          {activeTab !== 'chat' && <MiniChat 
            room={chatRoom} 
            onRoomChange={setChatRoom} 
            userId={userId} 
            username={approvedNickname || computer} 
            isModerator={isTeacher || role !== 'computer'}
            chatCosmetics={chatCosmetics}  
            demoMode={isInstantPreview}
          />}
        </>
      )}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
