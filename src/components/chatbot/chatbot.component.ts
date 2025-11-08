import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// FIX: Imported ChatMessage interface to resolve type error.
import { GeminiService, GroundingChunk, ChatMessage } from '../../services/gemini.service';
import { AudioService } from '../../services/audio.service';

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
  
  private readonly CHAT_HISTORY_KEY = 'aura-chat-history';

  constructor() {
    this.loadChatHistory();
    if (this.chatHistory().length === 0) {
        this.chatHistory.set([{ sender: 'aura', text: "Hello! How can I help you today?" }]);
    }
    effect(() => {
        this.saveChatHistory();
    });
  }

  private getSystemInstruction(): string {
     const baseInstruction = `You are AURA, a friendly and helpful general-purpose AI assistant.
    If the user asks you to open an app, website, or perform a search, you MUST respond with a special formatted string.
    - For opening a URL: [AURA_ACTION:OPEN_URL|https://example.com]
    - For a Google search: [AURA_ACTION:SEARCH|search query here]
    - For opening WhatsApp: [AURA_ACTION:OPEN_URL|https://wa.me/]
    You can also provide a conversational response before the action string. Example: "Sure, searching Google for cute cats for you! [AURA_ACTION:SEARCH|cute cats]".`;
    
    if (this.thinkingMode()) {
      return baseInstruction + `\n\nIMPORTANT: You are in "Deep Thinking Mode". Engage in deeper, more thoughtful conversation. Explore topics thoroughly, provide detailed explanations, and ask insightful follow-up questions.`;
    }
    return baseInstruction;
  }

  clearChatHistory() {
    this.chatHistory.set([{ sender: 'aura', text: "Hello! How can I help you today?" }]);
    localStorage.removeItem(this.CHAT_HISTORY_KEY);
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
  }
  
  toggleRealTimeData() {
    this.useRealTimeData.update(v => !v);
  }

  async sendMessage() {
    if (!this.currentUserMessage().trim()) return;

    const messageText = this.currentUserMessage();

    // FIX: Prepare history for API call *before* updating the UI state to prevent sending the same message twice.
    // FIX: Explicitly typed `geminiHistory` as `ChatMessage[]` to fix type inference error.
    const geminiHistory: ChatMessage[] = this.chatHistory()
      .filter(m => m.sender === 'aura' ? m.text : true) // Don't include empty placeholder messages from aura
      .map(message => ({
        role: message.sender === 'user' ? 'user' : 'model',
        parts: [{ text: message.text }]
      }));
      
    this.chatHistory.update(h => [...h, { sender: 'user', text: messageText }]);
    this.currentUserMessage.set('');
    this.isLoading.set(true);
    this.stopSpeaking();

    try {
      const response = await this.geminiService.sendChatMessage(this.getSystemInstruction(), geminiHistory, messageText, this.useRealTimeData());
      
      const processedText = this.processAuraActions(response.text);
      const uniqueSources = Array.from(new Map(response.sources.filter(s => s.web?.uri).map(item => [item.web!.uri!, item])).values());

      this.chatHistory.update(h => [...h, { sender: 'aura', text: processedText, sources: uniqueSources }]);

      if (this.isLiveMode()) {
        this.speak(processedText);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sorry, an error occurred. Please try again.';
      this.chatHistory.update(h => [...h, { sender: 'aura', text: errorMessage }]);
    } finally {
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
      await this.geminiService.generateSpeech(text);
    } catch (e) {
      console.error("Error playing speech", e);
    }
  }

  private stopSpeaking() {
    this.geminiService.stopSpeech();
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