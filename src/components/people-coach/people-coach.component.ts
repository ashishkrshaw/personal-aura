import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';
import { DataService } from '../../services/data.service';
import type { Chat } from '@google/genai';

export interface Person {
  id: number;
  name: string;
  relationship: string;
  details: string;
}

interface Message {
  sender: 'user' | 'aura';
  text: string;
}

@Component({
  selector: 'app-people-coach',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './people-coach.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeopleCoachComponent {
  private geminiService = inject(GeminiService);
  private dataService = inject(DataService);

  // Auth State
  isAuthenticated = signal(false);
  pinInput = signal('');
  authError = signal<string | null>(null);
  private readonly correctPin = '8254199';

  people = signal<Person[]>([]);
  selectedPerson = signal<Person | null>(null);
  
  showAddPersonForm = signal(false);
  newPerson = signal({ name: '', relationship: '', details: '' });

  chatHistory = signal<Message[]>([]);
  currentUserMessage = signal('');
  isLoading = signal(false);
  quickReplies = signal<string[]>([]);
  isGeneratingReplies = signal(false);
  thinkingMode = signal(false);

  private activeChat: Chat | null = null;

  constructor() {
    const isAuthenticatedInStorage = localStorage.getItem('aura-coach-auth') === 'true';
    if (isAuthenticatedInStorage) {
      this.isAuthenticated.set(true);
      this.loadPeopleData();
    }
  }

  checkPin() {
    if (this.pinInput() === this.correctPin) {
      this.isAuthenticated.set(true);
      this.authError.set(null);
      localStorage.setItem('aura-coach-auth', 'true');
      this.loadPeopleData();
    } else {
      this.authError.set('Incorrect PIN. Please try again.');
      this.pinInput.set('');
    }
  }

  private loadPeopleData() {
    this.dataService.getPeople().subscribe(people => {
      this.people.set(people);
    });
  }

  addPerson() {
    const person: Person = { ...this.newPerson(), id: Date.now() };
    this.people.update(p => [...p, person]);
    this.savePeople();
    this.newPerson.set({ name: '', relationship: '', details: '' });
    this.showAddPersonForm.set(false);
  }

  selectPerson(person: Person) {
    this.selectedPerson.set(person);
    this.startOrUpdateChat();
  }
  
  toggleThinkingMode() {
      this.thinkingMode.update(v => !v);
      if (this.selectedPerson()) {
          this.startOrUpdateChat();
      }
  }

  private startOrUpdateChat() {
    if (!this.selectedPerson()) return;
    const person = this.selectedPerson()!;

    this.chatHistory.set([]);
    this.quickReplies.set([]);
    
    let systemInstruction = `You are a helpful communication coach. You are helping me, the user, interact with ${person.name}. 
    Details about ${person.name}:
    - Relationship to me: ${person.relationship}
    - Other details: ${person.details}
    My goal is to maintain a mentally and physically stable and positive relationship. When I describe a situation or a question, give me a advice or a direct response I can use. Be empathetic, wise, and supportive.`;
    
    if (this.thinkingMode()) {
        systemInstruction += `\n\nIMPORTANT: You are in "Deep Thinking Mode". Provide a more in-depth, thoughtful, and analytical response. Consider multiple perspectives, long-term consequences, and the psychological aspects of the conversation. Aim for wisdom over a quick answer.`;
    }

    this.activeChat = this.geminiService.startChat(systemInstruction, { thinkingConfig: { thinkingBudget: 0 } });
  }

  unselectPerson() {
    this.selectedPerson.set(null);
    this.activeChat = null;
    this.quickReplies.set([]);
  }

  async sendMessage() {
    if (!this.currentUserMessage().trim() || !this.activeChat) return;

    const messageText = this.currentUserMessage();
    this.quickReplies.set([]);
    this.isGeneratingReplies.set(false);
    this.chatHistory.update(h => [...h, { sender: 'user', text: messageText }]);
    this.currentUserMessage.set('');
    this.isLoading.set(true);

    try {
      const response = await this.geminiService.sendChatMessage(this.activeChat, messageText);
      this.chatHistory.update(h => [...h, { sender: 'aura', text: response }]);
      this.generateQuickReplies();
    } catch (error) {
      this.chatHistory.update(h => [...h, { sender: 'aura', text: 'Sorry, I had trouble responding. Please try again.' }]);
    } finally {
      this.isLoading.set(false);
    }
  }

  private savePeople() {
    this.dataService.savePeople(this.people()).subscribe({
      next: () => console.log('People data saved.'),
      error: (err) => console.error('Failed to save people data:', err)
    });
  }

  deletePerson(personId: number) {
    this.people.update(p => p.filter(person => person.id !== personId));
    this.savePeople();
    if (this.selectedPerson()?.id === personId) {
      this.unselectPerson();
    }
  }

  async generateQuickReplies() {
    if (!this.selectedPerson()) return;
    this.isGeneratingReplies.set(true);
    const person = this.selectedPerson()!;
    const personInfo = `Talking to ${person.name} (${person.relationship}). Details: ${person.details}`;
    const replies = await this.geminiService.generateQuickReplies(this.chatHistory(), personInfo);
    this.quickReplies.set(replies);
    this.isGeneratingReplies.set(false);
  }

  selectQuickReply(reply: string) {
    this.currentUserMessage.set(reply);
    this.sendMessage();
  }
}