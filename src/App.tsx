/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, MicOff, Send, Terminal, Shield, Cpu, Globe, Volume2, VolumeX, X, Minus, Square, 
  ExternalLink, Activity, Database, Lock, Brain, Sparkles, Image as ImageIcon, 
  Video, Music, MapPin, Search, LogIn, LogOut, User, Upload, FileSearch, Zap
} from 'lucide-react';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Jarvis3D } from './components/Jarvis3D';
import { MediaLab } from './components/MediaLab';
import { cn } from './lib/utils';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, query, orderBy, onSnapshot, limit, serverTimestamp } from 'firebase/firestore';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Message {
  id?: string;
  role: 'user' | 'jarvis';
  content: string;
  timestamp: Date;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
}

function Window({ title, children, className, icon: Icon }: { title: string, children: React.ReactNode, className?: string, icon?: any }) {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        flex: isMinimized ? '0 0 32px' : '1 1 0%'
      }}
      className={cn(
        "bg-black/60 backdrop-blur-xl border border-hud-accent/20 rounded-lg overflow-hidden flex flex-col shadow-[0_0_20px_rgba(0,212,255,0.05)] transition-all duration-300", 
        className,
        isMinimized && "h-8"
      )}
    >
      <div className="h-8 bg-hud-accent/10 border-b border-hud-accent/20 flex items-center justify-between px-3 select-none shrink-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-hud-accent" />}
          <span className="text-[10px] uppercase tracking-widest text-hud-accent font-bold">{title}</span>
        </div>
        <div className="flex gap-2">
          <Minus 
            className={cn("w-3 h-3 cursor-pointer transition-colors", isMinimized ? "text-hud-accent" : "text-hud-accent/40 hover:text-hud-accent")} 
            onClick={() => setIsMinimized(!isMinimized)}
          />
          <Square className="w-3 h-3 text-hud-accent/40 hover:text-hud-accent cursor-pointer" />
          <X className="w-3 h-3 text-hud-accent/40 hover:text-red-500 cursor-pointer" />
        </div>
      </div>
      <div className={cn("flex-1 overflow-hidden relative", isMinimized && "hidden")}>
        {children}
      </div>
    </motion.div>
  );
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [continuousListening, setContinuousListening] = useState(false);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [activeWindow, setActiveWindow] = useState<'chat' | 'lab'>('chat');
  const [systemStatus, setSystemStatus] = useState({
    cpu: 12,
    memory: 45,
    network: 'Stable',
    security: 'Active'
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Messages Listener
  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, `users/${user.uid}/messages`),
      orderBy('timestamp', 'asc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as Message[];
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [user]);

  // Initialize Speech
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = continuousListening;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        handleSend(transcript);
        if (!continuousListening) setIsListening(false);
      };
      
      recognition.onerror = (e: any) => {
        console.error("Speech Recognition Error:", e.error);
        if (e.error === 'not-allowed') {
          setMicPermission('denied');
          speak("Microphone access is restricted, Sir. Please check your browser permissions.");
        }
        if (e.error === 'network') {
          speak("Neural link interference detected, Sir. Please check your connection.");
        }
        setIsListening(false);
      };
      
      recognition.onend = () => {
        if (continuousListening && isListening) {
          recognition.start();
        } else {
          setIsListening(false);
        }
      };
      recognitionRef.current = recognition;
    }

    // Check mic permission
    navigator.permissions?.query({ name: 'microphone' as any }).then((result) => {
      setMicPermission(result.state as any);
      result.onchange = () => setMicPermission(result.state as any);
    });

    const synth = window.speechSynthesis;
    synthesisRef.current = synth;
    
    const loadVoices = () => { 
      const availableVoices = synth.getVoices();
      if (availableVoices.length > 0) {
        voicesRef.current = availableVoices;
      }
    };

    // Chrome needs this to load voices
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
    loadVoices();

    // Prime speech on first interaction to unlock audio context
    const primeSpeech = () => {
      const utterance = new SpeechSynthesisUtterance("");
      synth.speak(utterance);
      window.removeEventListener('click', primeSpeech);
      window.removeEventListener('keydown', primeSpeech);
    };
    window.addEventListener('click', primeSpeech);
    window.addEventListener('keydown', primeSpeech);

    const interval = setInterval(() => {
      setSystemStatus(prev => ({
        ...prev,
        cpu: Math.floor(Math.random() * 20) + 5,
        memory: Math.floor(Math.random() * 10) + 40
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      speak("Welcome back, Sir. Neural link established.");
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const logout = () => {
    speak("System shutting down, Sir. Have a pleasant evening.");
    signOut(auth);
  };

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !synthesisRef.current) return;
    
    // Ensure voices are loaded
    let voices = synthesisRef.current.getVoices();
    if (voices.length === 0) {
      // Fallback to ref if immediate getVoices is empty
      voices = voicesRef.current;
    } else {
      voicesRef.current = voices;
    }

    // Cancel any ongoing speech and resume if stuck
    synthesisRef.current.cancel();
    if (synthesisRef.current.paused) {
      synthesisRef.current.resume();
    }

    // Small delay to ensure cancel completes and engine resets
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Improved voice selection - looking for a more "Jarvis" like voice (British Male)
      const preferredVoice = voices.find(v => 
        v.name.includes('Google UK English Male') || 
        v.name.includes('Microsoft Mark') || 
        v.name.includes('Microsoft David') ||
        v.name.includes('Male') || 
        v.name.includes('en-GB') ||
        v.lang === 'en-GB'
      ) || voices[0];
      
      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.pitch = 0.8; 
      utterance.rate = 1.1;  
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
        console.error("Speech Synthesis Error:", e);
        setIsSpeaking(false);
        
        // If it failed and wasn't just interrupted, try a simpler fallback
        if (e.error !== 'interrupted') {
          synthesisRef.current?.cancel();
          setTimeout(() => {
            const fallback = new SpeechSynthesisUtterance(text);
            fallback.pitch = 0.8;
            fallback.rate = 1.1;
            fallback.onstart = () => setIsSpeaking(true);
            fallback.onend = () => setIsSpeaking(false);
            synthesisRef.current?.speak(fallback);
          }, 100);
        }
      };

      synthesisRef.current?.speak(utterance);
    }, 100);
  }, [voiceEnabled]);

  const handleSend = async (text: string = input, media?: { url: string, type: string }) => {
    if (!text.trim() && !media) return;
    if (!user) {
      alert("Please login to communicate with J.A.R.V.I.S., Sir.");
      return;
    }

    const userMsg: any = { 
      userId: user.uid,
      role: 'user', 
      content: text, 
      timestamp: serverTimestamp() 
    };
    if (media) {
      userMsg.mediaUrl = media.url;
      userMsg.mediaType = media.type;
    }

    await addDoc(collection(db, `users/${user.uid}/messages`), userMsg);
    setInput('');
    setIsThinking(true);

    try {
      // Determine model based on complexity and thinking mode
      let model = "gemini-3.1-flash-lite-preview"; // Default fast
      if (thinkingMode) model = "gemini-3.1-pro-preview";
      else if (text.length > 200 || media) model = "gemini-3.1-pro-preview";
      else if (text.toLowerCase().includes('search') || text.toLowerCase().includes('find')) model = "gemini-3-flash-preview";

      // Dynamically select tool based on query
      const useMaps = text.toLowerCase().match(/map|location|near|where is|directions|place|address/);
      const activeTool = useMaps ? { googleMaps: {} } : { googleSearch: {} };

      const response = await ai.models.generateContent({
        model: model,
        contents: [
          ...messages.slice(-10).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
          { role: 'user', parts: [
            { text: text },
            ...(media ? [{ inlineData: { data: media.url.split(',')[1], mimeType: media.type === 'image' ? 'image/jpeg' : 'video/mp4' } }] : [])
          ] }
        ],
        config: {
          systemInstruction: "You are J.A.R.V.I.S., a highly sophisticated AI assistant. You are polite, efficient, and slightly witty. Address the user as 'Boss'. You have access to real-time information via Google Search and Maps. Use them to provide accurate data. If thinking mode is enabled, provide deep, reasoned analysis. If speaking, be concise.",
          tools: [activeTool],
          thinkingConfig: thinkingMode ? { thinkingLevel: ThinkingLevel.HIGH } : undefined
        }
      });

      const jarvisText = response.text || "I'm sorry, Sir. I encountered an error.";
      const jarvisMsg: any = { 
        userId: user.uid,
        role: 'jarvis', 
        content: jarvisText, 
        timestamp: serverTimestamp() 
      };
      
      await addDoc(collection(db, `users/${user.uid}/messages`), jarvisMsg);
      speak(jarvisText);
    } catch (error) {
      console.error("Gemini Error:", error);
      const errorMsg = "I apologize, Sir. My neural link is experiencing interference.";
      await addDoc(collection(db, `users/${user.uid}/messages`), {
        userId: user.uid,
        role: 'jarvis',
        content: errorMsg,
        timestamp: serverTimestamp()
      });
      speak(errorMsg);
    } finally {
      setIsThinking(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const type = file.type.startsWith('image') ? 'image' : 'video';
      handleSend(`Analyze this ${type}, Sir.`, { url, type });
    };
    reader.readAsDataURL(file);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = continuousListening;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = (event: any) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
          handleSend(transcript);
          if (!continuousListening) setIsListening(false);
        };
        recognition.onerror = (e: any) => {
          console.error("Speech Recognition Error:", e.error);
          if (e.error === 'not-allowed') setMicPermission('denied');
          setIsListening(false);
        };
        recognition.onend = () => {
          if (continuousListening && isListening) {
            try {
              recognition.start();
            } catch (e) {
              console.error("Auto-restart failed:", e);
              setIsListening(false);
            }
          } else {
            setIsListening(false);
          }
        };
        recognitionRef.current = recognition;
      } else {
        alert("Speech recognition is not supported in this browser, Sir.");
        return;
      }
    }

    if (!recognitionRef.current) return;

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Stop Error:", e);
      }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.continuous = continuousListening;
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error("Recognition Start Error:", error);
        setIsListening(false);
        if (micPermission === 'prompt') requestMicPermission();
      }
    }
  };

  const requestMicPermission = async () => {
    try {
      // First, try to get the stream which triggers the browser prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // If successful, stop the tracks immediately as we only wanted the permission
      stream.getTracks().forEach(track => track.stop());
      setMicPermission('granted');
      speak("Microphone access granted, Sir. Neural link optimized.");
      
      // Re-initialize recognition to ensure it picks up the new permission
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    } catch (e: any) {
      console.error("Mic Permission Error:", e);
      setMicPermission('denied');
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        speak("Microphone access was denied, Sir. Please click the lock icon in the address bar and set Microphone to Allow, then refresh the interface.");
      } else {
        speak("I encountered an error accessing the microphone, Sir. Please ensure no other application is using it.");
      }
    }
  };

  return (
    <div className="h-screen w-screen bg-black text-hud-text font-sans overflow-hidden p-4 flex flex-col gap-4 relative">
      {/* Immersive 3D Background */}
      <div className="fixed inset-0 z-0">
        <Jarvis3D isListening={isListening} isThinking={isThinking} isSpeaking={isSpeaking} />
      </div>

      <div className="grid-overlay" />
      
      {/* Top HUD Bar */}
      <header className="h-14 border border-hud-accent/20 bg-black/60 backdrop-blur-md rounded-lg flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-6">
          <Shield className="w-5 h-5 text-hud-accent animate-pulse" />
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-[4px] text-hud-accent uppercase">J.A.R.V.I.S. OS</span>
            <span className="text-[9px] opacity-40 uppercase tracking-widest">Mark VII // {user ? `User: ${user.displayName}` : 'Guest Mode'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setVoiceEnabled(!voiceEnabled)} 
            className={cn("p-2 rounded border transition-all", voiceEnabled ? "bg-hud-accent/20 border-hud-accent/40 text-hud-accent" : "bg-red-500/10 border-red-500/40 text-red-500")}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <div className="flex bg-black/40 border border-hud-accent/20 rounded p-1">
            <button 
              onClick={() => setActiveWindow('chat')}
              className={cn("px-3 py-1 rounded text-[9px] uppercase tracking-widest transition-all", activeWindow === 'chat' ? "bg-hud-accent text-black font-bold" : "text-hud-accent/60 hover:text-hud-accent")}
            >
              Interface
            </button>
            <button 
              onClick={() => setActiveWindow('lab')}
              className={cn("px-3 py-1 rounded text-[9px] uppercase tracking-widest transition-all", activeWindow === 'lab' ? "bg-hud-accent text-black font-bold" : "text-hud-accent/60 hover:text-hud-accent")}
            >
              Stark Lab
            </button>
          </div>

          {micPermission !== 'granted' && (
            <button 
              onClick={() => {
                if (micPermission === 'denied') {
                  speak("Sir, you must manually reset the permission. Click the lock icon in your address bar, set Microphone to Allow, and then reload the page.");
                } else {
                  requestMicPermission();
                }
              }}
              className={cn(
                "px-3 py-1 rounded text-[9px] uppercase tracking-widest transition-all border",
                micPermission === 'denied' 
                  ? "bg-red-500/40 border-red-500 text-white animate-pulse cursor-help" 
                  : "bg-hud-accent/20 border-hud-accent/40 text-hud-accent hover:bg-hud-accent/30"
              )}
            >
              {micPermission === 'denied' ? 'Mic Blocked - Click for Help' : 'Enable Mic'}
            </button>
          )}

          <div className="h-8 w-[1px] bg-hud-accent/20 mx-2" />

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-hud-accent font-bold">{user.displayName}</span>
                <button onClick={logout} className="text-[8px] uppercase tracking-widest text-red-500 hover:text-red-400">Disconnect</button>
              </div>
              <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-hud-accent/40" />
            </div>
          ) : (
            <button onClick={login} className="flex items-center gap-2 px-4 py-2 bg-hud-accent/10 border border-hud-accent/40 rounded text-[10px] uppercase tracking-widest text-hud-accent hover:bg-hud-accent/20 transition-all">
              <LogIn className="w-3.5 h-3.5" />
              Authorize
            </button>
          )}
        </div>
      </header>

      {/* Main Desktop Area */}
      <div className="flex-1 grid grid-cols-12 grid-rows-6 gap-4 relative z-10 overflow-hidden">
        
        {/* Left Window: AI Core / Media Lab */}
        <div className="col-span-8 row-span-4 flex items-center justify-center relative overflow-hidden">
          <AnimatePresence mode="wait">
            {activeWindow === 'chat' ? (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center w-full h-full overflow-hidden"
              >
                {/* Visualizer is background */}
              </motion.div>
            ) : (
              <motion.div 
                key="lab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full h-full"
              >
                <MediaLab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Communication Log */}
        <Window title="Communication Log" icon={ExternalLink} className="col-span-4 row-span-6 bg-black/40 backdrop-blur-md">
          <div className="flex flex-col h-full">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {!user ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 text-center p-8">
                  <Lock className="w-12 h-12 mb-4" />
                  <p className="text-[10px] uppercase tracking-widest">Authorization Required</p>
                  <button onClick={login} className="mt-4 text-[9px] text-hud-accent underline">Sign in to view logs</button>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 text-center p-8">
                  <Terminal className="w-12 h-12 mb-4" />
                  <p className="text-[10px] uppercase tracking-widest">No Active Logs</p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
                    <span className="text-[8px] uppercase opacity-40 mb-1">[{msg.timestamp.toLocaleTimeString()}] {msg.role}</span>
                    <div className={cn("p-2 rounded text-[11px] leading-relaxed border max-w-full overflow-hidden", 
                      msg.role === 'user' ? "bg-hud-accent/5 border-hud-accent/20 text-hud-accent" : "bg-white/5 border-white/10 text-white")}>
                      {msg.mediaUrl && (
                        <div className="mb-2 rounded overflow-hidden border border-white/10">
                          {msg.mediaType === 'image' ? <img src={msg.mediaUrl} className="w-full" /> : <video src={msg.mediaUrl} className="w-full" />}
                        </div>
                      )}
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-hud-accent/20 bg-black/40">
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={user ? "Enter command..." : "Sign in to command..."}
                    disabled={!user}
                    className="flex-1 bg-hud-accent/5 border border-hud-accent/20 rounded py-2 px-3 text-xs focus:outline-none focus:border-hud-accent/50 transition-colors disabled:opacity-50"
                  />
                  {micPermission === 'denied' && (
                    <div className="absolute -top-10 left-0 right-0 bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] uppercase tracking-widest p-2 rounded backdrop-blur-md animate-bounce">
                      Mic Access Denied. Please enable in browser settings.
                    </div>
                  )}
                  <button 
                    type="button"
                    onClick={() => {
                      if (micPermission === 'denied') {
                        speak("I cannot access the microphone, Sir. Please click the lock icon in your browser's address bar and set Microphone to Allow.");
                        return;
                      }
                      toggleListening();
                    }}
                    disabled={!user}
                    className={cn(
                      "p-2 border rounded transition-all",
                      isListening 
                        ? "bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
                        : micPermission === 'denied'
                          ? "bg-red-500/10 border-red-500/20 text-red-500/50 cursor-help"
                          : "bg-hud-accent/10 border-hud-accent/20 text-hud-accent hover:bg-hud-accent/20",
                    )}
                    title={micPermission === 'denied' ? "Click for troubleshooting" : "Toggle Voice Input"}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 bg-hud-accent/10 border border-hud-accent/20 rounded text-hud-accent hover:bg-hud-accent/20"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,video/*" />
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setThinkingMode(!thinkingMode)}
                      className={cn("flex items-center gap-1 px-2 py-1 rounded text-[8px] uppercase tracking-widest border transition-all", 
                        thinkingMode ? "bg-hud-accent/20 border-hud-accent text-hud-accent" : "border-white/10 text-white/40")}
                    >
                      <Brain className="w-3 h-3" />
                      Thinking Mode
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const next = !continuousListening;
                        setContinuousListening(next);
                        if (next && !isListening) toggleListening();
                      }}
                      className={cn("flex items-center gap-1 px-2 py-1 rounded text-[8px] uppercase tracking-widest border transition-all", 
                        continuousListening ? "bg-hud-accent/20 border-hud-accent text-hud-accent" : "border-white/10 text-white/40")}
                    >
                      <Mic className={cn("w-3 h-3", continuousListening && "animate-pulse")} />
                      Voice Command Mode: {continuousListening ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <button type="submit" disabled={!user} className="text-hud-accent hover:scale-110 transition-transform disabled:opacity-50">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Window>

        {/* Bottom Center Area: Simplified */}
        <div className="col-span-8 row-span-2" />

      </div>

      {/* Footer Status Bar */}
      <footer className="h-6 flex items-center justify-between px-4 text-[8px] uppercase tracking-[2px] opacity-40 font-mono">
        <div className="flex gap-6">
          <span>OS: JARVIS_V7.4.2</span>
          <span>KERNEL: HYBRID_CORE_X64</span>
          <span>LOCATION: 40.7128° N, 74.0060° W</span>
        </div>
        <div className="flex gap-6">
          <span>ENCRYPTION: AES_256_GCM</span>
          <span>UPLINK: STABLE_V4</span>
          <span>© 2026 STARK INDUSTRIES</span>
        </div>
      </footer>
    </div>
  );
}
