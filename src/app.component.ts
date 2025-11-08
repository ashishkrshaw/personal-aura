import { ChangeDetectionStrategy, Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PeopleCoachComponent } from './components/people-coach/people-coach.component';
import { LocationHelperComponent } from './components/location-helper/location-helper.component';
import { CreativeSuiteComponent } from './components/creative-suite/creative-suite.component';
import { CareerAssistantComponent } from './components/career-assistant/career-assistant.component';
import { ChatbotComponent } from './components/chatbot/chatbot.component';
import { GeminiService } from './services/gemini.service';
import { AudioService } from './services/audio.service';
import { ThemeService } from './services/theme.service';
import { DataService } from './services/data.service';
import { LoginComponent } from './components/login/login.component';
import { LiveConversationComponent } from './components/live-conversation/live-conversation.component';
import { PersonalResponderComponent } from './components/personal-responder/personal-responder.component';

type Tab = 'responder' | 'coach' | 'navigate' | 'create' | 'career' | 'chat' | 'live';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    PersonalResponderComponent,
    PeopleCoachComponent,
    LocationHelperComponent,
    CreativeSuiteComponent,
    CareerAssistantComponent,
    ChatbotComponent,
    LoginComponent,
    LiveConversationComponent,
  ],
  providers: [GeminiService, AudioService, ThemeService, DataService]
})
export class AppComponent implements OnInit {
  themeService = inject(ThemeService);
  dataService = inject(DataService);
  
  isAuthenticated = signal(localStorage.getItem('aura-auth-token') === 'true');
  activeTab = signal<Tab>('responder');
  isInitializing = signal(true);
  showSplash = signal(true);

  tabs: { id: Tab; icon: string; name: string }[] = [
    { id: 'responder', icon: 'fa-reply-all', name: 'Responder' },
    { id: 'coach', icon: 'fa-users', name: 'Coach' },
    { id: 'navigate', icon: 'fa-map-location-dot', name: 'Navigate' },
    { id: 'create', icon: 'fa-wand-magic-sparkles', name: 'Create' },
    { id: 'career', icon: 'fa-briefcase', name: 'Career' },
    { id: 'chat', icon: 'fa-comments', name: 'Chat' },
    { id: 'live', icon: 'fa-headset', name: 'Live' },
  ];

  ngOnInit(): void {
    this.dataService.checkBackendStatus();
    setTimeout(() => {
      this.isInitializing.set(false);
      // If not authenticated, splash screen will be replaced by login, so no need to hide it
      if(this.isAuthenticated()) {
        setTimeout(() => this.showSplash.set(false), 500);
      }
    }, 2000);
  }

  handleLoginSuccess() {
    this.isAuthenticated.set(true);
    localStorage.setItem('aura-auth-token', 'true');
    // Hide splash immediately after successful login
    this.isInitializing.set(false);
    this.showSplash.set(false);
  }

  selectTab(tab: Tab) {
    this.activeTab.set(tab);
  }
}
