import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';
import { AudioService } from '../../services/audio.service';
import { Chat } from '@google/genai';

// FIX: Updated interface to match the library's type, where properties can be optional.
interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

interface Message {
  sender: 'user' | 'aura';
  text: string;
  sources?: GroundingChunk[];
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatbotComponent implements OnDestroy {
  geminiService = inject(GeminiService);
  audioService = inject(AudioService);

  chatHistory = signal<Message[]>([]);
  currentUserMessage = signal('');
  isLoading = signal(false);
  isLiveMode = signal(false);
  isPushToTalkMode = signal(false);
  isRecordingPushToTalk = signal(false);
  thinkingMode = signal(false);
  useRealTimeData = signal(false);
  
  private chat!: Chat;
  private currentAudio: HTMLAudioElement | null = null;
  private readonly CHAT_HISTORY_KEY = 'aura-chat-history';

  constructor() {
    this.loadChatHistory();
    this.reinitializeChat();
    effect(() => {
        this.saveChatHistory();
    });
  }

  private reinitializeChat() {
     const baseInstruction = `You are AURA, a friendly and helpful general-purpose AI assistant.
    If the user asks you to open an app, website, or perform a search, you MUST respond with a special formatted string.
    - For opening a URL: [AURA_ACTION:OPEN_URL|https://example.com]
    - For a Google search: [AURA_ACTION:SEARCH|search query here]
    - For opening WhatsApp: [AURA_ACTION:OPEN_URL|https://wa.me/]
    You can also provide a conversational response before the action string. Example: "Sure, searching Google for cute cats for you! [AURA_ACTION:SEARCH|cute cats]".`;
    
    let finalInstruction = baseInstruction;
    if (this.thinkingMode()) {
      finalInstruction += `\n\nIMPORTANT: You are in "Deep Thinking Mode". Engage in deeper, more thoughtful conversation. Explore topics thoroughly, provide detailed explanations, and ask insightful follow-up questions.`;
    }

    const history = this.chatHistory()
      .filter(m => m.text) // Don't include empty placeholder messages in history
      .map(message => ({
        role: message.sender === 'user' ? 'user' : 'model',
        parts: [{ text: message.text }]
      }));

    const config: any = {};
    if (this.useRealTimeData()) {
        config.tools = [{ googleSearch: {} }];
    }

    this.chat = this.geminiService.startChat(finalInstruction, { history, ...config });
    
    if (this.chatHistory().length === 0) {
        this.chatHistory.set([{ sender: 'aura', text: "Hello! How can I help you today?" }]);
    }
  }

  clearChatHistory() {
    this.chatHistory.set([]);
    localStorage.removeItem(this.CHAT_HISTORY_KEY);
    this.reinitializeChat();
  }

  toggleLiveMode() {
    this.isLiveMode.update(v => !v);
    if (!this.isLiveMode()) {
      this.stopSpeaking();
    }
  }

  togglePushToTalkMode() {
    this.isPushToTalkMode.update(v => !v);
    if (this.audioService.isRecording()) {
        this.audioService.stopRecording();
    }
  }

  toggleThinkingMode() {
    this.thinkingMode.update(v => !v);
    this.reinitializeChat();
  }
  
  toggleRealTimeData() {
    this.useRealTimeData.update(v => !v);
    this.reinitializeChat();
  }

  async sendMessage() {
    if (!this.currentUserMessage().trim()) return;

    const messageText = this.currentUserMessage();
    this.chatHistory.update(h => [...h, { sender: 'user', text: messageText }]);
    this.currentUserMessage.set('');
    this.isLoading.set(true);
    this.stopSpeaking();

    try {
      const stream = await this.geminiService.sendChatMessageStream(this.chat, messageText);
      this.isLoading.set(false);

      let fullResponse = '';
      let sources: GroundingChunk[] = [];
      this.chatHistory.update(h => [...h, { sender: 'aura', text: '', sources: [] }]);

      for await (const chunk of stream) {
        fullResponse += chunk.text;
        const chunkSources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        sources.push(...chunkSources); 

        this.chatHistory.update(h => {
          const last = h[h.length - 1];
          if (last.sender === 'aura') {
            last.text = fullResponse.replace(/\[AURA_ACTION:[^\]]+\]/g, '');
          }
          return [...h];
        });
      }

      // FIX: Added filter to safely handle optional `web` and `uri` properties.
      const uniqueSources = Array.from(new Map(sources.filter(s => s.web?.uri).map(item => [item.web!.uri!, item])).values());
      const processedResponse = this.processAuraActions(fullResponse);

      this.chatHistory.update(h => {
          const last = h[h.length-1];
          if(last.sender === 'aura') {
              last.text = processedResponse;
              last.sources = uniqueSources;
          }
          return [...h];
      });

      if (this.isLiveMode()) {
        this.speak(processedResponse);
      }

    } catch (error) {
      this.chatHistory.update(h => [...h, { sender: 'aura', text: 'Sorry, an error occurred. Please try again.' }]);
      this.isLoading.set(false);
    }
  }

  private processAuraActions(text: string): string {
    const actionRegex = /\[AURA_ACTION:(OPEN_URL|SEARCH)\|([^\]]+)\]/g;
    let userVisibleText = text;
    let match;

    while ((match = actionRegex.exec(text)) !== null) {
        const action = match[1];
        const value = match[2];
        userVisibleText = userVisibleText.replace(match[0], '').trim();

        if (action === 'OPEN_URL') {
            window.open(value, '_blank');
        } else if (action === 'SEARCH') {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(value)}`;
            window.open(searchUrl, '_blank');
        }
    }
    return userVisibleText || "Done!";
  }

  async toggleRecording() {
    if (this.audioService.isRecording()) {
      this.stopAndProcessAudio();
    } else {
      this.stopSpeaking();
      this.audioService.startRecording();
    }
  }

  startPushToTalk() {
    if (!this.isPushToTalkMode() || this.audioService.isRecording()) return;
    this.stopSpeaking();
    this.audioService.startRecording();
    this.isRecordingPushToTalk.set(true);
  }

  stopPushToTalk() {
    if (!this.isPushToTalkMode() || !this.audioService.isRecording()) return;
    this.isRecordingPushToTalk.set(false);
    this.stopAndProcessAudio();
  }

  private async stopAndProcessAudio() {
    try {
      const audioData = await this.audioService.stopRecording();
      this.isLoading.set(true);
      const transcribedText = await this.geminiService.transcribeAudio(audioData.base64, audioData.mimeType);
      this.currentUserMessage.set(transcribedText);
      this.isLoading.set(false);
      if (transcribedText && !transcribedText.toLowerCase().includes('error')) {
        this.sendMessage();
      } else if (transcribedText) {
          this.chatHistory.update(h => [...h, { sender: 'aura', text: transcribedText }]);
      }
    } catch (e) {
      console.error("Error during transcription", e);
      this.isLoading.set(false);
    }
  }

  private async speak(text: string) {
    this.stopSpeaking();
    if (!text) return;

    try {
      const audioBase64 = await this.geminiService.generateSpeech(text);
      if (audioBase64) {
        const audioSrc = `data:audio/mp3;base64,${audioBase64}`;
        this.currentAudio = new Audio(audioSrc);
        this.currentAudio.play();
      }
    } catch (e) {
      console.error("Error playing speech", e);
    }
  }

  private stopSpeaking() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  private loadChatHistory() {
    const savedHistory = localStorage.getItem(this.CHAT_HISTORY_KEY);
    if (savedHistory) {
        this.chatHistory.set(JSON.parse(savedHistory));
    }
  }

  private saveChatHistory() {
    localStorage.setItem(this.CHAT_HISTORY_KEY, JSON.stringify(this.chatHistory()));
  }

  ngOnDestroy(): void {
    if (this.audioService.isRecording()) {
        this.audioService.stopRecording();
    }
    this.stopSpeaking();
  }
}