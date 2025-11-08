
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';

type CreativeTab = 'image' | 'video';

@Component({
  selector: 'app-creative-suite',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './creative-suite.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreativeSuiteComponent {
  private geminiService = inject(GeminiService);

  activeTab = signal<CreativeTab>('image');
  
  // Image Generation
  imagePrompt = signal('');
  imageAspectRatio = signal('1:1');
  generatedImageUrl = signal<string | null>(null);
  isGeneratingImage = signal(false);

  // Video Generation
  videoPrompt = signal('');
  videoAspectRatio = signal('16:9');
  isGeneratingVideo = signal(false);
  videoGenerationStatus = signal('');
  generatedVideoUrl = signal<string | null>(null);
  videoImageFile = signal<{base64: string, name: string, mimeType: string} | null>(null);

  selectTab(tab: CreativeTab) {
    this.activeTab.set(tab);
  }

  async generateImage() {
    if (!this.imagePrompt()) return;
    this.isGeneratingImage.set(true);
    this.generatedImageUrl.set(null);
    try {
      const url = await this.geminiService.generateImage(this.imagePrompt(), this.imageAspectRatio());
      this.generatedImageUrl.set(url);
    } finally {
      this.isGeneratingImage.set(false);
    }
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        this.videoImageFile.set({ base64, name: file.name, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.videoImageFile.set(null);
  }

  async generateVideo() {
    if (!this.videoPrompt()) return;
    this.isGeneratingVideo.set(true);
    this.generatedVideoUrl.set(null);
    this.videoGenerationStatus.set('Initializing video generation...');
    
    try {
      let url: string | null = null;
      if (this.videoImageFile()) {
        this.videoGenerationStatus.set('Generating video from your image. This can take several minutes...');
        const { base64, mimeType } = this.videoImageFile()!;
        url = await this.geminiService.generateVideoFromImage(this.videoPrompt(), base64, mimeType, this.videoAspectRatio());
      } else {
        this.videoGenerationStatus.set('Generating video from your prompt. This can take several minutes...');
        url = await this.geminiService.generateVideoFromPrompt(this.videoPrompt(), this.videoAspectRatio());
      }
      this.generatedVideoUrl.set(url);
    } catch (error) {
      console.error('Error generating video', error);
      this.videoGenerationStatus.set('An error occurred during video generation.');
    } finally {
      this.isGeneratingVideo.set(false);
    }
  }
}
