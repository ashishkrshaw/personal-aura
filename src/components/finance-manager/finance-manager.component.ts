import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';
import { DataService } from '../../services/data.service';

interface Expense {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
}

@Component({
  selector: 'app-finance-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finance-manager.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceManagerComponent {
  private geminiService = inject(GeminiService);
  private dataService = inject(DataService);

  expenses = signal<Expense[]>([]);
  newExpense = signal({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: null as number | null,
    category: 'Other'
  });

  analysisResult = signal<string>('');
  isLoadingAnalysis = signal(false);

  // For receipt scanning
  isAnalyzingReceipt = signal(false);
  receiptFile = signal<{ base64: string; name: string; mimeType: string; preview: string } | null>(null);
  receiptError = signal<string | null>(null);

  expenseCategories = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Other'];

  constructor() {
    this.dataService.getExpenses().subscribe(expenses => {
      this.expenses.set(expenses);
    });
  }

  addExpense() {
    const expenseData = this.newExpense();
    if (!expenseData.description || !expenseData.amount || expenseData.amount <= 0) {
      return; // Basic validation
    }

    const expense: Expense = {
      ...expenseData,
      id: Date.now(),
      amount: expenseData.amount
    };

    this.expenses.update(e => [expense, ...e].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    this.saveExpenses();
    this.resetForm();
  }

  deleteExpense(expenseId: number) {
    this.expenses.update(e => e.filter(exp => exp.id !== expenseId));
    this.saveExpenses();
  }
  
  async analyzeSpending() {
    if (this.expenses().length === 0) {
        this.analysisResult.set("There are no expenses to analyze. Please add some first.");
        return;
    }
    this.isLoadingAnalysis.set(true);
    this.analysisResult.set('');
    try {
        const result = await this.geminiService.analyzeExpenses(this.expenses());
        this.analysisResult.set(result);
    } catch(e) {
        this.analysisResult.set("Sorry, I encountered an error during analysis. Please try again.");
    } finally {
        this.isLoadingAnalysis.set(false);
    }
  }

  onReceiptFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.receiptError.set(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        const base64 = preview.split(',')[1];
        this.receiptFile.set({ base64, name: file.name, mimeType: file.type, preview });
      };
      reader.readAsDataURL(file);
    }
  }

  async analyzeReceipt() {
    if (!this.receiptFile()) return;
    
    this.isAnalyzingReceipt.set(true);
    this.receiptError.set(null);
    const { base64, mimeType } = this.receiptFile()!;
    
    try {
      const jsonString = await this.geminiService.analyzeExpenseImage(base64, mimeType);
      
      // The service might return an error message string instead of JSON
      if (jsonString.startsWith('Sorry') || jsonString.startsWith('AURA is very popular')) {
          throw new Error(jsonString);
      }

      const extractedData = JSON.parse(jsonString);
      
      this.newExpense.update(current => ({
        ...current,
        description: extractedData.description || current.description,
        amount: extractedData.amount || current.amount,
        date: extractedData.date || current.date,
      }));
      
    } catch (error) {
       console.error("Error analyzing receipt:", error);
       const message = error instanceof Error ? error.message : "Could not parse receipt data.";
       this.receiptError.set(`Analysis failed: ${message}`);
    } finally {
      this.isAnalyzingReceipt.set(false);
    }
  }

  private resetForm() {
     this.newExpense.set({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: null,
      category: 'Other'
    });
    this.receiptFile.set(null);
    this.receiptError.set(null);
  }

  private saveExpenses() {
    this.dataService.saveExpenses(this.expenses()).subscribe({
      next: () => console.log('Expenses data saved.'),
      error: (err) => console.error('Failed to save expenses data:', err)
    });
  }
}