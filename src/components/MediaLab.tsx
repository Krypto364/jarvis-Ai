import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Video, Music, Wand2, Download, Loader2, Type, Maximize2, X, Zap } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from '../lib/utils';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function MediaLab() {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'music'>('image');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ url: string; type: string } | null>(null);
  const [config, setConfig] = useState({
    aspectRatio: '16:9',
    quality: '1K',
    duration: '30s'
  });

  const generateImage = async () => {
    setIsGenerating(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: config.aspectRatio as any
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setResult({
            url: `data:image/png;base64,${part.inlineData.data}`,
            type: 'image'
          });
          break;
        }
      }
    } catch (error) {
      console.error("Image Gen Error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateVideo = async () => {
    setIsGenerating(true);
    try {
      const operation = await ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          aspectRatio: config.aspectRatio as any,
          resolution: '720p'
        }
      });

      let currentOp = operation;
      while (!currentOp.done) {
        await new Promise(r => setTimeout(r, 10000));
        currentOp = await ai.operations.get((currentOp as any).id || (currentOp as any).name);
      }

      if (currentOp.response?.generatedVideos?.[0]) {
        setResult({
          url: `data:video/mp4;base64,${currentOp.response.generatedVideos[0].video.videoBytes}`,
          type: 'video'
        });
      }
    } catch (error) {
      console.error("Video Gen Error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateMusic = async () => {
    setIsGenerating(true);
    try {
      const response = await ai.models.generateContentStream({
        model: config.duration === '30s' ? 'lyria-3-clip-preview' : 'lyria-3-pro-preview',
        contents: prompt,
      });

      let audioBase64 = "";
      let mimeType = "audio/wav";

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
            audioBase64 += part.inlineData.data;
          }
        }
      }

      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });
      setResult({ url: URL.createObjectURL(blob), type: 'audio' });
    } catch (error) {
      console.error("Music Gen Error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (!prompt) return;
    if (activeTab === 'image') generateImage();
    else if (activeTab === 'video') generateVideo();
    else if (activeTab === 'music') generateMusic();
  };

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-md">
      {/* Tabs */}
      <div className="flex border-b border-hud-accent/20 relative">
        {[
          { id: 'image', icon: ImageIcon, label: 'Visuals' },
          { id: 'video', icon: Video, label: 'Motion' },
          { id: 'music', icon: Music, label: 'Audio' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setResult(null);
            }}
            className={cn(
              "flex-1 py-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[3px] transition-all relative z-10",
              activeTab === tab.id ? "text-hud-accent" : "text-hud-accent/40 hover:text-hud-accent/60"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeTab"
                className="absolute inset-0 bg-hud-accent/10 border-b-2 border-hud-accent"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto scrollbar-thin">
        {/* Result Area */}
        <div className="aspect-video bg-black/80 border border-hud-accent/10 rounded-lg flex items-center justify-center relative overflow-hidden group shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.div 
                key="generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="relative">
                  <Loader2 className="w-12 h-12 text-hud-accent animate-spin" />
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-hud-accent rounded-full blur-xl"
                  />
                </div>
                <span className="text-[10px] uppercase tracking-[6px] text-hud-accent animate-pulse">Neural Synthesis in Progress...</span>
              </motion.div>
            ) : result ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full h-full flex items-center justify-center"
              >
                {result.type === 'image' && <img src={result.url} className="w-full h-full object-contain" />}
                {result.type === 'video' && <video src={result.url} controls autoPlay className="w-full h-full" />}
                {result.type === 'audio' && (
                  <div className="w-full px-10">
                    <audio src={result.url} controls className="w-full" />
                  </div>
                )}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  <button onClick={() => setResult(null)} className="p-2 bg-black/80 rounded border border-hud-accent/20 text-hud-accent hover:bg-hud-accent/20">
                    <X className="w-4 h-4" />
                  </button>
                  <a href={result.url} download={`jarvis-${activeTab}`} className="p-2 bg-black/80 rounded border border-hud-accent/20 text-hud-accent hover:bg-hud-accent/20">
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.2 }}
                className="text-center"
              >
                <Wand2 className="w-16 h-16 mx-auto mb-4" />
                <p className="text-[12px] uppercase tracking-[6px]">Awaiting Neural Parameters</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Config & Prompt */}
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] uppercase tracking-widest text-hud-accent/60 flex items-center gap-2">
                <Maximize2 className="w-3 h-3" /> Aspect Ratio
              </label>
              <select 
                value={config.aspectRatio}
                onChange={(e) => setConfig({...config, aspectRatio: e.target.value})}
                className="w-full bg-black/60 border border-hud-accent/20 rounded-md px-3 py-2 text-[11px] text-hud-accent outline-none focus:border-hud-accent/50 transition-colors cursor-pointer"
              >
                {['1:1', '16:9', '9:16', '4:3', '3:2', '21:9'].map(r => <option key={r} value={r} className="bg-black">{r}</option>)}
              </select>
            </div>
            {activeTab === 'image' && (
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest text-hud-accent/60 flex items-center gap-2">
                  <Zap className="w-3 h-3" /> Resolution
                </label>
                <select 
                  value={config.quality}
                  onChange={(e) => setConfig({...config, quality: e.target.value})}
                  className="w-full bg-black/60 border border-hud-accent/20 rounded-md px-3 py-2 text-[11px] text-hud-accent outline-none focus:border-hud-accent/50 transition-colors cursor-pointer"
                >
                  {['512px', '1K', '2K', '4K'].map(q => <option key={q} value={q} className="bg-black">{q}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[9px] uppercase tracking-widest text-hud-accent/60 flex items-center gap-2">
              <Type className="w-3 h-3" /> Neural Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your vision, Boss..."
              className="w-full h-32 bg-black/60 border border-hud-accent/20 rounded-lg p-4 text-sm text-hud-accent outline-none resize-none placeholder:text-hud-accent/20 focus:border-hud-accent/50 transition-colors"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt}
            className="w-full py-4 bg-hud-accent/10 border border-hud-accent/40 text-hud-accent text-[11px] uppercase tracking-[6px] hover:bg-hud-accent/20 disabled:opacity-50 transition-all rounded-lg relative overflow-hidden group"
          >
            <span className="relative z-10">{isGenerating ? "Processing Neural Link..." : "Initiate Synthesis"}</span>
            <motion.div 
              className="absolute inset-0 bg-hud-accent/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
