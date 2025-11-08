import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  GoogleGenAI,
  Type
} from '@google/genai';
import { firstValueFrom } from 'rxjs';

// Interfaces for type consistency across components
export interface CoachChatMessage {
  sender: 'user' | 'aura';
  text: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

// Backend URL is sourced from environment variables, with a fallback for local development.
const API_BASE_URL = process.env.AURA_BACKEND_URL || 'http://baddi.duckdns.org:9091';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private http = inject(HttpClient);
  private genAI: GoogleGenAI;
  // FIX: API Key must be read from process.env.API_KEY as per guidelines.
  private readonly AURA_API_KEY = process.env.API_KEY;
  private currentAudio: HTMLAudioElement | null = null;

  constructor() {
    if (!this.AURA_API_KEY) {
      console.error('API_KEY environment variable not set.');
    }
    this.genAI = new GoogleGenAI({ apiKey: this.AURA_API_KEY! });
  }

  // Generic text generation
  async generateText(prompt: string, systemInstruction: string): Promise<string> {
    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: systemInstruction,
        },
      });
      return response.text;
    } catch (error) {
      console.error('Error generating text:', error);
      return this.formatError(error);
    }
  }

  // For People Coach
  async sendCoachMessage(
    systemInstruction: string,
    history: CoachChatMessage[],
    message: string
  ): Promise<string> {
    const contents = history.map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction,
        },
      });
      return response.text;
    } catch (error) {
      console.error('Error in sendCoachMessage:', error);
      return this.formatError(error);
    }
  }

  // For Location Helper
  async getDirections(
    source: string,
    destination: string,
    travelMode: string,
    style: 'human' | 'default'
  ): Promise<{ text: string }> {
    const humanStylePrompt = `Provide friendly, conversational, and landmark-based ${travelMode} directions from ${source} to ${destination}. Be like a helpful local guide.`;
    const defaultStylePrompt = `Provide standard, step-by-step ${travelMode} directions from ${source} to ${destination}. The output should be a list of steps. Include a summary of distance and estimated time.`;
    
    const prompt = style === 'human' ? humanStylePrompt : defaultStylePrompt;

    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      return { text: response.text };
    } catch (error) {
      console.error('Error getting directions:', error);
      return { text: this.formatError(error) };
    }
  }

  // For Career Assistant (Job Search)
  async findJobs(query: string): Promise<{ sources: GroundingChunk[] }> {
    try {
      const prompt = `Find job listings for "${query}". Provide links to the job postings.`;
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            tools: [{googleSearch: {}}]
        }
      });
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: GroundingChunk[] = groundingChunks.map((chunk: any) => ({ web: chunk.web }));
      return { sources };
    } catch (error) {
      console.error('Error finding jobs:', error);
      return { sources: [] };
    }
  }

  // For Chatbot
  async sendChatMessage(
    systemInstruction: string,
    history: ChatMessage[],
    message: string,
    useRealTimeData: boolean
  ): Promise<{ text: string; sources: GroundingChunk[] }> {
    const contents = [...history, { role: 'user', parts: [{ text: message }] }];

    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
            systemInstruction,
            ...(useRealTimeData && { tools: [{googleSearch: {}}] })
        }
      });
      
      const text = response.text;
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: GroundingChunk[] = groundingChunks.map((chunk: any) => ({ web: chunk.web }));

      return { text, sources };
    } catch (error) {
      console.error('Error in sendChatMessage:', error);
      return { text: this.formatError(error), sources: [] };
    }
  }

  // For audio transcription
  async transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
    try {
        const audioPart = {
            inlineData: {
                data: audioBase64,
                mimeType: mimeType
            }
        };
        const promptPart = {
            text: "Transcribe the following audio recording."
        };

        const response = await this.genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: [promptPart, audioPart] },
        });

        return response.text;
    } catch (error) {
        console.error("Error transcribing audio:", error);
        return `Error during transcription: ${this.formatError(error)}`;
    }
  }

  // For TTS, using the gemini-2.5-flash-preview-tts model
  async generateSpeech(text: string): Promise<void> {
    this.stopSpeech(); // Stop any currently playing audio

    // This uses a REST endpoint for the preview TTS model, as official SDK support may not be available.
    // The structure is based on standard Google Cloud API patterns.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:synthesizeSpeech?key=${this.AURA_API_KEY}`;
    const body = {
      "input": { "text": text },
      "voice": { "languageCode": "en-US" },
      "audioConfig": { "audioEncoding": "MP3" }
    };
    
    try {
      const response = await firstValueFrom(
        this.http.post<{ audioContent: string }>(url, body)
      );
      
      if (!response || !response.audioContent) {
        throw new Error("API returned no audio content.");
      }

      return new Promise((resolve, reject) => {
        this.currentAudio = new Audio(`data:audio/mp3;base64,${response.audioContent}`);
        this.currentAudio.play().catch(reject);
        this.currentAudio.onended = () => {
          this.currentAudio = null;
          resolve();
        };
        this.currentAudio.onerror = (e) => {
          this.currentAudio = null;
          reject(e);
        };
      });

    } catch (error) {
      console.error('Gemini TTS Error:', error);
      // Fallback to browser's built-in speech synthesis
      console.warn('Falling back to browser speech synthesis.');
      return new Promise((resolve, reject) => {
          if (typeof window.speechSynthesis === 'undefined') {
              return reject(new Error('Browser does not support Speech Synthesis.'));
          }
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.onend = () => resolve();
          utter.onerror = (e) => reject(e);
          window.speechSynthesis.speak(utter);
      });
    }
  }

  // Stops any playing audio, whether from the Gemini API or the browser's fallback.
  stopSpeech() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (typeof window.speechSynthesis !== 'undefined') {
        window.speechSynthesis.cancel();
    }
  }

  // For Finance Manager (Receipt analysis)
  async analyzeExpenseImage(imageB64: string, mimeType: string): Promise<string> {
    const imagePart = {
      inlineData: {
        data: imageB64,
        mimeType: mimeType,
      },
    };
    const promptPart = {
      text: "Analyze this receipt image and extract the total amount, date, and a brief description or store name. Return the result as a JSON object with keys: 'amount', 'date' (in YYYY-MM-DD format), and 'description'. If a value cannot be found, set it to null.",
    };

    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, promptPart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER },
              date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' },
              description: { type: Type.STRING },
            },
            required: ['amount', 'date', 'description']
          }
        }
      });
      return response.text;
    } catch (error) {
      console.error('Error analyzing expense image:', error);
      return this.formatError(error);
    }
  }

  // For Live Conversation
  async sendLiveChatMessage(history: ChatMessage[], audioBase64: string, audioMimeType: string): Promise<string> {
    try {
        const audioPart = {
            inlineData: {
                data: audioBase64,
                mimeType: audioMimeType
            }
        };

        const contents = [...history, { role: 'user', parts: [audioPart] }];

        const response = await this.genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: contents,
          config: {
            systemInstruction: 'You are AURA, a warm and friendly AI companion. You are having a live, spoken conversation with your human friend. Keep your responses conversational, natural, and not too long. Listen carefully and respond with empathy and personality. Your voice should be calming and cheerful.',
          },
        });
        return response.text;

    } catch (error) {
        console.error("Error in live chat:", error);
        return this.formatError(error);
    }
  }
  
  // For Creative Suite (Image generation)
  async generateImage(prompt: string, aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'): Promise<string | null> {
    try {
      const response = await this.genAI.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio,
        }
      });
      if (response.generatedImages && response.generatedImages.length > 0) {
        return response.generatedImages[0].image.imageBytes;
      }
      return null;
    } catch (error) {
      console.error('Error generating image:', error);
      // The GeminiService should return the error message string, not null, for the component to display
      return this.formatError(error);
    }
  }

  private formatError(error: any): string {
    let message = 'An unknown error occurred.';
    if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    } else if (error && typeof error.message === 'string') {
        message = error.message;
    }
    
    // Check for rate limiting errors
    if (message.includes('429') || message.toLowerCase().includes('resource has been exhausted')) {
        return 'AURA is very popular right now! Please try again in a moment.';
    }

    return `Sorry, an error occurred: ${message}`;
  }
}