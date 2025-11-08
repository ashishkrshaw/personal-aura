import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';

type CreativeTab = 'story' | 'poem' | 'image';

@Component({
  selector: 'app-creative-suite',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="p-4 h-full flex flex-col bg-gray-100 dark:bg-gray-800 rounded-lg">
  <div class="flex border-b border-gray-200 dark:border-gray-700 mb-4">
    <button (click)="selectTab('story')" [class]="activeTab() === 'story' ? 'border-purple-500 text-purple-500 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'" class="flex-1 py-2 px-1 text-center border-b-2 font-medium text-sm transition-colors duration-200">
      <i class="fa-solid fa-book-open mr-2"></i>Story
    </button>
    <button (click)="selectTab('poem')" [class]="activeTab() === 'poem' ? 'border-purple-500 text-purple-500 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'" class="flex-1 py-2 px-1 text-center border-b-2 font-medium text-sm transition-colors duration-200">
      <i class="fa-solid fa-feather-pointed mr-2"></i>Poem
    </button>
    <button (click)="selectTab('image')" [class]="activeTab() === 'image' ? 'border-purple-500 text-purple-500 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'" class="flex-1 py-2 px-1 text-center border-b-2 font-medium text-sm transition-colors duration-200">
      <i class="fa-solid fa-image mr-2"></i>Image
    </button>
  </div>

  <div class="flex-grow overflow-y-auto">
    <!-- Story Generator -->
    @if (activeTab() === 'story') {
      <div class="flex flex-col h-full">
        <div class="flex-grow overflow-y-auto pr-2">
          @if (generatedStory()) {
            <div class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap p-3 bg-white dark:bg-gray-700 rounded-md">
                {{ generatedStory() }}
            </div>
          } @else {
            <div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <i class="fa-solid fa-book-open text-4xl"></i>
            </div>
          }
        </div>
        <div class="mt-4 flex items-center gap-2">
          <input [(ngModel)]="storyPrompt" (keyup.enter)="generateStory()" [disabled]="isLoading()" placeholder="A story about a brave knight..." class="w-full bg-white dark:bg-gray-700 rounded-md p-2 border border-gray-300 dark:border-gray-600 focus:ring-purple-500 focus:border-purple-500 transition">
          <button (click)="generateStory()" [disabled]="isLoading() || !storyPrompt()" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-purple-300 dark:disabled:bg-gray-600 transition">
            @if (isLoading()) {
              <i class="fas fa-spinner fa-spin"></i>
            } @else {
              <span>Write</span>
            }
          </button>
        </div>
      </div>
    }

    <!-- Poem Generator -->
    @if (activeTab() === 'poem') {
      <div class="flex flex-col h-full">
        <div class="flex-grow overflow-y-auto pr-2">
           @if (generatedPoem()) {
            <div class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap p-3 bg-white dark:bg-gray-700 rounded-md">
                {{ generatedPoem() }}
            </div>
          } @else {
            <div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <i class="fa-solid fa-feather-pointed text-4xl"></i>
            </div>
          }
        </div>
        <div class="mt-4 flex items-center gap-2">
          <input [(ngModel)]="poemPrompt" (keyup.enter)="generatePoem()" [disabled]="isLoading()" placeholder="A poem about the lonely moon..." class="w-full bg-white dark:bg-gray-700 rounded-md p-2 border border-gray-300 dark:border-gray-600 focus:ring-purple-500 focus:border-purple-500 transition">
          <button (click)="generatePoem()" [disabled]="isLoading() || !poemPrompt()" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-purple-300 dark:disabled:bg-gray-600 transition">
            @if (isLoading()) {
              <i class="fas fa-spinner fa-spin"></i>
            } @else {
              <span>Compose</span>
            }
          </button>
        </div>
      </div>
    }

    <!-- Image Generator -->
    @if (activeTab() === 'image') {
       <div class="flex flex-col h-full">
        <div class="flex-grow overflow-y-auto pr-2 flex items-center justify-center">
            @if (isLoading()) {
                <div class="text-center text-gray-500">
                    <i class="fas fa-spinner fa-spin text-4xl"></i>
                    <p class="mt-2">Creating your masterpiece...</p>
                </div>
            } @else if (generatedImage()) {
                <img [src]="generatedImage()" alt="Generated image" class="max-h-full max-w-full object-contain rounded-md shadow-lg">
            } @else if (imageError()) {
                <div class="text-center text-red-500 p-4 bg-red-100 dark:bg-red-900/50 rounded-md">
                    <i class="fa-solid fa-circle-exclamation text-2xl mb-2"></i>
                    <p>{{ imageError() }}</p>
                </div>
            } @else {
                <div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                    <i class="fa-solid fa-image text-4xl"></i>
                </div>
            }
        </div>
        <div class="mt-4 flex flex-col gap-2">
            <div class="flex items-center gap-2">
                <input [(ngModel)]="imagePrompt" (keyup.enter)="generateImage()" [disabled]="isLoading()" placeholder="A majestic lion in a spacesuit..." class="w-full bg-white dark:bg-gray-700 rounded-md p-2 border border-gray-300 dark:border-gray-600 focus:ring-purple-500 focus:border-purple-500 transition">
                <button (click)="generateImage()" [disabled]="isLoading() || !imagePrompt()" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-purple-300 dark:disabled:bg-gray-600 transition">
                    @if (isLoading()) {
                        <i class="fas fa-spinner fa-spin"></i>
                    } @else {
                        <span>Create</span>
                    }
                </button>
            </div>
            <div class="flex items-center gap-2">
                <label for="aspect-ratio" class="text-sm font-medium text-gray-700 dark:text-gray-300">Aspect Ratio:</label>
                <select [(ngModel)]="aspectRatio" id="aspect-ratio" class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full p-1.5 transition">
                    <option value="1:1">Square (1:1)</option>
                    <option value="16:9">Widescreen (16:9)</option>
                    <option value="9:16">Portrait (9:16)</option>
                    <option value="4:3">Landscape (4:3)</option>
                    <option value="3:4">Tall (3:4)</option>
                </select>
            </div>
        </div>
      </div>
    }
  </div>
</div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreativeSuiteComponent {
  private geminiService = inject(GeminiService);

  activeTab = signal<CreativeTab>('story');
  isLoading = signal(false);
  
  // Story
  storyPrompt = signal('');
  generatedStory = signal('');

  // Poem
  poemPrompt = signal('');
  generatedPoem = signal('');

  // Image
  imagePrompt = signal('');
  generatedImage = signal<string | null>(null);
  imageError = signal<string | null>(null);
  aspectRatio = signal<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');

  selectTab(tab: CreativeTab) {
    this.activeTab.set(tab);
  }

  async generateStory() {
    if (!this.storyPrompt()) return;
    this.isLoading.set(true);
    this.generatedStory.set('');
    try {
      const systemInstruction = 'You are a creative and captivating storyteller.';
      const result = await this.geminiService.generateText(this.storyPrompt(), systemInstruction);
      this.generatedStory.set(result);
    } finally {
      this.isLoading.set(false);
    }
  }

  async generatePoem() {
    if (!this.poemPrompt()) return;
    this.isLoading.set(true);
    this.generatedPoem.set('');
    try {
      const systemInstruction = 'You are a wise and eloquent poet.';
      const result = await this.geminiService.generateText(this.poemPrompt(), systemInstruction);
      this.generatedPoem.set(result);
    } finally {
      this.isLoading.set(false);
    }
  }
  
  async generateImage() {
    if (!this.imagePrompt()) return;
    this.isLoading.set(true);
    this.generatedImage.set(null);
    this.imageError.set(null);
    try {
      const result = await this.geminiService.generateImage(this.imagePrompt(), this.aspectRatio());
      if (result && result.startsWith('Sorry')) {
          this.imageError.set(result);
      } else if (result) {
          this.generatedImage.set(`data:image/jpeg;base64,${result}`);
      } else {
          this.imageError.set('Image generation failed. Please try again.');
      }
    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred.';
        this.imageError.set(message);
    } finally {
      this.isLoading.set(false);
    }
  }
}
