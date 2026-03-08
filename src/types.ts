export interface User {
  id: number;
  email: string;
  name: string;
  streak_count: number;
  healing_percentage: number;
  last_activity_date?: string;
}

export type Page = 'therapist' | 'hub' | 'personality' | 'history' | 'gym' | 'pattern-analyser';

export interface Ex {
  id: string;
  name: string;
  screenshots: { data: string; mimeType: string }[];
}

export interface PatternAnalysisResult {
  trend: string;
  similarities: string[];
  idealType: string;
  roast: string;
}

export type TherapistScreen = 'landing' | 'vibe-check' | 'analyzing' | 'result' | 'chat';

export type PersonalityScreen = 'landing' | 'quiz' | 'analyzing' | 'result';

export type Verdict = 'roast' | 'real' | 'hype';

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface PersonalityResult {
  type: string;
  tagline: string;
  score: {
    overthink: number;
    chaos: number;
    empathy: number;
    ambition: number;
    avoidance: number;
  };
  roast: string;
  truth: string;
  redFlag: string;
  greenFlag: string;
  energy: string;
  compatibility: string[];
  avoid: string;
  celebrity: string;
}

export interface QuizAnswer {
  trait: 'overthink' | 'chaos' | 'empathy' | 'ambition' | 'avoidance';
  value: number;
}
