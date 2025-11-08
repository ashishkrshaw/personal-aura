import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../services/gemini.service';
import { AudioService } from '../../services/audio.service';
import { Chat } from '@google/genai';

type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';
interface TranscriptLine {
  speaker: 'user' | 'aura';
  text: string;
}

@Component({
  selector: 'app-live-conversation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './live-conversation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveConversationComponent implements OnInit, OnDestroy {
  geminiService = inject(GeminiService);
  audioService = inject(AudioService);

  conversationState = signal<ConversationState>('idle');
  transcript = signal<TranscriptLine[]>([]);
  
  private chat!: Chat;
  private currentAudio: HTMLAudioElement | null = null;
  
  statusMessages: Record<ConversationState, string> = {
    idle: 'Tap the microphone to start speaking',
    listening: 'Listening...',
    processing: 'AURA is thinking...',
    speaking: 'AURA is speaking...'
  };

  ngOnInit() {
    this.chat = this.geminiService.startLiveChat();
  }

  async toggleConversation() {
    switch (this.conversationState()) {
      case 'idle':
        this.startListening();
        break;
      case 'listening':
        await this.stopListeningAndProcess();
        break;
      case 'processing':
      case 'speaking':
        this.stopEverything();
        break;
    }
  }

  private startListening() {
    this.stopSpeaking();
    this.conversationState.set('listening');
    this.audioService.startRecording();
  }

  private async stopListeningAndProcess() {
    if (!this.audioService.isRecording()) return;
    
    this.conversationState.set('processing');
    try {
      const audioData = await this.audioService.stopRecording();
      const transcribedText = await this.geminiService.transcribeAudio(audioData.base64, audioData.mimeType);

      if (transcribedText && !transcribedText.toLowerCase().includes('error')) {
        this.transcript.update(t => [...t, { speaker: 'user', text: transcribedText }]);
        await this.getAuraResponse(transcribedText);
      } else {
        // Handle transcription error or empty audio
        this.conversationState.set('idle');
      }
    } catch (e) {
      console.error("Error processing audio:", e);
      this.conversationState.set('idle');
    }
  }

  private async getAuraResponse(userMessage: string) {
    try {
      this.conversationState.set('speaking');
      const stream = await this.geminiService.sendChatMessageStream(this.chat, userMessage);
      
      let fullResponse = '';
      this.transcript.update(t => [...t, { speaker: 'aura', text: '' }]);
      
      for await (const chunk of stream) {
        fullResponse += chunk.text;
        this.transcript.update(t => {
          const last = t[t.length - 1];
          last.text = fullResponse;
          return [...t];
        });
      }
      
      this.speak(fullResponse);
      
    } catch (error) {
      console.error("Error getting response from Aura:", error);
      this.transcript.update(t => [...t, { speaker: 'aura', text: 'Sorry, I had a problem responding.' }]);
      this.conversationState.set('idle');
    }
  }
  
  private async speak(text: string) {
    if (!text) {
      if (this.conversationState() === 'speaking') {
        this.conversationState.set('idle');
      }
      return;
    }
    this.stopSpeaking();

    const audioBase64 = await this.geminiService.generateSpeech(text);
    if (audioBase64) {
      const audioSrc = `data:audio/mp3;base64,${audioBase64}`;
      this.currentAudio = new Audio(audioSrc);
      
      this.currentAudio.onended = () => {
        if (this.conversationState() === 'speaking') {
          this.conversationState.set('idle');
        }
        this.currentAudio = null;
      };
      
      this.currentAudio.play().catch(e => {
        console.error("Error playing audio:", e);
        if (this.conversationState() === 'speaking') {
          this.conversationState.set('idle');
        }
      });
    } else {
      // If speech generation fails, go back to idle.
      if (this.conversationState() === 'speaking') {
        this.conversationState.set('idle');
      }
    }
  }

  private stopSpeaking() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio.onended = null;
      this.currentAudio = null;
    }
  }
  
  private stopEverything() {
    if (this.audioService.isRecording()) {
        this.audioService.stopRecording();
    }
    this.stopSpeaking();
    this.conversationState.set('idle');
  }

  ngOnDestroy(): void {
    this.stopEverything();
  }
}