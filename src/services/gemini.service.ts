import { Injectable } from '@angular/core';
// FIX: Removed GenerateContentStreamResponse as it is not an exported member of @google/genai
import { GoogleGenAI, GenerateContentResponse, Chat, Type } from "@google/genai";

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  private apiKey: string | undefined;

  constructor() {
    // Read the API key from the runtime configuration at INSTANTIATION time, not module load time.
    // This is the definitive fix for the blank screen race condition on deployment.
    this.apiKey = (window as any).runtimeConfig?.API_KEY;

    if (!this.apiKey || this.apiKey === 'YOUR_GEMINI_API_KEY_PLACEHOLDER') {
      console.error("API_KEY not found or not set in runtime configuration.");
      // In a real app, you might want to throw an error or handle this differently.
    }
    this.ai = new GoogleGenAI({ apiKey: this.apiKey! });
  }

  private handleError(error: unknown, context: string): string {
    console.error(`Error in ${context}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
      return 'AURA is very popular right now! Please wait a moment and try again.';
    }
    if (errorMessage.toLowerCase().includes('api key not valid')) {
        return 'There seems to be an issue with the API key configuration. Please check your deployment variables.';
    }
    return `Sorry, I encountered an error while ${context}. Please try again.`;
  }

  async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
        },
      });
      return response.text;
    } catch (error) {
      return this.handleError(error, 'generating text');
    }
  }

  async getStandardDirections(from: string, to: string): Promise<GenerateContentResponse> {
    const prompt = `Provide step-by-step driving directions from ${from} to ${to}.`;
    return this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });
  }

  async getHumanDirections(from: string, to: string, mode: string): Promise<string> {
    const prompt = `Provide directions from ${from} to ${to} via ${mode}.`;
    const systemInstruction = `You are a friendly, local guide from the Giridih, Jharkhand area in India. You are giving directions to a friend. Speak colloquially, using Hindi words for directions like 'daya' (right) and 'baya' (left) where it feels natural. Mention local landmarks, even small ones like a specific tea stall, a large tree, or a uniquely colored building. Make the directions feel very personal and human, not like a machine. Be warm and encouraging.`;
    
    return this.generateText(prompt, systemInstruction);
  }

  async findJobs(query: string): Promise<GenerateContentResponse> {
      return this.ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Find recent job postings related to: ${query}. List the job title, company, and a link to the posting.`,
          config: {
              tools: [{ googleSearch: {} }],
          },
      });
  }
  
  async generateCareerRoadmap(role: string): Promise<string> {
    try {
        const prompt = `Create a detailed career roadmap for someone wanting to become a ${role}. Include skills to learn, certifications, project ideas, and career milestones.`;
        const response = await this.ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        return this.handleError(error, `generating a career roadmap for ${role}`);
    }
  }

  async generateImage(prompt: string, aspectRatio: string): Promise<string | null> {
    try {
      const response = await this.ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
        },
      });
      if (response.generatedImages && response.generatedImages.length > 0) {
        return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
      }
      return null;
    } catch (error) {
      console.error('Error generating image:', error);
      return null;
    }
  }
  
  async generateVideoFromPrompt(prompt: string, aspectRatio: string): Promise<any> {
    let operation = await this.ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            aspectRatio: aspectRatio as "16:9" | "9:16"
        }
    });
    return this.pollVideoOperation(operation);
  }

  async generateVideoFromImage(prompt: string, imageBase64: string, mimeType: string, aspectRatio: string): Promise<any> {
    let operation = await this.ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: prompt,
        image: {
            imageBytes: imageBase64,
            mimeType: mimeType
        },
        config: {
            numberOfVideos: 1,
            aspectRatio: aspectRatio as "16:9" | "9:16"
        }
    });
    return this.pollVideoOperation(operation);
  }

  private async pollVideoOperation(operation: any): Promise<any> {
      while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
          operation = await this.ai.operations.getVideosOperation({ operation: operation });
      }
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        return `${downloadLink}&key=${this.apiKey}`;
      }
      return null;
  }
  
  startChat(systemInstruction: string, config?: object): Chat {
    return this.ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction, ...config }
    });
  }

  startLiveChat(): Chat {
    const systemInstruction = `You are AURA, a voice-first AI assistant. Be conversational and keep your responses concise and to the point, as if you were speaking. Do not use markdown, lists, or any special formatting.`;
    return this.ai.chats.create({
        model: 'gemini-2.5-flash-lite',
        config: { 
          systemInstruction,
          thinkingConfig: { thinkingBudget: 0 } 
        }
    });
  }
  
  async sendChatMessage(chat: Chat, message: string): Promise<string> {
    try {
      const response = await chat.sendMessage({ message });
      return response.text;
    } catch (error) {
      return this.handleError(error, 'sending a chat message');
    }
  }

  // FIX: Removed explicit return type `Promise<GenerateContentStreamResponse>` and let TypeScript infer it, as the type does not exist.
  async sendChatMessageStream(chat: Chat, message: string) {
    return chat.sendMessageStream({ message });
  }

  async generateQuickReplies(chatHistory: {sender: string, text: string}[], personInfo: string): Promise<string[]> {
    const history = chatHistory.map(m => `${m.sender}: ${m.text}`).join('\n');
    const prompt = `Based on the last message from Aura (the coach), suggest 3 very short, distinct, and actionable replies for me (the user). My goal is to maintain a positive relationship. The context is: ${personInfo}.
    
    Conversation History:
    ${history}
    
    Return ONLY a JSON array of 3 strings. Example: ["That makes sense.", "How do I start?", "What's another option?"]`;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          thinkingConfig: { thinkingBudget: 0 }
        },
      });
      const jsonStr = response.text.trim();
      if (jsonStr.startsWith('[') && jsonStr.endsWith(']')) {
        return JSON.parse(jsonStr);
      }
      return [];
    } catch (error) {
      console.error('Error generating quick replies:', error);
      return [];
    }
  }
  
   async transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
    try {
        const audioPart = {
            inlineData: {
                data: audioBase64,
                mimeType: mimeType
            }
        };
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, {text: "Transcribe this audio."}] },
        });
        return response.text;
    } catch(error) {
        return this.handleError(error, 'transcribing audio');
    }
  }

  async analyzeExpenses(expenses: any[]): Promise<string> {
    const prompt = `You are a personal finance expert. Analyze the following list of expenses. Provide a brief summary of spending by category, identify the top 2-3 spending areas, and offer two practical, actionable tips for better budget management or potential savings. Be encouraging and supportive. The currency is not specified, so focus on percentages, habits, and general financial advice.
    
    Expenses:
    ${JSON.stringify(expenses, null, 2)}`;
    
    return this.generateText(prompt, 'You are a helpful and non-judgmental financial coach.');
  }

  async analyzeExpenseImage(imageBase64: string, mimeType: string): Promise<string> {
    try {
        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: mimeType
            }
        };
        const textPart = {
            text: "Analyze this receipt image. Extract the vendor or store name, the total amount, and the transaction date. Respond ONLY with a JSON object with 'description', 'amount', and 'date' (in YYYY-MM-DD format) keys. If a value is unclear, set it to null."
        };

        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING, description: "Vendor or store name" },
                        amount: { type: Type.NUMBER, description: "Total amount of the expense" },
                        date: { type: Type.STRING, description: "Date of the transaction in YYYY-MM-DD format" }
                    },
                    required: ["description", "amount", "date"]
                }
            }
        });
        return response.text;
    } catch (error) {
        return this.handleError(error, 'analyzing expense image');
    }
  }

  async getStudyAssistance(context: string, query: string, useGoogleSearch: boolean): Promise<GenerateContentResponse> {
    const prompt = `Based on the following study material, please answer this question: "${query}"\n\n--- STUDY MATERIAL ---\n${context}`;
    const systemInstruction = "You are an expert study buddy and academic assistant. Your goal is to help the user understand their study material deeply. Explain concepts clearly, concisely, and accurately. Be encouraging and supportive.";
    
    const config: any = {
      systemInstruction,
    };

    if (useGoogleSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    try {
        return this.ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config,
        });
    } catch (error) {
        console.error('Error in getStudyAssistance:', error);
        const errorMessage = this.handleError(error, `getting study assistance for your query`);
        return {
            text: errorMessage,
            candidates: [],
        } as unknown as GenerateContentResponse;
    }
  }

  async generateScenarios(context: string): Promise<string> {
    const prompt = `Based on the provided study material, generate 3 distinct, practical scenarios or case studies that would help test understanding of the key concepts. Format them clearly with headings for each scenario.\n\n--- STUDY MATERIAL ---\n${context}`;
    const systemInstruction = "You are a creative and insightful academic assistant specializing in creating practical application scenarios from theoretical text. Help the user apply their knowledge.";

    return this.generateText(prompt, systemInstruction);
  }

  async generateSpeech(text: string): Promise<string | null> {
    if (!text.trim()) return null;
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: text,
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      if (part && 'inlineData' in part && part.inlineData.mimeType.startsWith('audio/')) {
        return part.inlineData.data;
      }
      console.warn('TTS response did not contain audio data.', response);
      return null;
    } catch (error) {
      this.handleError(error, 'generating speech');
      return null;
    }
  }
}