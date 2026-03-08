import { GoogleGenAI, Type } from "@google/genai";
import { Ex, PatternAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const getGeminiResponse = async (messages: { role: string; text: string }[], systemInstruction: string) => {
  try {
    // Memory management: Limit context to the last 15 messages to stay within token limits and maintain focus
    const contextWindow = messages.slice(-15);
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contextWindow.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      })),
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });
    return response.text || "I'm speechless. Try again.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "My brain just short-circuited. Give me a sec.";
  }
};

export const analyzePersonality = async (input: { text?: string, image?: { data: string, mimeType: string } }) => {
  try {
    const parts: any[] = [];
    if (input.text) parts.push({ text: `Context/Answers: ${input.text}` });
    if (input.image) {
      parts.push({
        inlineData: {
          data: input.image.data,
          mimeType: input.image.mimeType
        }
      });
      parts.push({ text: "Analyze this chat screenshot. Assume the messages on the right are from the user and the messages on the left are from the other person (the ex/partner). Look at the dynamics, the power balance, the red flags, and the overall vibe. Be brutally honest." });
    } else {
      parts.push({ text: `Analyze these quiz answers and return a personality profile: ${input.text}` });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts }],
      config: {
        systemInstruction: `You are Rex, a brutally honest AI breakup therapist. Analyze the provided chat screenshot or quiz answers about the user's ex or current partner. 
        Your goal is to diagnose their toxicity level. Return a JSON toxicity profile. Be witty, sarcastic, and insightful. 
        
        Guidelines for fields:
        - 'type': A creative, biting name for their toxic archetype (e.g., 'The Gaslight Gatekeeper', 'The Emotional Vampire').
        - 'celebrity': A toxic or problematic celebrity (or famous fictional character) who perfectly embodies this ex's specific brand of toxicity. Don't pick nice people. Pick the villains, the narcissists, or the famously messy ones.
        - 'celebrityWhy': A 1-sentence snarky explanation of the parallel between the ex and this celebrity.
        - 'roast': A brutal, funny 2-3 sentence roast of this ex based on the evidence.
        - 'truth': The cold, hard reality of why the user is better off without them.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            tagline: { type: Type.STRING },
            score: {
              type: Type.OBJECT,
              properties: {
                gaslighting: { type: Type.NUMBER },
                narcissism: { type: Type.NUMBER },
                avoidance: { type: Type.NUMBER },
                manipulation: { type: Type.NUMBER },
                inconsistency: { type: Type.NUMBER },
              }
            },
            roast: { type: Type.STRING },
            truth: { type: Type.STRING },
            redFlag: { type: Type.STRING },
            greenFlag: { type: Type.STRING },
            energy: { type: Type.STRING },
            compatibility: { type: Type.ARRAY, items: { type: Type.STRING } },
            avoid: { type: Type.STRING },
            celebrity: { type: Type.STRING },
            celebrityWhy: { type: Type.STRING, description: "A short, biting explanation of why this celebrity matches the ex's toxicity." },
          },
          required: ["type", "tagline", "score", "roast", "truth", "redFlag", "greenFlag", "energy", "compatibility", "avoid", "celebrity", "celebrityWhy"]
        }
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Personality Analysis Error:", error);
    return null;
  }
};

export const analyzePatterns = async (exes: Ex[]) => {
  try {
    const contents: any[] = [];
    
    exes.forEach((ex, index) => {
      contents.push({ text: `Ex #${index + 1} Name: ${ex.name}` });
      ex.screenshots.forEach(screenshot => {
        contents.push({
          inlineData: {
            data: screenshot.data,
            mimeType: screenshot.mimeType
          }
        });
      });
    });

    contents.push({ text: "Analyze the patterns across all these exes based on the chat screenshots. Look for recurring themes in how they talk to the user, how the user responds, and the overall dynamic. Then, guess the user's 'Ideal Type' based on these patterns (even if it's a toxic one). DO NOT GIVE ADVICE. Be brutally honest and snarky. Return a JSON object." });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: contents }],
      config: {
        systemInstruction: `You are Rex, the Pattern Analyser. Your job is to look at a user's history with multiple exes and find the common thread. 
        Are they always dating the same person in different bodies? 
        What is the 'trend'? 
        What are the 'similarities'? 
        What is their 'idealType' (the one they keep falling for)? 
        Roast them for their lack of variety or their specific brand of 'type'.
        
        CRITICAL: 
        - DO NOT GIVE ADVICE. No "you should do this" or "try that". Just cold, hard analysis.
        - Be brutal, funny, and insightful.
        - Return ONLY JSON.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            trend: { type: Type.STRING, description: "The overall pattern or trend observed across all exes." },
            similarities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific recurring behaviors or dynamics." },
            idealType: { type: Type.STRING, description: "A creative name for the user's 'type' based on the patterns." },
            roast: { type: Type.STRING, description: "A brutal roast of the user's dating choices." }
          },
          required: ["trend", "similarities", "idealType", "roast"]
        }
      }
    });

    return JSON.parse(response.text || "{}") as PatternAnalysisResult;
  } catch (error) {
    console.error("Pattern Analysis Error:", error);
    return null;
  }
};
