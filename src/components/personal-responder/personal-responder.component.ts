import { ChangeDetectionStrategy, Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';

@Component({
  selector: 'app-personal-responder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personal-responder.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalResponderComponent implements OnDestroy {
  private geminiService = inject(GeminiService);

  personDescription = signal('');
  situationDescription = signal('');
  responseTone = signal('Casual');
  
  isLoading = signal(false);
  generatedResponse = signal('');
  error = signal<string | null>(null);

  tones = ['Casual', 'Formal', 'Empathetic', 'Direct', 'Humorous', 'Apologetic'];
  
  isSpeaking = signal(false);

  async generateResponse() {
    if (!this.personDescription().trim() || !this.situationDescription().trim()) {
      this.error.set('Please describe the person and the situation.');
      return;
    }
    this.isLoading.set(true);
    this.generatedResponse.set('');
    this.error.set(null);
    this.stopSpeaking();

    try {
      const prompt = `I need help crafting a response.
      
      Person I'm responding to: ${this.personDescription()}
      The situation: ${this.situationDescription()}
      
      Please write a response in a ${this.responseTone()} tone.`;

      const systemInstruction = 'You are a communication assistant, skilled at crafting perfect responses for any situation.';
      const result = await this.geminiService.generateText(prompt, systemInstruction);
      this.generatedResponse.set(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'An unknown error occurred.';
      this.error.set(`Failed to generate response: ${message}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  async speakResponse() {
    if (!this.generatedResponse() || this.isSpeaking()) return;

    this.isSpeaking.set(true);
    this.error.set(null);
    try {
      await this.geminiService.generateSpeech(this.generatedResponse());
    } catch (e) {
      console.error("Error playing speech", e);
      this.error.set('An error occurred while generating speech.');
    } finally {
      this.isSpeaking.set(false);
    }
  }

  stopSpeaking() {
    this.geminiService.stopSpeech();
    this.isSpeaking.set(false);
  }

  ngOnDestroy(): void {
    this.stopSpeaking();
  }
}