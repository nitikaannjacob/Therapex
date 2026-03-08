import React from "react";
import { motion } from "motion/react";
import { Message, Page } from "../types";
import { Dumbbell, Radio, ArrowRight } from "lucide-react";

interface ChatBubbleProps {
  message: Message;
  isLast?: boolean;
  onNavigate?: (page: Page) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isLast, onNavigate }) => {
  const isRex = message.role === 'model';
  
  const renderContent = () => {
    let text = message.text;
    const recommendations: { type: 'GYM' | 'SCANNER', text: string }[] = [];

    const gymRegex = /\[RECOMMEND:GYM\]/i;
    const scannerRegex = /\[RECOMMEND:SCANNER\]/i;
    const sessionEndedRegex = /\[SESSION ENDED at (.*?)\](.*?)(?=\sRex has saved|$)/i;

    const isSessionEnded = sessionEndedRegex.test(text);
    let sessionTime = "";
    let duration = "";
    if (isSessionEnded) {
      const match = text.match(sessionEndedRegex);
      sessionTime = match ? match[1] : "";
      duration = match ? match[2].trim() : "";
      text = text.replace(sessionEndedRegex, "").trim();
    }

    if (gymRegex.test(text)) {
      recommendations.push({ type: 'GYM', text: 'Go to Recovery Gym' });
      text = text.replace(gymRegex, '').trim();
    }
    if (scannerRegex.test(text)) {
      recommendations.push({ type: 'SCANNER', text: 'Run Toxicity Scanner' });
      text = text.replace(scannerRegex, '').trim();
    }

    if (isSessionEnded) {
      return (
        <div className="flex flex-col items-center justify-center py-4 px-2 border-y border-white/5 my-4 bg-white/5 rounded-xl">
          <div className="flex items-center gap-2 text-rex-red mb-1">
            <div className="w-2 h-2 bg-rex-red rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Session Ended</span>
          </div>
          {duration && (
            <div className="text-[10px] font-mono text-white/40 mb-2 bg-white/5 px-2 py-0.5 rounded">
              {duration}
            </div>
          )}
          <p className="text-xs text-white/60 text-center italic">{text}</p>
          <span className="text-[8px] text-white/20 mt-2 uppercase tracking-tighter">Logged at {sessionTime}</span>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p>{text}</p>
        {recommendations.length > 0 && onNavigate && (
          <div className="flex flex-col gap-2 pt-1">
            {recommendations.map((rec, idx) => (
              <button
                key={idx}
                onClick={() => onNavigate(rec.type === 'GYM' ? 'gym' : 'personality')}
                className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all group text-left"
              >
                <div className="flex items-center gap-2">
                  {rec.type === 'GYM' ? <Dumbbell size={14} className="text-emerald-400" /> : <Radio size={14} className="text-rex-red" />}
                  <span className="text-xs font-bold uppercase tracking-wider">{rec.text}</span>
                </div>
                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex w-full mb-4 ${isRex ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm md:text-base ${
          isRex 
            ? 'bg-bubble-rex text-white rounded-bl-none border border-white/5 shadow-lg' 
            : 'bg-bubble-user text-white rounded-br-none border border-white/10'
        }`}
      >
        {renderContent()}
        {isRex && isLast && (
          <div className="mt-1 flex gap-1 opacity-60 text-xs">
            {['💀', '😭', '🔥', '👀', '💯', '😂'][Math.floor(Math.random() * 6)]}
          </div>
        )}
      </div>
    </motion.div>
  );
};
