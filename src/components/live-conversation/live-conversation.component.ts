import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService, ChatMessage } from '../../services/gemini.service';
import { AudioService } from '../../services/audio.service';

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
export class LiveConversationComponent implements OnDestroy {
  geminiService = inject(GeminiService);
  audioService = inject(AudioService);

  conversationState = signal<ConversationState>('idle');
  transcript = signal<TranscriptLine[]>([]);
  
  private chatHistory: ChatMessage[] = [];
  private isProcessingAudio = false;
  
  statusMessages: Record<ConversationState, string> = {
    idle: 'Tap the microphone to start the conversation',
    listening: 'Listening...',
    processing: 'AURA is thinking...',
    speaking: 'AURA is speaking...'
  };

  toggleConversation() {
    if (this.conversationState() === 'idle') {
      this.startConversationLoop();
    } else {
      this.stopConversationLoop();
    }
  }
  
  private startConversationLoop() {
    this.transcript.set([]);
    this.chatHistory = [];
    this.listen();
  }

  private listen() {
    if (this.conversationState() === 'idle' || this.conversationState() === 'speaking') {
      this.conversationState.set('listening');
      this.audioService.startRecording(() => this.processAudio());
    }
  }
  
  private async processAudio() {
    if (!this.audioService.isRecording() || this.isProcessingAudio) return;
    
    this.isProcessingAudio = true;
    this.conversationState.set('processing');

    try {
      const audioData = await this.audioService.stopRecording();
      
      this.transcript.update(t => [...t, { speaker: 'user', text: '(You spoke to AURA)' }]);
      
      const responseText = await this.geminiService.sendLiveChatMessage(this.chatHistory, audioData.base64, audioData.mimeType);

      // Since we don't get the user's transcribed text back, we can't accurately add it to the history.
      // We will add Aura's response to continue the context for the next turn.
      this.chatHistory.push({ role: 'model', parts: [{ text: responseText }]});

      this.transcript.update(t => [...t, { speaker: 'aura', text: responseText }]);

      await this.speak(responseText);

    } catch (e) {
      console.error("Error processing audio:", e);
      const errorMessage = e instanceof Error ? e.message : 'Sorry, I had trouble understanding that.';
      this.transcript.update(t => [...t, { speaker: 'aura', text: errorMessage }]);
      this.stopConversationLoop();
    } finally {
      this.isProcessingAudio = false;
    }
  }
  
  private async speak(text: string) {
    if (!text) {
      this.listen(); // If Aura has nothing to say, go back to listening
      return;
    }
    
    this.conversationState.set('speaking');
    this.stopSpeaking();

    try {
        await this.geminiService.generateSpeech(text);
        // After speech is done (promise resolves), continue the loop.
        if (this.conversationState() !== 'idle') {
            this.listen();
        }
    } catch (e) {
        console.error("Error playing audio:", e);
        // Still try to continue the loop even on error.
        if (this.conversationState() !== 'idle') {
            this.listen();
        }
    }
  }

  private stopSpeaking() {
    this.geminiService.stopSpeech();
  }
  
  private stopConversationLoop() {
    if (this.audioService.isRecording()) {
        this.audioService.stopRecording();
    }
    this.stopSpeaking();
    this.isProcessingAudio = false;
    this.conversationState.set('idle');
  }

  ngOnDestroy(): void {
    this.stopConversationLoop();
  }
}