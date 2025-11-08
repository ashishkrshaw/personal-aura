
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService, GroundingChunk } from '../../services/gemini.service';

type CareerTab = 'search' | 'roadmap' | 'resume';

interface Job {
  title: string;
  url: string;
}

@Component({
  selector: 'app-career-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './career-assistant.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CareerAssistantComponent {
  private geminiService = inject(GeminiService);

  activeTab = signal<CareerTab>('search');

  // Job Search
  jobSearchQuery = signal('');
  jobSearchResults = signal<Job[]>([]);
  isSearchingJobs = signal(false);

  // Roadmap
  roadmapRole = signal('');
  generatedRoadmap = signal('');
  isGeneratingRoadmap = signal(false);
  
  // Resume Review
  resumeText = signal('');
  resumeFeedback = signal('');
  isReviewingResume = signal(false);

  selectTab(tab: CareerTab) {
    this.activeTab.set(tab);
  }

  async searchJobs() {
    if (!this.jobSearchQuery()) return;
    this.isSearchingJobs.set(true);
    this.jobSearchResults.set([]);
    try {
      const response = await this.geminiService.findJobs(this.jobSearchQuery());
      // FIX: The service returns a `sources` property directly, not `candidates`.
      const chunks: GroundingChunk[] = response.sources || [];
      const jobs: Job[] = chunks.map((chunk: GroundingChunk) => ({
        title: chunk.web?.title || 'Untitled',
        url: chunk.web?.uri || '#'
      }));
      this.jobSearchResults.set(jobs);
    } finally {
      this.isSearchingJobs.set(false);
    }
  }

  async generateRoadmap() {
    if (!this.roadmapRole()) return;
    this.isGeneratingRoadmap.set(true);
    this.generatedRoadmap.set('');
    try {
      // FIX: Replaced call to non-existent `generateCareerRoadmap` with `generateText` for better code reuse.
      const prompt = `Create a detailed career roadmap for someone wanting to become a ${this.roadmapRole()}. Include key skills, certifications, and potential career milestones.`;
      const systemInstruction = 'You are an expert career advisor.';
      const roadmap = await this.geminiService.generateText(prompt, systemInstruction);
      this.generatedRoadmap.set(roadmap);
    } finally {
      this.isGeneratingRoadmap.set(false);
    }
  }
  
  async reviewResume() {
    if (!this.resumeText()) return;
    this.isReviewingResume.set(true);
    this.resumeFeedback.set('');
    try {
      const prompt = `Please review the following resume and provide constructive feedback. Focus on clarity, impact, and formatting. Suggest improvements to make it more appealing to recruiters.\n\n---\n\n${this.resumeText()}`;
      const feedback = await this.geminiService.generateText(prompt, 'You are an expert career coach and resume reviewer.');
      this.resumeFeedback.set(feedback);
    } finally {
      this.isReviewingResume.set(false);
    }
  }

  handleResumeUpload(event: Event) {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
              this.resumeText.set(e.target?.result as string);
          };
          reader.readAsText(file);
      }
  }
}