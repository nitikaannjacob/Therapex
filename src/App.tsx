import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Brain, Radio, Heart, Flag, ChevronLeft, Send, Sparkles, Zap, Flame, Loader2, LogOut, History, User as UserIcon, Lock, Mail, Dumbbell, Trophy, CheckCircle, ArrowRight, Upload, Image as ImageIcon, X, Menu, Plus, RefreshCw, Ghost } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Page, TherapistScreen, PersonalityScreen, Verdict, Message, PersonalityResult, User, Ex, PatternAnalysisResult } from './types';
import { Button } from './components/Button';
import { ChatBubble } from './components/ChatBubble';
import { getGeminiResponse, analyzePersonality, analyzePatterns } from './services/gemini';

// --- Background Components ---

const FloatingWords = () => {
  const words = ["left on seen", "read at 11:43pm", "closure?", "situationship era", "it's complicated", "delusional", "ghosted", "blocked", "unfollowed"];
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ 
            x: Math.random() * 100 + '%', 
            y: Math.random() * 100 + '%',
            opacity: 0 
          }}
          animate={{ 
            y: [null, '-20%', '120%'],
            opacity: [0, 0.1, 0]
          }}
          transition={{ 
            duration: 15 + Math.random() * 20, 
            repeat: Infinity, 
            delay: i * 2,
            ease: "linear"
          }}
          className="absolute text-white/10 font-display text-sm md:text-xl whitespace-nowrap select-none"
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
};

const BackgroundGlow = () => (
  <div className="fixed inset-0 pointer-events-none z-0">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rex-red/10 blur-[120px] rounded-full" />
    <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-rex-red/5 blur-[100px] rounded-full" />
    <div className="noise-overlay fixed inset-0" />
  </div>
);

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot' | 'verify' | 'reset'>('login');
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [page, setPage] = useState<Page>('therapist');
  const [therapistScreen, setTherapistScreen] = useState<TherapistScreen>('landing');
  const [personalityScreen, setPersonalityScreen] = useState<PersonalityScreen>('landing');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isRelapsing, setIsRelapsing] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  
  // Therapist State
  const [messages, setMessages] = useState<Message[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [vibeCheckCount, setVibeCheckCount] = useState(0);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  
  // Personality State
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [personalityResult, setPersonalityResult] = useState<PersonalityResult | null>(null);
  const [currentQuizId, setCurrentQuizId] = useState<number | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [uploadedImage, setUploadedImage] = useState<{ data: string, mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pattern Analyser State
  const [exes, setExes] = useState<Ex[]>([]);
  const [patternResult, setPatternResult] = useState<PatternAnalysisResult | null>(null);
  const [isAnalyzingPatterns, setIsAnalyzingPatterns] = useState(false);
  const [activeExId, setActiveExId] = useState<string | null>(null);
  const [isAddingEx, setIsAddingEx] = useState(false);
  const [newExName, setNewExName] = useState('');
  const patternFileInputRef = useRef<HTMLInputElement>(null);

  // Ghost Mode State
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [ghostIntensity, setGhostIntensity] = useState(20);
  const [ghostMessage, setGhostMessage] = useState('');

  // History State
  const [history, setHistory] = useState<{ chats: any[], quizzes: any[] }>({ chats: [], quizzes: [] });

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const ghostTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkAuth();
    showToast("Rex is online and ready to roast.", "success");
  }, []);

  useEffect(() => {
    if (isGhostMode && user) {
      // Base intensity is inversely proportional to healing
      const baseIntensity = Math.max(10, 100 - user.healing_percentage);
      setGhostIntensity(baseIntensity);
      
      // Set initial message
      if (user.healing_percentage > 70) {
        setGhostMessage("You're doing so well, I'm barely here.");
      } else if (user.healing_percentage > 40) {
        setGhostMessage("I'm watching you. Don't look at their profile.");
      } else {
        setGhostMessage("I can feel the delusion from here.");
      }
    }
  }, [isGhostMode, user?.healing_percentage]);

  // Gym State
  const [completedMissions, setCompletedMissions] = useState<string[]>([]);
  const [completingMissionId, setCompletingMissionId] = useState<string | null>(null);
  const [showSuccessMission, setShowSuccessMission] = useState<string | null>(null);
  const [verificationMission, setVerificationMission] = useState<any | null>(null);
  const [verificationProof, setVerificationProof] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  
  const missions = [
    { id: 'new-thing', title: 'Break the Pattern', desc: "Break the routine. Visit a cafe you've never been to, start that hobby you've been putting off, or just take a different route home. Don't be predictable.", icon: <Sparkles size={20} />, points: 10 },
    { id: 'self-care', title: 'Self Care Over Ex-Care', desc: "Invest in yourself. Hit the gym, follow a 10-step skincare routine, or read 20 pages of a book. Your future self is way hotter than your ex.", icon: <Heart size={20} />, points: 5 },
    { id: 'social', title: 'Real Connection', desc: "Reconnect with the world. Call a friend, grab coffee with a sibling, or just have a meaningful conversation with someone who isn't your ex. They missed you.", icon: <UserIcon size={20} />, points: 5 },
  ];

  const fetchGymStatus = async () => {
    try {
      const res = await fetch('/api/gym-status');
      const data = await res.json();
      if (data.completedMissions) setCompletedMissions(data.completedMissions);
    } catch (e) {
      console.error(e);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const completeMission = async (missionId: string) => {
    if (!user) {
      showToast("You need to be logged in!", "error");
      setPage('hub');
      return;
    }
    
    if (user.id === 0) {
      setCompletingMissionId(missionId);
      setTimeout(() => {
        const today = new Date().toISOString().split('T')[0];
        const alreadyDoneToday = user.last_activity_date === today;
        
        setCompletedMissions(prev => [...prev, missionId]);
        setUser({
          ...user,
          streak_count: alreadyDoneToday ? user.streak_count : (user.streak_count || 0) + 1,
          healing_percentage: Math.min(100, (user.healing_percentage || 0) + 5),
          last_activity_date: today
        });
        setCompletingMissionId(null);
        setShowSuccessMission(missionId);
        setVerificationMission(null);
        setVerificationProof('');
      }, 1000);
      return;
    }

    setCompletingMissionId(missionId);
    try {
      const res = await fetch('/api/complete-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCompletedMissions(prev => [...prev, missionId]);
        // Update user state locally
        setUser({
          ...user,
          streak_count: data.streak,
          healing_percentage: data.percentage
        });
        showToast("Mission AccomplISHED! You're one step closer to freedom.");
        setVerificationMission(null);
        setVerificationProof('');
      } else if (res.status === 401) {
        showToast("Session expired. Log in again.", "error");
        setUser(null);
        setPage('hub');
      } else {
        showToast(data.error || "Failed to complete mission.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Connection error. Try again.", "error");
    } finally {
      setCompletingMissionId(null);
    }
  };

  const handleVerifyMission = async () => {
    if (!verificationProof.trim()) {
      setVerificationError("Don't try to cheat. Give Rex some proof.");
      return;
    }

    setIsVerifying(true);
    setVerificationError('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are Rex, a brutal but fair recovery coach. 
        The user is trying to complete a mission: "${verificationMission.title}" - ${verificationMission.desc}.
        They provided this proof: "${verificationProof}".
        
        Decide if this proof is legitimate and sufficient. 
        Return a JSON object:
        {
          "verified": boolean,
          "feedback": "A short, snarky Rex-style comment about their proof"
        }`,
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      if (result.verified) {
        showToast(result.feedback || "Legit. I'll allow it.");
        await completeMission(verificationMission.id);
      } else {
        setVerificationError(result.feedback || "That sounds like a lie. Try harder.");
      }
    } catch (e) {
      console.error(e);
      setVerificationError("Rex is busy. Try again in a second.");
    } finally {
      setIsVerifying(false);
    }
  };

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        fetchGymStatus();
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error("Auth check failed", e);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // --- Handlers ---
  const activateGhost = (msg?: string) => {
    setIsGhostMode(true);
    setGhostIntensity(prev => Math.min(100, prev + 30));
    if (msg) setGhostMessage(msg);
    
    if (ghostTimeoutRef.current) clearTimeout(ghostTimeoutRef.current);
    ghostTimeoutRef.current = setTimeout(() => {
      setIsGhostMode(false);
    }, 45000);
  };

  const handleFinishSession = async () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let durationStr = "";
    if (sessionStartTime) {
      const diffMs = now.getTime() - sessionStartTime;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      durationStr = ` Talk time: ${diffMins}m ${diffSecs}s.`;
    } else {
      // Fallback if somehow null
      durationStr = " Talk time: < 1m.";
    }

    const endMessage: Message = { 
      role: 'model', 
      text: `[SESSION ENDED at ${timeStr}]${durationStr} Rex has saved your progress. You're doing great.`, 
      timestamp: Date.now() 
    };
    
    setMessages(prev => [...prev, endMessage]);
    setShowFinishConfirm(false);
    
    // Save final state if logged in
    if (user && user.id !== 0) {
      try {
        // Use a small delay to ensure state updates are processed if needed, 
        // but here we can just use the calculated finalMessages
        const finalMessages = [...messages, endMessage];
        await fetch('/api/save-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentChatId, messages: finalMessages, verdict: verdict || 'real' })
        });
        showToast("Session saved to history.", "success");
      } catch (e) {
        console.error("Final save error:", e);
        showToast("Failed to save session.", "error");
      }
    }
    
    // Small delay to show the "Session Ended" message before navigating
    setTimeout(() => {
      setPage('hub');
      setSessionStartTime(null);
    }, 3000);
  };

  const handleLogout = async () => {
    if (user?.id !== 0) {
      await fetch('/api/logout', { method: 'POST' });
    }
    setUser(null);
    setPage('therapist');
    setTherapistScreen('landing');
    setIsSidebarOpen(false);
    setMessages([]);
    setVerdict(null);
    setVibeCheckCount(0);
    setSessionStartTime(null);
  };

  const startNewChat = () => {
    setMessages([]);
    setTherapistScreen('landing');
    setPage('therapist');
    setVerdict(null);
    setVibeCheckCount(0);
    setCurrentChatId(null);
    setSessionStartTime(null);
    setIsSidebarOpen(false);
  };

  const startTherapist = () => {
    setSessionStartTime(Date.now());
    setTherapistScreen('vibe-check');
    setMessages([
      { 
        role: 'model', 
        text: `yo${user ? ' ' + user.name : ''}. i'm Rex. before we get into the mess, what's your name?`, 
        timestamp: Date.now() 
      }
    ]);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (text.length > 1000) return; // Client-side check

    // Relapse Detection
    const relapseKeywords = [
      "miss my ex", "go back", "want him back", "want her back", 
      "love him", "love her", "can't live without", "should i text", 
      "stalking", "checked their profile", "saw their story", 
      "unblock", "miss them", "miss him", "miss her", "still love",
      "regret breaking up", "want to call", "texting my ex",
      "reconcile", "give them another chance", "maybe they changed"
    ];
    const lowerText = text.toLowerCase();
    if (relapseKeywords.some(kw => lowerText.includes(kw))) {
      setIsRelapsing(true);
      setTimeout(() => setIsRelapsing(false), 5000);
      
      const ghostMessages = [
        "I see you're thinking about them again. Don't.",
        "Stop. Just stop.",
        "You're better than this.",
        "I'm getting stronger because you're getting weaker.",
        "Put the phone down.",
        "They haven't changed. You have."
      ];
      activateGhost(ghostMessages[Math.floor(Math.random() * ghostMessages.length)]);
      
      // If relapsing, healing percentage drops
      if (user) {
        const newHealing = Math.max(0, user.healing_percentage - 10);
        setUser({ ...user, healing_percentage: newHealing });
      }
    }
    
    const newUserMessage: Message = { role: 'user', text, timestamp: Date.now() };
    // Memory management: Limit client-side state to 100 messages
    const updatedMessages = [...messages, newUserMessage].slice(-100);
    setMessages(updatedMessages);
    setIsTyping(true);

    if (therapistScreen === 'vibe-check') {
      const nextCount = vibeCheckCount + 1;
      setVibeCheckCount(nextCount);

      const systemPrompt = `
        You are Rex, a brutally honest breakup buddy. 
        Ask name first, then one sneaky casual question per turn to detect their vibe.
        Detect: roast (delusional/in denial), real (genuinely hurting), hype (already bouncing back).
        After 3 user responses (including name), output VERDICT:roast or VERDICT:real or VERDICT:hype on its own line at the end.
        Keep messages to 1-2 sentences, funny and casual.

        CRITICAL: 
        - If they mention their ex is toxic, a narcissist, or crazy, you MUST append [RECOMMEND:SCANNER] to your response.
        - If they mention wanting to move on, stop stalking, or heal, you MUST append [RECOMMEND:GYM] to your response.
        - If they express wanting to get back with their ex, reconcile, or show extreme weakness/denial, you MUST append [GHOST:ACTIVATE] to your response.
      `;

      let response = await getGeminiResponse(updatedMessages, systemPrompt);
      
      setIsTyping(false);

      if (response.includes('[GHOST:ACTIVATE]')) {
        activateGhost("Rex senses you're slipping. Don't let the ghost win.");
        response = response.replace('[GHOST:ACTIVATE]', '').trim();
      }
      
      if (response.includes('VERDICT:')) {
        const v = response.split('VERDICT:')[1].trim().toLowerCase() as Verdict;
        setVerdict(v);
        const finalRexMsg = response.split('VERDICT:')[0].trim();
        const finalMessages: Message[] = [...updatedMessages, { role: 'model', text: finalRexMsg, timestamp: Date.now() }];
        setMessages(finalMessages);
        
        // Save chat if logged in and not guest
        if (user && user.id !== 0) {
          try {
            const res = await fetch('/api/save-chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: currentChatId, messages: finalMessages, verdict: v })
            });
            const data = await res.json();
            if (data.id) setCurrentChatId(data.id);
          } catch (e) {
            console.error("Save chat error:", e);
          }
        }

        setTimeout(() => {
          setTherapistScreen('analyzing');
          setTimeout(() => setTherapistScreen('result'), 2600);
        }, 1500);
      } else {
        const rexMessage: Message = { role: 'model', text: response, timestamp: Date.now() };
        setMessages(prev => [...prev, rexMessage]);
      }
    } else if (therapistScreen === 'chat') {
      const personaPrompt = `
        You are Rex, a brutally honest, funny, zero-BS best friend. 
        Mode: ${verdict}.
        Blunt, sarcastic, witty with real warmth.
        Lowercase sometimes, short punchy sentences: "bro", "nah", "lmaooo".
        No therapy-speak ever, no lists/bullets.
        2-4 sentence responses, ask one sharp follow-up.

        CRITICAL RECOMMENDATIONS:
        - If the user mentions needing to heal, get their life together, stop stalking, or moving on, you MUST include [RECOMMEND:GYM] at the end of your message.
        - If the user mentions their ex being toxic, narcissistic, crazy, or asks for a diagnosis of the other person, you MUST include [RECOMMEND:SCANNER] at the end of your message.
        - If the user expresses a desire to reconcile, get back together, or mentions they might text/call their ex, you MUST include [GHOST:ACTIVATE] at the end of your message.
        - Do not be shy. If there is even a hint of these topics, suggest the tool or activate the ghost.
      `;
      let response = await getGeminiResponse(updatedMessages, personaPrompt);
      setIsTyping(false);

      if (response.includes('[GHOST:ACTIVATE]')) {
        activateGhost("The ghost is haunting you because you're being weak. Snap out of it.");
        response = response.replace('[GHOST:ACTIVATE]', '').trim();
      }
      const rexMessage: Message = { role: 'model', text: response, timestamp: Date.now() };
      const finalMessages = [...updatedMessages, rexMessage];
      setMessages(finalMessages);

      // Auto-save in chat mode
      if (user && user.id !== 0) {
        fetch('/api/save-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentChatId, messages: finalMessages, verdict })
        }).then(res => res.json()).then(data => {
          if (data.id) setCurrentChatId(data.id);
        }).catch(e => console.error("Auto-save error:", e));
      }
    }
  };

  const startQuiz = () => {
    setPersonalityScreen('quiz');
    setQuizStep(0);
    setQuizAnswers([]);
    setPersonalityResult(null);
    setCurrentQuizId(null);
  };

  const handleQuizAnswer = async (answer: string) => {
    const newAnswers = [...quizAnswers, answer];
    setQuizAnswers(newAnswers);
    
    if (quizStep < 7) {
      setQuizStep(quizStep + 1);
    } else {
      setPersonalityScreen('analyzing');
      const result = await analyzePersonality({ text: newAnswers.join(', ') });
      setPersonalityResult(result);
      
      // Save quiz if logged in and not guest
      if (user && user.id !== 0 && result) {
        try {
          const res = await fetch('/api/save-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentQuizId, result })
          });
          const data = await res.json();
          if (data.id) setCurrentQuizId(data.id);
        } catch (e) {
          console.error("Save quiz error:", e);
        }
      }

      setTimeout(() => setPersonalityScreen('result'), 3000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast("Please upload an image file", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setUploadedImage({ data: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const startAnalysis = async () => {
    if (!uploadedImage) return;
    setPersonalityScreen('analyzing');
    try {
      const result = await analyzePersonality({ image: uploadedImage });
      setPersonalityResult(result);
      
      if (user && user.id !== 0 && result) {
        const res = await fetch('/api/save-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentQuizId, result })
        });
        const data = await res.json();
        if (data.id) setCurrentQuizId(data.id);
      }
      setTimeout(() => setPersonalityScreen('result'), 3000);
    } catch (e) {
      showToast("Analysis failed. Try again.", "error");
      setPersonalityScreen('landing');
    }
  };

    const fetchHistory = async () => {
      if (!user) {
        showToast("Please login to view history.", "error");
        return;
      }
      
      if (user.id === 0) {
        setHistory({ chats: [], quizzes: [] });
        setPage('history');
        setIsSidebarOpen(false);
        return;
      }

      setIsHistoryLoading(true);
      try {
        const [chatsRes, quizzesRes] = await Promise.all([
          fetch('/api/get-chats'),
          fetch('/api/get-quizzes')
        ]);
        
        if (!chatsRes.ok || !quizzesRes.ok) {
          const errorRes = !chatsRes.ok ? chatsRes : quizzesRes;
          if (errorRes.status === 401) {
            showToast("Session expired. Please login again.", "error");
            setUser(null);
            setPage('hub');
            return;
          }
          const errorData = await errorRes.json().catch(() => ({ error: "Failed to load history." }));
          showToast(errorData.error || "Failed to load history.", "error");
          return;
        }

        const chatsData = await chatsRes.json();
        const quizzesData = await quizzesRes.json();
        
        setHistory({ 
          chats: chatsData.chats || [], 
          quizzes: quizzesData.results || [] 
        });
        setPage('history');
      } catch (e) {
        console.error("History fetch error:", e);
        showToast("Connection error. Check your internet.", "error");
      } finally {
        setIsHistoryLoading(false);
        setIsSidebarOpen(false);
      }
    };

    const deleteChat = async (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      if (!confirm("Delete this chat forever? Rex won't remember you were this pathetic.")) return;
      try {
        const res = await fetch(`/api/delete-chat/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setHistory(prev => ({ ...prev, chats: prev.chats.filter(c => c.id !== id) }));
          showToast("Chat deleted. Like it never happened.");
        }
      } catch (e) {
        showToast("Failed to delete chat.", "error");
      }
    };

    const deleteQuiz = async (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      if (!confirm("Delete this scan?")) return;
      try {
        const res = await fetch(`/api/delete-quiz/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setHistory(prev => ({ ...prev, quizzes: prev.quizzes.filter(q => q.id !== id) }));
          showToast("Scan deleted.");
        }
      } catch (e) {
        showToast("Failed to delete scan.", "error");
      }
    };


  // --- Render Helpers ---

  const renderTherapist = () => {
    if (!user && therapistScreen !== 'landing') return (
      <AuthScreen 
        authMode={authMode}
        setAuthMode={setAuthMode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        name={name}
        setName={setName}
        code={code}
        setCode={setCode}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        setUser={setUser}
        messages={messages}
        verdict={verdict}
        currentChatId={currentChatId}
        setCurrentChatId={setCurrentChatId}
        personalityResult={personalityResult}
        currentQuizId={currentQuizId}
        setCurrentQuizId={setCurrentQuizId}
        showToast={showToast}
      />
    );
    switch (therapistScreen) {
      case 'landing':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6"
          >
            <div className="w-20 h-20 bg-rex-red rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(255,71,87,0.6)]">
              <span className="text-5xl font-arsenal font-bold text-black">Tx</span>
            </div>
            <h1 className="text-7xl md:text-9xl font-arsenal font-bold mb-4 tracking-tighter flex justify-center overflow-hidden">
              {"TherapEx".split("").map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  transition={{ 
                    duration: 0.5, 
                    delay: i * 0.08,
                    ease: [0.33, 1, 0.68, 1]
                  }}
                  className={i < 6 ? "text-white" : "text-rex-red"}
                >
                  {char}
                </motion.span>
              ))}
            </h1>
            <p className="text-xl md:text-2xl text-white/60 mb-8 max-w-md">your brutally honest breakup buddy</p>
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              {["no therapy-speak", "no hotlines", "just the truth"].map(pill => (
                <span key={pill} className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs uppercase tracking-widest text-white/40">
                  {pill}
                </span>
              ))}
            </div>
            <Button onClick={startTherapist} className="text-lg px-10 py-5">
              let Rex figure you out →
            </Button>
          </motion.div>
        );
      
      case 'vibe-check':
        return (
          <div className="flex flex-col h-[90vh] max-w-2xl mx-auto px-4">
            <header className="py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rex-red rounded-xl flex items-center justify-center">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold">Rex</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-rex-red rounded-full animate-pulse" />
                    <span className="text-[10px] uppercase tracking-widest text-white/40">reading you</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(vibeCheckCount / 3) * 100}%` }}
                    className="h-full bg-rex-red"
                  />
                </div>
                <Button 
                  variant="ghost" 
                  onClick={() => setShowFinishConfirm(true)}
                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rex-red border border-rex-red/20 hover:bg-rex-red/10 rounded-xl"
                >
                  Finish
                </Button>
              </div>
            </header>
            
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-hide">
              {messages.map((m, i) => (
                <ChatBubble 
                  key={i} 
                  message={m} 
                  isLast={i === messages.length - 1} 
                  onNavigate={(p) => setPage(p)}
                />
              ))}
              {isTyping && (
                <div className="flex gap-1 p-4 bg-bubble-rex rounded-2xl w-16">
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              )}
            </div>

            <ChatInput onSend={handleSendMessage} disabled={isTyping} />
            {isGhostMode && <GhostOverlay intensity={ghostIntensity} message={ghostMessage} />}
          </div>
        );

      case 'analyzing':
        return (
          <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 360]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-20 h-20 bg-rex-red/20 rounded-3xl flex items-center justify-center mb-8 border border-rex-red/50"
            >
              <MessageCircle size={40} className="text-rex-red" />
            </motion.div>
            <h2 className="text-3xl md:text-4xl font-display font-black mb-2 uppercase tracking-tighter italic">Scanning your soul...</h2>
            <motion.p 
              key={vibeCheckCount}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-white/40 italic"
            >
              {["yikes, that's a lot of unread texts", "checking your 'hidden' folder", "scanning for delusional patterns", "reading between the lines... literally"][Math.floor(Math.random() * 4)]}
            </motion.p>
          </div>
        );

      case 'result':
        const resultData = {
          roast: { color: 'text-rex-red', bg: 'bg-rex-red/20', border: 'border-rex-red/30', icon: <Flame />, title: 'you need to be roasted', desc: "you're in deep denial. time for some cold water." },
          real: { color: 'text-rex-orange', bg: 'bg-rex-orange/20', border: 'border-rex-orange/30', icon: <Heart />, title: 'you need real talk', desc: "you're hurting, but you're strong. let's get real." },
          hype: { color: 'text-rex-yellow', bg: 'bg-rex-yellow/20', border: 'border-rex-yellow/30', icon: <Zap />, title: "you need to be reminded you're that one", desc: "you're already bouncing back. let's speed it up." }
        }[verdict || 'real'];

        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center"
          >
            <div className={`w-24 h-24 ${resultData.bg} rounded-full flex items-center justify-center mb-8 ${resultData.color} shadow-2xl`}>
              {resultData.icon}
            </div>
            <h2 className={`text-5xl md:text-7xl font-display font-black mb-4 uppercase tracking-tighter italic ${resultData.color}`}>
              {resultData.title}
            </h2>
            <p className="text-xl text-white/60 mb-6 max-w-md">{resultData.desc}</p>
            
            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-10 w-full max-w-md text-left">
              <span className="text-[10px] uppercase font-black text-rex-red mb-3 block tracking-widest italic">Rex's Notes:</span>
              <div className="space-y-3">
                {messages.filter(m => m.role === 'user').slice(-2).map((m, i) => (
                  <p key={i} className="text-sm italic text-white/60 border-l-2 border-rex-red/30 pl-3">
                    "{m.text}"
                  </p>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-4 w-full max-w-sm">
              <Button onClick={() => setTherapistScreen('chat')} className="w-full">
                yeah that's me. let's go →
              </Button>
              <div className="flex gap-2">
                {(['roast', 'real', 'hype'] as Verdict[]).filter(v => v !== verdict).map(v => (
                  <Button key={v} variant="secondary" onClick={() => setVerdict(v)} className="flex-1 text-xs py-2">
                    actually, {v} me
                  </Button>
                ))}
              </div>
              <Button variant="ghost" onClick={() => setPage('hub')} className="mt-4 flex items-center justify-center gap-2">
                <Brain size={16} /> explore Rex's other tools →
              </Button>
            </div>
          </motion.div>
        );

      case 'chat':
        return (
          <div className="flex flex-col h-[90vh] max-w-2xl mx-auto px-4">
            <header className="py-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => setTherapistScreen('landing')} className="p-2 min-w-0">
                  <ChevronLeft size={20} />
                </Button>
                <h3 className="font-display font-bold">TherapEX</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                  verdict === 'roast' ? 'bg-rex-red/20 text-rex-red' : 
                  verdict === 'real' ? 'bg-rex-orange/20 text-rex-orange' : 
                  'bg-rex-yellow/20 text-rex-yellow'
                }`}>
                  {verdict} mode
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className={`p-2 rounded-xl transition-all flex items-center gap-2 border ${
                    isGhostMode 
                      ? 'bg-rex-red/10 border-rex-red/20 text-rex-red shadow-[0_0_15px_rgba(255,68,68,0.2)] cursor-pointer' 
                      : 'bg-white/5 border-white/5 text-white/20 cursor-default'
                  }`}
                  onClick={() => isGhostMode && setIsGhostMode(false)}
                  title={isGhostMode ? "Ghost Detected! Click to dismiss." : "Rex is sensing for ghosts..."}
                >
                  <img 
                    src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Ghost.png" 
                    alt="Ghost"
                    className={`w-4 h-4 object-contain ${isGhostMode ? 'animate-pulse' : 'opacity-20 grayscale'}`}
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-[10px] uppercase font-black tracking-widest hidden sm:inline">
                    {isGhostMode ? 'Ghost Detected' : 'Ghost Sensing'}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  onClick={() => setShowFinishConfirm(true)}
                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rex-red border border-rex-red/20 hover:bg-rex-red/10 rounded-xl"
                >
                  Finish Session
                </Button>
                <Button variant="ghost" onClick={() => setPage('hub')} className="p-2 min-w-0">
                  <Brain size={20} />
                </Button>
              </div>
            </header>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto py-6 space-y-4 scrollbar-hide">
              {messages.map((m, i) => (
                <ChatBubble key={i} message={m} isLast={i === messages.length - 1} />
              ))}
              {isTyping && (
                <div className="flex gap-1 p-4 bg-bubble-rex rounded-2xl w-16">
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              )}
            </div>

            {messages.length < 5 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {["Should I text them? 👀", "Was I the problem?", "I keep stalking their IG", "Will this feeling go away?"].map(chip => (
                  <button 
                    key={chip}
                    onClick={() => handleSendMessage(chip)}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            <ChatInput onSend={handleSendMessage} disabled={isTyping} />
            {isGhostMode && <GhostOverlay intensity={ghostIntensity} message={ghostMessage} />}
            
            <AnimatePresence>
              {showFinishConfirm && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-card border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl"
                  >
                    <div className="w-16 h-16 bg-rex-red/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rex-red">
                      <LogOut size={32} />
                    </div>
                    <h3 className="text-2xl font-display font-bold mb-3 uppercase italic">Wrap it up?</h3>
                    <p className="text-white/60 mb-8 text-sm">Rex will save your progress and give you your final stats for this session.</p>
                    <div className="flex flex-col gap-3">
                      <Button onClick={handleFinishSession} className="w-full">
                        Yes, I'm done for now
                      </Button>
                      <Button variant="secondary" onClick={() => setShowFinishConfirm(false)} className="w-full">
                        Wait, I have more to say
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
    }
  };

  const renderHub = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-6 py-12"
    >
      <header className="flex items-center justify-between mb-12">
        <Button variant="ghost" onClick={() => setPage('therapist')} className="p-2 min-w-0">
          <ChevronLeft size={24} />
        </Button>
        <div className="text-center">
          <h1 className="text-5xl font-display font-black uppercase tracking-tighter italic bg-gradient-to-r from-rex-red to-rex-orange bg-clip-text text-transparent">TherapEX's Lab</h1>
          {user && (
            <div className="flex flex-col items-center gap-2 mt-2">
              <p className="text-white/40 text-sm font-mono italic">Welcome back, {user.name}</p>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5 bg-rex-red/10 px-3 py-1 rounded-full border border-rex-red/20">
                  <Flame size={14} className="text-rex-red" />
                  <span className="text-xs font-display font-bold text-rex-red">{user.streak_count} DAY STREAK</span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <Heart size={14} className="text-emerald-500" />
                  <span className="text-xs font-display font-bold text-emerald-500">{user.healing_percentage}% HEALED</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {user ? (
            <>
              <Button variant="ghost" onClick={fetchHistory} className="p-2 min-w-0">
                <History size={20} />
              </Button>
              <Button variant="ghost" onClick={handleLogout} className="p-2 min-w-0 text-rex-red">
                <LogOut size={20} />
              </Button>
            </>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <HubCard 
          icon={<MessageCircle className="text-rex-red" />}
          title="Talk to Rex"
          desc="Get roasted, get real, or get hyped. Rex knows exactly what you need to hear."
          tag="chat · unlimited"
          onClick={() => setPage('therapist')}
        />
        <HubCard 
          icon={<Dumbbell className="text-emerald-500" />}
          title="Recovery Gym"
          desc="Stop stalking, start healing. Daily missions to get your life back together."
          tag="streak · daily"
          onClick={() => setPage('gym')}
        />
        <HubCard 
          icon={<Radio className="text-rex-red" />}
          title="Toxicity Scanner"
          desc="Upload a chat screenshot or take the quiz. Rex analyzes their toxicity and tells you exactly what you're dealing with."
          tag="scan · 1 min"
          onClick={() => setPage('personality')}
        />
        <HubCard 
          icon={<Brain className="text-rex-orange" />}
          title="Pattern Analyser"
          desc="Are you dating the same person in different bodies? Rex finds the trend across all your exes."
          tag="analysis · deep"
          onClick={() => setPage('pattern-analyser')}
        />
      </div>
    </motion.div>
  );

  const renderPersonality = () => {
    switch (personalityScreen) {
      case 'landing':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6"
          >
            <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-6">
              <Radio size={40} className="text-rex-red" />
            </div>
            <h1 className="text-5xl font-display font-bold mb-4">Toxicity Scanner</h1>
            <p className="text-white/40 mb-10 max-w-md mx-auto">
              Upload a screenshot of their most toxic texts or take the quiz about them. Rex will diagnose their toxicity level and tell you why you need to run.
            </p>

            <div className="flex flex-col gap-6 w-full max-w-md">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative group cursor-pointer border-2 border-dashed rounded-[32px] p-10 transition-all ${
                  uploadedImage ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-rex-red/50 hover:bg-white/5'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/*"
                />
                
                {uploadedImage ? (
                  <div className="flex flex-col items-center">
                    <div className="relative mb-4">
                      <img 
                        src={`data:${uploadedImage.mimeType};base64,${uploadedImage.data}`} 
                        alt="Preview" 
                        className="w-32 h-32 object-cover rounded-2xl border border-white/10"
                      />
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedImage(null);
                        }}
                        className="absolute -top-2 -right-2 bg-rex-red text-white p-1 rounded-full shadow-lg"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-emerald-500 font-bold uppercase tracking-widest text-xs">Screenshot Loaded</p>
                    <p className="text-white/20 text-[10px] uppercase tracking-widest mt-1">Rex assumes you're on the right, they're on the left.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="text-white/40 group-hover:text-rex-red" size={24} />
                    </div>
                    <p className="text-white font-bold uppercase tracking-widest text-xs mb-1">Upload Chat Screenshot</p>
                    <p className="text-white/20 text-[10px] uppercase tracking-widest">PNG, JPG up to 10MB</p>
                  </div>
                )}
              </div>

              {uploadedImage ? (
                <Button onClick={startAnalysis} className="text-lg py-6">
                  Analyze This Mess →
                </Button>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4 my-2">
                    <div className="h-px flex-1 bg-white/5" />
                    <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold">OR</span>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                  <Button onClick={startQuiz} variant="secondary" className="text-lg py-6">
                    Take the Quiz Instead
                  </Button>
                </div>
              )}

              <Button variant="ghost" onClick={() => setPage('hub')}>
                back to hub
              </Button>
            </div>
          </motion.div>
        );

      case 'quiz':
        const questions = [
          { q: "how often do they 'forget' to reply but stay active on social media?", a: ["all the time, it's a power move", "occasionally, they're 'busy'", "rarely, they're actually decent", "they don't, they're obsessed"] },
          { q: "when you bring up a problem, how do they react?", a: ["gaslight me until i apologize", "make it about their own problems", "listen but change nothing", "actually try to fix it (rare)"] },
          { q: "their texting style is best described as:", a: ["hot and cold (mostly cold)", "one-word answers only", "love bombing then ghosting", "consistent but boring"] },
          { q: "how many 'crazy exes' do they claim to have?", a: ["literally all of them are 'crazy'", "a suspicious amount", "one or two", "none, they're the crazy one"] },
          { q: "do they ever apologize without a 'but'?", a: ["never, it's always my fault", "only when they want something", "rarely, but it feels fake", "yes, actually"] },
          { q: "how do they handle your success?", a: ["they get competitive or jealous", "they ignore it completely", "they make it about them", "they're actually supportive"] },
          { q: "what's their favorite manipulation tactic?", a: ["the silent treatment", "guilt tripping", "playing the victim", "all of the above"] },
          { q: "if you left them today, what would they do?", a: ["stalk me for months", "immediately find a replacement", "threaten to do something drastic", "probably not even notice"] }
        ];
        
        return (
          <div className="max-w-xl mx-auto px-6 py-12">
            <div className="mb-12">
              <div className="flex justify-between items-end mb-4">
                <span className="text-rex-red font-display font-bold text-2xl">0{quizStep + 1}</span>
                <span className="text-white/20 text-xs uppercase tracking-widest">Question {quizStep + 1} of 8</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${((quizStep + 1) / 8) * 100}%` }}
                  className="h-full bg-rex-red"
                />
              </div>
            </div>

            <h2 className="text-3xl font-display font-bold mb-10 leading-tight">
              {questions[quizStep].q}
            </h2>

            <div className="space-y-4">
              {questions[quizStep].a.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleQuizAnswer(option)}
                  className="w-full text-left px-6 py-5 bg-card border border-white/5 rounded-2xl hover:border-rex-red/50 hover:bg-white/5 transition-all group"
                >
                  <span className="text-white/80 group-hover:text-white">{option}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'analyzing':
        return (
          <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="mb-8"
            >
              <Radio size={60} className="text-rex-red" />
            </motion.div>
            <h2 className="text-3xl md:text-5xl font-display font-black mb-2 uppercase tracking-tighter italic">Analyzing your mess...</h2>
            <p className="text-white/40 italic">"this is worse than i thought"</p>
          </div>
        );

      case 'result':
        if (!personalityResult) return null;
        return (
          <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
            <header className="text-center mb-12">
              <span className="px-3 py-1 bg-rex-red/20 text-rex-red rounded-full text-[10px] uppercase font-bold tracking-widest mb-4 inline-block">
                The Result
              </span>
              <h1 className="text-5xl md:text-7xl font-display font-black uppercase tracking-tighter italic">{personalityResult.type}</h1>
              <p className="text-xl text-white/40 italic">{personalityResult.tagline}</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-white/5 p-6 rounded-3xl space-y-6">
                <h3 className="text-xs uppercase tracking-widest text-white/40 font-bold">Toxicity Levels</h3>
                <div className="space-y-4">
                  {Object.entries(personalityResult.score).map(([trait, score]) => (
                    <div key={trait}>
                      <div className="flex justify-between text-[10px] uppercase tracking-wider mb-1.5">
                        <span className="text-white/60">{trait}</span>
                        <span>{score}%</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          className="h-full bg-rex-red"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-rex-red/10 border border-rex-red/20 p-6 rounded-3xl">
                <div className="flex items-center gap-2 mb-4">
                  <Flame size={16} className="text-rex-red" />
                  <h3 className="text-xs uppercase tracking-widest text-rex-red font-bold">The Roast</h3>
                </div>
                <p className="text-white/80 leading-relaxed">{personalityResult.roast}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Flag size={14} className="text-rex-red" />
                  <span className="text-[10px] uppercase font-bold text-white/40">Red Flag</span>
                </div>
                <p className="text-sm">{personalityResult.redFlag}</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-emerald-400" />
                  <span className="text-[10px] uppercase font-bold text-white/40">Green Flag</span>
                </div>
                <p className="text-sm">{personalityResult.greenFlag}</p>
              </div>
            </div>

            <div className="bg-card border border-white/5 p-8 rounded-3xl text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-rex-red opacity-50" />
              <h3 className="text-xs uppercase tracking-widest text-white/40 font-bold mb-4">Toxic Celebrity Match</h3>
              <p className="text-4xl font-display font-black uppercase tracking-tighter italic text-rex-red mb-2 group-hover:scale-105 transition-transform duration-500">{personalityResult.celebrity}</p>
              <p className="text-white/60 text-sm italic max-w-md mx-auto">"{personalityResult.celebrityWhy}"</p>
              
              <div className="flex justify-center gap-2 mt-8">
                <Button onClick={() => setPage('hub')} variant="secondary">Back to Lab</Button>
                <Button onClick={() => setPage('therapist')}>Talk to Rex</Button>
              </div>
            </div>
          </div>
        );
    }
  };

  const renderPatternAnalyser = () => {
    const handleAddEx = () => {
      if (newExName.trim()) {
        setExes([...exes, { id: Math.random().toString(36).substr(2, 9), name: newExName.trim(), screenshots: [] }]);
        setNewExName('');
        setIsAddingEx(false);
      }
    };

    const handleRemoveEx = (id: string) => {
      setExes(exes.filter(ex => ex.id !== id));
    };

    const handleUploadScreenshot = (exId: string) => {
      setActiveExId(exId);
      patternFileInputRef.current?.click();
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !activeExId) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setExes(prev => prev.map(ex => 
          ex.id === activeExId 
            ? { ...ex, screenshots: [...ex.screenshots, { data: base64, mimeType: file.type }] }
            : ex
        ));
        setActiveExId(null);
      };
      reader.readAsDataURL(file);
    };

    const startPatternAnalysis = async () => {
      if (exes.length < 2) {
        showToast("You need at least 2 exes to find a pattern. Don't be shy.", "error");
        return;
      }
      if (exes.some(ex => ex.screenshots.length === 0)) {
        showToast("Each ex needs at least one screenshot. Rex needs evidence.", "error");
        return;
      }

      setIsAnalyzingPatterns(true);
      try {
        const result = await analyzePatterns(exes);
        setPatternResult(result);
      } catch (e) {
        showToast("Analysis failed. Rex is disappointed.", "error");
      } finally {
        setIsAnalyzingPatterns(false);
      }
    };

    if (isAnalyzingPatterns) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mb-8"
          >
            <Brain size={60} className="text-rex-orange" />
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-display font-black mb-2 uppercase tracking-tighter italic">Finding the trend...</h2>
          <p className="text-white/40 italic">"yep, you definitely have a type"</p>
        </div>
      );
    }

    if (patternResult) {
      return (
        <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
          <header className="text-center mb-12">
            <span className="px-3 py-1 bg-rex-orange/20 text-rex-orange rounded-full text-[10px] uppercase font-bold tracking-widest mb-4 inline-block">
              Pattern Analysis
            </span>
            <h1 className="text-5xl md:text-7xl font-display font-black uppercase tracking-tighter italic">The Verdict</h1>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-white/5 p-8 rounded-3xl space-y-8 flex flex-col">
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-widest text-white/40 font-bold">The Trend</h3>
                <p className="text-xl font-medium text-white/80 leading-relaxed">{patternResult.trend}</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-widest text-white/40 font-bold">Key Similarities</h3>
                <div className="grid grid-cols-1 gap-3">
                  {patternResult.similarities.map((sim, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div className="w-2 h-2 bg-rex-orange rounded-full" />
                      <p className="text-sm text-white/60">{sim}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-rex-orange/10 border border-rex-orange/20 p-8 rounded-3xl text-center flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rex-orange/10 blur-3xl -mr-16 -mt-16" />
              <h3 className="text-xs uppercase tracking-widest text-rex-orange font-bold mb-6">Your Ideal Type Guesser</h3>
              <p className="text-5xl font-display font-black uppercase tracking-tighter italic text-white mb-6 leading-none">{patternResult.idealType}</p>
              <div className="h-px bg-rex-orange/20 w-full mb-8" />
              <p className="text-lg text-white/80 italic leading-relaxed">"{patternResult.roast}"</p>
            </div>
          </div>

          <div className="flex justify-center gap-4 pt-4">
            <Button onClick={() => setPatternResult(null)} variant="secondary">Start Over</Button>
            <Button onClick={() => setPage('hub')}>Back to Lab</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-display font-black uppercase tracking-tighter italic mb-4">Pattern Analyser</h1>
          <p className="text-white/40 max-w-md mx-auto italic">"Let's see if you're just dating the same disaster in a different outfit."</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {exes.map(ex => (
            <div key={ex.id} className="bg-card border border-white/5 p-6 rounded-3xl relative group">
              <button 
                type="button"
                onClick={() => handleRemoveEx(ex.id)}
                className="absolute top-4 right-4 text-white/10 hover:text-rex-red transition-colors"
              >
                <X size={16} />
              </button>
              <h3 className="text-2xl font-display font-bold mb-4 truncate pr-8">{ex.name}</h3>
              
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {ex.screenshots.map((s, i) => (
                    <div key={i} className="w-12 h-12 rounded-lg overflow-hidden border border-white/10">
                      <img src={`data:${s.mimeType};base64,${s.data}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                  <button 
                    type="button"
                    onClick={() => handleUploadScreenshot(ex.id)}
                    className="w-12 h-12 rounded-lg bg-white/5 border border-dashed border-white/20 flex items-center justify-center text-white/20 hover:text-white hover:border-white/40 transition-all"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold">
                  {ex.screenshots.length} Screenshots added
                </p>
              </div>
            </div>
          ))}
          
          {isAddingEx ? (
            <div className="bg-card border border-rex-orange/30 rounded-3xl p-6 flex flex-col gap-4">
              <h3 className="text-xs uppercase tracking-widest text-rex-orange font-bold">New Ex Name</h3>
              <input 
                autoFocus
                type="text"
                value={newExName}
                onChange={(e) => setNewExName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddEx();
                  if (e.key === 'Escape') setIsAddingEx(false);
                }}
                placeholder="e.g. The Ghost"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rex-orange/50"
              />
              <div className="flex gap-2">
                <Button onClick={handleAddEx} className="flex-1 py-2 text-xs bg-rex-orange">Add</Button>
                <Button variant="ghost" onClick={() => setIsAddingEx(false)} className="flex-1 py-2 text-xs">Cancel</Button>
              </div>
            </div>
          ) : (
            <button 
              type="button"
              onClick={() => setIsAddingEx(true)}
              className="bg-white/5 border-2 border-dashed border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 hover:border-rex-orange/50 hover:bg-rex-orange/5 transition-all group"
            >
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/20 group-hover:text-rex-orange group-hover:scale-110 transition-all">
                <Plus size={24} />
              </div>
              <span className="text-xs uppercase font-black tracking-widest text-white/20 group-hover:text-white">Add Another Ex</span>
            </button>
          )}
        </div>

        <input 
          type="file" 
          ref={patternFileInputRef} 
          onChange={onFileChange} 
          className="hidden" 
          accept="image/*"
        />

        <div className="flex flex-col items-center gap-6">
          <Button 
            onClick={startPatternAnalysis} 
            disabled={exes.length < 2}
            className="text-lg px-12 py-6 bg-rex-orange hover:bg-rex-orange/80"
          >
            Analyse My Patterns →
          </Button>
          <Button variant="ghost" onClick={() => setPage('hub')}>back to hub</Button>
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-6 py-12"
    >
      <header className="flex items-center justify-between mb-12">
        <Button variant="ghost" onClick={() => setPage('hub')} className="p-2 min-w-0">
          <ChevronLeft size={24} />
        </Button>
        <h1 className="text-5xl font-display font-black uppercase tracking-tighter italic">Your History</h1>
        <Button 
          variant="ghost" 
          onClick={fetchHistory} 
          disabled={isHistoryLoading}
          className="p-2 min-w-0"
        >
          <RefreshCw size={20} className={isHistoryLoading ? 'animate-spin' : ''} />
        </Button>
      </header>

      {user.id === 0 && (
        <div className="bg-rex-red/10 border border-rex-red/20 p-6 rounded-3xl mb-12 text-center">
          <p className="text-rex-red font-bold uppercase tracking-widest text-xs mb-2">Guest Mode</p>
          <p className="text-white/60 text-sm">History is only saved for logged-in users. Create an account to keep your roasts forever.</p>
        </div>
      )}

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-display font-black mb-6 flex items-center gap-2 uppercase tracking-tighter italic">
            <MessageCircle className="text-rex-red" size={20} /> Past Roasts
          </h2>
          {isHistoryLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-rex-red" size={32} />
            </div>
          ) : history.chats.length === 0 ? (
            <p className="text-white/20 italic">No chats yet. Go talk to Rex.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.chats.map((chat: any) => (
                <div 
                  key={chat.id} 
                  onClick={() => {
                    setMessages(chat.messages);
                    setVerdict(chat.verdict);
                    setCurrentChatId(chat.id);
                    setSessionStartTime(Date.now());
                    setTherapistScreen('chat');
                    setPage('therapist');
                  }}
                  className="bg-card border border-white/5 p-5 rounded-2xl cursor-pointer hover:border-rex-red/30 transition-all group relative"
                >
                  <button 
                    onClick={(e) => deleteChat(e, chat.id)}
                    className="absolute top-4 right-4 p-1.5 text-white/10 hover:text-rex-red hover:bg-rex-red/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                  <div className="flex justify-between items-start mb-3 pr-8">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                      chat.verdict === 'roast' ? 'bg-rex-red/20 text-rex-red' : 
                      chat.verdict === 'real' ? 'bg-rex-orange/20 text-rex-orange' : 
                      'bg-rex-yellow/20 text-rex-yellow'
                    }`}>
                      {chat.verdict} mode
                    </span>
                    <span className="text-[10px] text-white/20">{new Date(chat.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-white/60 line-clamp-2 italic group-hover:text-white transition-colors">"{chat.messages[chat.messages.length - 1].text}"</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-display font-black mb-6 flex items-center gap-2 uppercase tracking-tighter italic">
            <Radio className="text-rex-red" size={20} /> Toxicity Scans
          </h2>
          {isHistoryLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-rex-red" size={32} />
            </div>
          ) : history.quizzes.length === 0 ? (
            <p className="text-white/20 italic">No scans yet. Rex is waiting.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.quizzes.map((q: any) => (
                <div 
                  key={q.id} 
                  onClick={() => {
                    setPersonalityResult(q.result);
                    setCurrentQuizId(q.id);
                    setPersonalityScreen('result');
                    setPage('personality');
                  }}
                  className="bg-card border border-white/5 p-5 rounded-2xl cursor-pointer hover:border-rex-red/30 transition-all group relative"
                >
                  <button 
                    onClick={(e) => deleteQuiz(e, q.id)}
                    className="absolute top-4 right-4 p-1.5 text-white/10 hover:text-rex-red hover:bg-rex-red/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                  <div className="flex justify-between items-start mb-2 pr-8">
                    <h3 className="font-display font-bold text-lg group-hover:text-rex-red transition-colors">{q.result.type}</h3>
                    <span className="text-[10px] text-white/20">{new Date(q.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-white/40 italic mb-3">{q.result.tagline}</p>
                  <div className="flex gap-1">
                    {Object.entries(q.result.score).slice(0, 3).map(([trait, score]: any) => (
                      <div key={trait} className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-rex-red" style={{ width: `${score}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );

  const renderGym = () => {
    if (!user) return (
      <AuthScreen 
        authMode={authMode}
        setAuthMode={setAuthMode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        name={name}
        setName={setName}
        code={code}
        setCode={setCode}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        setUser={setUser}
        messages={messages}
        verdict={verdict}
        currentChatId={currentChatId}
        setCurrentChatId={setCurrentChatId}
        personalityResult={personalityResult}
        currentQuizId={currentQuizId}
        setCurrentQuizId={setCurrentQuizId}
        showToast={showToast}
      />
    );
    
    return (
      <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-6 py-12"
    >
      <header className="flex items-center justify-between mb-12">
        <Button variant="ghost" onClick={() => setPage('hub')} className="p-2 min-w-0">
          <ChevronLeft size={24} />
        </Button>
        <h1 className="text-5xl font-display font-black uppercase tracking-tighter italic">Recovery Gym</h1>
        <div className="w-10" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-card border border-white/5 p-6 rounded-3xl text-center">
          <Flame size={32} className="text-rex-red mx-auto mb-3" />
          <h3 className="text-xs uppercase font-black text-white/40 tracking-widest mb-1">Current Streak</h3>
          <p className="text-4xl font-display font-black">{user?.streak_count || 0} DAYS</p>
        </div>
        <div className="bg-card border border-white/5 p-6 rounded-3xl text-center md:col-span-2">
          <div className="flex justify-between items-end mb-4">
            <div className="text-left">
              <h3 className="text-xs uppercase font-black text-white/40 tracking-widest mb-1">Healing Progress</h3>
              <p className="text-4xl font-display font-black text-emerald-500">{user?.healing_percentage || 0}%</p>
            </div>
            <Trophy size={32} className="text-rex-yellow" />
          </div>
          <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${user?.healing_percentage || 0}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-display font-black uppercase tracking-tighter italic">Daily Missions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {missions.map(mission => {
            const isCompleted = completedMissions.includes(mission.id);
            return (
              <div 
                key={mission.id}
                className={`p-6 rounded-3xl border transition-all ${
                  isCompleted 
                    ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' 
                    : 'bg-card border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    isCompleted ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-white/60'
                  }`}>
                    {mission.icon}
                  </div>
                  {isCompleted ? (
                    <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full">
                      <CheckCircle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Victory</span>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => setVerificationMission(mission)}
                      className="py-2.5 px-5 text-[11px] font-black uppercase tracking-tighter"
                      disabled={completingMissionId === mission.id}
                    >
                      {completingMissionId === mission.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        "I'm Stronger"
                      )}
                    </Button>
                  )}
                </div>
                <h3 className="text-xl font-display font-bold mb-1">{mission.title}</h3>
                <p className="text-white/40 text-sm">{mission.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-12 bg-rex-red/10 border border-rex-red/20 p-8 rounded-3xl text-center">
        <h3 className="text-xl font-display font-black uppercase tracking-tighter italic mb-2">Rex's Motivation</h3>
        <p className="text-white/60 italic">"Every day you don't check their profile is a day you win. Don't be a loser. Stay in the gym."</p>
      </div>
    </motion.div>
  );
};

  // --- Sidebar Component ---


  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <BackgroundGlow />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-16 h-16 bg-rex-red/20 rounded-2xl flex items-center justify-center border border-rex-red/50 shadow-[0_0_30px_rgba(255,71,87,0.3)]"
          >
            <span className="text-3xl font-arsenal font-bold text-rex-red">Tx</span>
          </motion.div>
          <div className="flex flex-col items-center">
            <h2 className="text-xl font-display font-black uppercase tracking-tighter italic text-white/80">Loading the Lab...</h2>
            <p className="text-white/20 text-xs uppercase tracking-widest mt-2">Rex is waking up</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex">
      <FloatingWords />
      <BackgroundGlow />
      
      <Sidebar 
        user={user!}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isMobile={isMobile}
        page={page}
        setPage={setPage}
        setTherapistScreen={setTherapistScreen}
        setPersonalityScreen={setPersonalityScreen}
        fetchHistory={fetchHistory}
        handleLogout={handleLogout}
        startNewChat={startNewChat}
      />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${user && !isMobile ? 'ml-[280px]' : ''}`}>
        {/* Mobile Header */}
        {user && isMobile && (
          <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-white/40 hover:text-white transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-rex-red rounded-lg flex items-center justify-center">
                <span className="text-sm font-arsenal font-bold text-black">Tx</span>
              </div>
            </div>
            <div className="w-8" /> {/* Spacer */}
          </header>
        )}

        <main className="relative z-10 pt-4 pb-20 flex-1">
          <AnimatePresence mode="wait">
            {page === 'therapist' && <div key="therapist">{renderTherapist()}</div>}
            {page === 'hub' && <div key="hub">{renderHub()}</div>}
            {page === 'personality' && <div key="personality">{renderPersonality()}</div>}
            {page === 'history' && <div key="history">{renderHistory()}</div>}
            {page === 'gym' && <div key="gym">{renderGym()}</div>}
            {page === 'pattern-analyser' && <div key="pattern-analyser">{renderPatternAnalyser()}</div>}
          </AnimatePresence>
        </main>

        {/* Verification Modal */}
        <AnimatePresence>
          {verificationMission && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setVerificationMission(null);
                  setVerificationProof('');
                  setVerificationError('');
                }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-card border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-rex-red" />
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-rex-red/20 rounded-2xl flex items-center justify-center text-rex-red">
                    {verificationMission.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-black uppercase tracking-tighter italic">Verify Mission</h3>
                    <p className="text-white/40 text-xs uppercase tracking-widest">{verificationMission.title}</p>
                  </div>
                </div>

                <p className="text-white/60 mb-6 italic text-sm">"Rex doesn't take your word for it. Tell me exactly what you did to complete this mission. If I think you're lying, you get nothing."</p>

                <div className="space-y-4">
                  <textarea
                    value={verificationProof}
                    onChange={(e) => setVerificationProof(e.target.value)}
                    placeholder="Describe your victory here..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 min-h-[120px] focus:outline-none focus:border-rex-red/50 transition-all text-sm text-white"
                  />
                  
                  {verificationError && (
                    <motion.p 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-rex-red text-xs font-bold uppercase italic"
                    >
                      {verificationError}
                    </motion.p>
                  )}

                  <div className="flex gap-3">
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setVerificationMission(null);
                        setVerificationProof('');
                        setVerificationError('');
                      }}
                      className="flex-1 py-4"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleVerifyMission}
                      disabled={isVerifying}
                      className="flex-1 py-4"
                    >
                      {isVerifying ? (
                        <div className="flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin" />
                          <span>Rex is thinking...</span>
                        </div>
                      ) : (
                        "Submit Proof"
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <motion.div 
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 20, x: '-50%' }}
              className={`fixed bottom-10 left-1/2 px-6 py-4 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 min-w-[300px] border ${
                toast.type === 'success' 
                  ? 'bg-emerald-500 border-emerald-400 text-white' 
                  : 'bg-rex-red border-red-400 text-white'
              }`}
              style={{ left: user && !isMobile ? 'calc(50% + 140px)' : '50%' }}
            >
              {toast.type === 'success' ? <Trophy size={20} /> : <Flame size={20} />}
              <p className="font-display font-bold text-xs uppercase tracking-tight">{toast.message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Sub-components ---

interface AuthScreenProps {
  authMode: 'login' | 'signup' | 'forgot' | 'verify' | 'reset';
  setAuthMode: (mode: 'login' | 'signup' | 'forgot' | 'verify' | 'reset') => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  name: string;
  setName: (val: string) => void;
  code: string;
  setCode: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  setUser: (user: User | null) => void;
  messages: Message[];
  verdict: Verdict | null;
  currentChatId: number | null;
  setCurrentChatId: (id: number | null) => void;
  personalityResult: PersonalityResult | null;
  currentQuizId: number | null;
  setCurrentQuizId: (id: number | null) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const AuthScreen = ({
  authMode, setAuthMode, email, setEmail, password, setPassword, name, setName,
  code, setCode, newPassword, setNewPassword, confirmPassword, setConfirmPassword,
  setUser, messages, verdict, currentChatId, setCurrentChatId, personalityResult,
  currentQuizId, setCurrentQuizId, showToast
}: AuthScreenProps) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setDemoCode(null);
    try {
      let endpoint = '';
      let body = {};

      if (authMode === 'login') {
        endpoint = '/api/login';
        body = { email, password };
      } else if (authMode === 'signup') {
        endpoint = '/api/signup';
        body = { email, password, name };
      } else if (authMode === 'forgot') {
        endpoint = '/api/forgot-password';
        body = { email };
      } else if (authMode === 'verify') {
        endpoint = '/api/verify-code';
        body = { email, code };
      } else if (authMode === 'reset') {
        if (newPassword !== confirmPassword) {
          setError("Passwords don't match");
          setLoading(false);
          return;
        }
        endpoint = '/api/reset-password';
        body = { email, code, newPassword };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (res.ok) {
        if (authMode === 'login' || authMode === 'signup') {
          setUser(data.user);
          // Save current chat if it has a verdict and wasn't saved (guest session)
          if (messages.length > 0 && verdict && !currentChatId) {
            fetch('/api/save-chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messages, verdict })
            }).then(r => r.json()).then(d => {
              if (d.id) setCurrentChatId(d.id);
            });
          }
          // Also save personality result if exists
          if (personalityResult && !currentQuizId) {
            fetch('/api/save-quiz', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ result: personalityResult })
            }).then(r => r.json()).then(d => {
              if (d.id) setCurrentQuizId(d.id);
            });
          }
        } else if (authMode === 'forgot') {
          if (data.demoCode) {
            setDemoCode(data.demoCode);
            showToast(`[DEMO MODE] Your code is: ${data.demoCode}`, "success");
          } else {
            showToast("Verification code sent to your email.", "success");
          }
          setAuthMode('verify');
        } else if (authMode === 'verify') {
          setAuthMode('reset');
        } else if (authMode === 'reset') {
          showToast("Password reset successfully. Please login.", "success");
          setAuthMode('login');
        }
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const renderTitle = () => {
    switch (authMode) {
      case 'signup': return 'Join the Lab';
      case 'forgot': return 'Reset Password';
      case 'verify': return 'Verify Code';
      case 'reset': return 'New Password';
      default: return 'Welcome Back';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto px-6 py-12 bg-card border border-white/5 rounded-[32px] shadow-2xl mt-10"
    >
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-rex-red/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="text-rex-red" size={32} />
        </div>
        <h2 className="text-3xl font-display font-black mb-2 uppercase tracking-tighter italic">{renderTitle()}</h2>
        <p className="text-white/40 text-sm">TherapEX is waiting to roast your life choices.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {authMode === 'signup' && (
          <div className="relative">
            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
            <input 
              type="text" 
              placeholder="Your Name" 
              required 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-rex-red/50"
            />
          </div>
        )}
        
        {(authMode === 'login' || authMode === 'signup' || authMode === 'forgot') && (
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
            <input 
              type="email" 
              placeholder="Email Address" 
              required 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-rex-red/50"
            />
          </div>
        )}

        {(authMode === 'login' || authMode === 'signup') && (
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
            <input 
              type="password" 
              placeholder="Password" 
              required 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-rex-red/50"
            />
          </div>
        )}

        {(authMode === 'verify' || authMode === 'reset') && (
          <div className="space-y-4">
            <div className="relative">
              <CheckCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input 
                type="text" 
                placeholder="6-Digit Code" 
                required 
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-rex-red/50 tracking-[0.5em] font-mono text-center"
              />
            </div>
            {demoCode && authMode === 'verify' && (
              <div className="bg-rex-red/10 border border-rex-red/20 p-4 rounded-xl text-center">
                <p className="text-[10px] uppercase font-bold text-rex-red mb-1">Demo Mode Active</p>
                <p className="text-xl font-black text-white tracking-[5px]">{demoCode}</p>
                <p className="text-[10px] text-white/40 mt-2 italic">Copy this code to proceed (Gmail service not configured or failed)</p>
              </div>
            )}
          </div>
        )}

        {authMode === 'reset' && (
          <>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input 
                type="password" 
                placeholder="New Password" 
                required 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-rex-red/50"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input 
                type="password" 
                placeholder="Confirm New Password" 
                required 
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-rex-red/50"
              />
            </div>
          </>
        )}

        {error && <p className="text-rex-red text-xs text-center">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full py-4">
          {loading ? <Loader2 className="animate-spin mx-auto" /> : (
            authMode === 'login' ? 'Login' : 
            authMode === 'signup' ? 'Sign Up' : 
            authMode === 'forgot' ? 'Send Code' : 
            authMode === 'verify' ? 'Verify Code' : 'Reset Password'
          )}
        </Button>
      </form>

      <div className="mt-6 text-center space-y-4">
        {authMode === 'login' && (
          <button 
            onClick={() => {
              setDemoCode(null);
              setAuthMode('forgot');
            }}
            className="text-rex-red text-xs hover:underline transition-all block w-full"
          >
            Forgot Password?
          </button>
        )}

        <button 
          onClick={() => {
            setDemoCode(null);
            if (authMode === 'forgot' || authMode === 'verify' || authMode === 'reset') {
              setAuthMode('login');
            } else {
              setAuthMode(authMode === 'login' ? 'signup' : 'login');
            }
          }}
          className="text-white/40 text-sm hover:text-white transition-colors block w-full"
        >
          {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Login"}
        </button>
        
        <div className="pt-4 border-t border-white/5">
          <button 
            onClick={() => setUser({ id: 0, name: 'Guest', email: 'guest@therapex.lab', streak_count: 0, healing_percentage: 0 })}
            className="w-full py-3 rounded-xl bg-white/5 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <UserIcon size={14} />
            Continue as Guest
          </button>
        </div>
      </div>
    </motion.div>
  );
};

interface SidebarProps {
  user: User;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (val: boolean) => void;
  isMobile: boolean;
  page: Page;
  setPage: (page: Page) => void;
  setTherapistScreen: (screen: TherapistScreen) => void;
  setPersonalityScreen: (screen: PersonalityScreen) => void;
  fetchHistory: () => void;
  handleLogout: () => void;
  startNewChat: () => void;
}

const Sidebar = ({
  user, isSidebarOpen, setIsSidebarOpen, isMobile, page, setPage,
  setTherapistScreen, setPersonalityScreen, fetchHistory, handleLogout, startNewChat
}: SidebarProps) => {
  if (!user) return null;

  const navItems = [
    { id: 'therapist', label: 'Talk to Rex', icon: <MessageCircle size={18} /> },
    { id: 'personality', label: 'Toxicity Scanner', icon: <Radio size={18} /> },
    { id: 'pattern-analyser', label: 'Pattern Analyser', icon: <Brain size={18} /> },
    { id: 'gym', label: 'Recovery Gym', icon: <Dumbbell size={18} /> },
    { id: 'history', label: 'History', icon: <History size={18} /> },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.aside
        initial={false}
        animate={{ 
          x: isSidebarOpen || !isMobile ? 0 : -300,
        }}
        className={`fixed left-0 top-0 h-full bg-card border-r border-white/5 z-[70] flex flex-col transition-all duration-300 overflow-hidden w-[280px]`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 bg-rex-red rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,71,87,0.3)]">
            <span className="text-xl font-arsenal font-bold text-black">Tx</span>
          </div>
          <span className="text-xl font-arsenal font-bold tracking-tighter">
            <span className="text-white">Therap</span>
            <span className="text-rex-red">Ex</span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group bg-rex-red/5 text-white hover:bg-rex-red/10 mb-6 border border-rex-red/20"
          >
            <Plus size={18} className="text-rex-red" />
            <span className="text-sm font-bold uppercase tracking-tight">New Chat</span>
          </button>

          <div className="text-[10px] uppercase tracking-widest text-white/20 font-bold px-2 mb-4">Navigation</div>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'history') {
                  fetchHistory();
                } else {
                  setPage(item.id as Page);
                  if (item.id === 'therapist') setTherapistScreen('landing');
                  if (item.id === 'personality') setPersonalityScreen('landing');
                  setIsSidebarOpen(false);
                }
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                page === item.id 
                  ? 'bg-rex-red/10 text-rex-red border border-rex-red/20' 
                  : 'text-white/40 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={`${page === item.id ? 'text-rex-red' : 'text-white/20 group-hover:text-rex-red'} transition-colors`}>
                {item.icon}
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 space-y-4">
          {/* User Stats */}
          <div className="bg-white/5 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-rex-red" />
                <span className="text-[10px] uppercase font-bold text-white/40">Streak</span>
              </div>
              <span className="text-xs font-bold text-rex-red">{user.streak_count} Days</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] uppercase font-bold text-white/40">
                <span>Healing</span>
                <span>{user.healing_percentage}%</span>
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500" 
                  style={{ width: `${user.healing_percentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* User Profile */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-rex-red/20 flex items-center justify-center text-rex-red flex-shrink-0">
                <UserIcon size={14} />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-white truncate">{user.name}</span>
                <span className="text-[10px] text-white/20 truncate">{user.email}</span>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-white/20 hover:text-rex-red transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

const ChatInput = ({ onSend, disabled }: { onSend: (text: string) => void, disabled?: boolean }) => {
  const [input, setInput] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative mt-auto py-4">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        placeholder="Type your mess here..."
        maxLength={1000}
        className="w-full bg-card border border-white/10 rounded-2xl px-5 py-4 pr-16 text-sm focus:outline-none focus:border-rex-red/50 transition-colors resize-none h-14"
        disabled={disabled}
      />
      <div className="absolute right-16 bottom-6 text-[8px] text-white/10 uppercase font-black">
        {input.length}/1000
      </div>
      <button 
        type="submit"
        disabled={!input.trim() || disabled}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-rex-red rounded-xl flex items-center justify-center text-white disabled:opacity-30 disabled:grayscale transition-all"
      >
        <Send size={18} />
      </button>
    </form>
  );
};

const HubCard = ({ icon, title, desc, tag, onClick, disabled }: { icon: any, title: string, desc: string, tag: string, onClick?: () => void, disabled?: boolean }) => (
  <motion.div
    whileHover={!disabled ? { y: -8, scale: 1.02 } : {}}
    onClick={!disabled ? onClick : undefined}
    className={`bg-card border border-white/5 p-8 rounded-[40px] transition-all cursor-pointer group relative overflow-hidden ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-rex-red/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]'}`}
  >
    {!disabled && (
      <div className="absolute top-0 right-0 w-32 h-32 bg-rex-red/5 blur-3xl -mr-16 -mt-16 group-hover:bg-rex-red/10 transition-all" />
    )}
    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-8 transition-all ${disabled ? 'bg-white/5 text-white/20' : 'bg-white/5 text-rex-red group-hover:bg-rex-red group-hover:text-white shadow-xl'}`}>
      {React.cloneElement(icon as React.ReactElement, { size: 32 })}
    </div>
    <div className="flex justify-between items-start mb-3">
      <h3 className="text-3xl font-display font-black uppercase tracking-tighter italic">{title}</h3>
      <span className="text-[10px] uppercase tracking-widest text-white/40 font-black bg-white/5 px-3 py-1.5 rounded-full border border-white/10">{tag}</span>
    </div>
    <p className="text-white/40 leading-relaxed font-medium">{desc}</p>
    {!disabled && (
      <div className="mt-6 flex items-center gap-2 text-rex-red font-display font-black text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
        Enter <ArrowRight size={14} />
      </div>
    )}
  </motion.div>
);

const GhostOverlay = ({ intensity, message }: { intensity: number, message: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: "80vw", y: "20vh" }}
      animate={{ 
        opacity: [0.2, 0.5, 0.3, 0.6, 0.2],
        x: ["80vw", "10vw", "50vw", "20vw", "80vw"],
        y: ["20vh", "70vh", "40vh", "80vh", "20vh"],
        scale: [1, 1.1, 0.9, 1.05, 1],
      }}
      transition={{ 
        opacity: { duration: 8, repeat: Infinity, ease: "linear" },
        x: { duration: 25, repeat: Infinity, ease: "easeInOut" },
        y: { duration: 30, repeat: Infinity, ease: "easeInOut" },
        scale: { duration: 10, repeat: Infinity, ease: "easeInOut" },
      }}
      className="fixed inset-0 z-[100] pointer-events-none flex flex-col items-center w-fit h-fit"
    >
      <div className="relative">
        <img 
          src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Ghost.png" 
          alt="Ghost"
          style={{ width: 80 + (intensity / 2), height: 'auto' }}
          className="drop-shadow-[0_0_25px_rgba(147,197,253,0.6)] filter brightness-110 contrast-110"
          referrerPolicy="no-referrer"
        />
        <motion.div 
          animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.2, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-16 h-6 bg-white/5 blur-xl rounded-full"
        />
      </div>
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.8, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="mt-4 bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl max-w-[180px] text-center shadow-2xl"
          >
            <p className="text-[10px] text-white/90 font-medium italic leading-relaxed">"{message}"</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
