import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';

// FIX: Updated interface to match the library's type, where properties can be optional.
interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

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
      const result = await this.geminiService.getStudyAssistance(this.studyMaterial(), this.userQuery(), this.useRealTimeData());
      const text = result.text;
      const sources = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      this.response.set({ text, sources });
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
      const resultText = await this.geminiService.generateScenarios(this.studyMaterial());
      this.response.set({ text: resultText, sources: [] });
    } catch (e) {
      console.error('Error generating scenarios:', e);
      this.error.set('An error occurred while generating scenarios. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}