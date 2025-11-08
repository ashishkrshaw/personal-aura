import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// FIX: Import GroundingChunk from the service to ensure type consistency.
import { GeminiService, GroundingChunk } from '../../services/gemini.service';

@Component({
  selector: 'app-study-buddy',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './study-buddy.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudyBuddyComponent {
  private geminiService = inject(GeminiService);

  studyMaterial = signal('');
  userQuery = signal('');
  useRealTimeData = signal(false);

  isLoading = signal(false);
  response = signal<{ text: string; sources: GroundingChunk[] }>({ text: '', sources: [] });
  error = signal<string | null>(null);

  handleFileUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.studyMaterial.set(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  }

  async getHelp() {
    if (!this.studyMaterial() || !this.userQuery()) {
      this.error.set('Please provide study material and a specific question.');
      return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    this.response.set({ text: '', sources: [] });

    try {
      // FIX: Replaced call to non-existent `getStudyAssistance` with `sendChatMessage` for better code reuse.
      const systemInstruction = `You are a helpful study buddy. The user has provided the following study material. Use it to answer their questions. If you use external information, you must cite your sources.\n\n---STUDY MATERIAL---\n${this.studyMaterial()}`;
      const result = await this.geminiService.sendChatMessage(systemInstruction, [], this.userQuery(), this.useRealTimeData());
      this.response.set(result);
    } catch (e) {
      console.error('Error getting study help:', e);
      this.error.set('An error occurred while getting assistance. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async generateScenarios() {
    if (!this.studyMaterial()) {
      this.error.set('Please provide study material to generate scenarios from.');
      return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    this.response.set({ text: '', sources: [] });
    this.userQuery.set('Generate 3 practical scenarios based on the material.'); // Update query for context

    try {
      // FIX: Replaced call to non-existent `generateScenarios` with `generateText` for better code reuse.
      const prompt = `Based on the following study material, generate 3 practical scenarios or problems that a student could solve to test their understanding.\n\n---STUDY MATERIAL---\n${this.studyMaterial()}`;
      const systemInstruction = 'You are an educational content creator.';
      const resultText = await this.geminiService.generateText(prompt, systemInstruction);
      this.response.set({ text: resultText, sources: [] });
    } catch (e) {
      console.error('Error generating scenarios:', e);
      this.error.set('An error occurred while generating scenarios. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
