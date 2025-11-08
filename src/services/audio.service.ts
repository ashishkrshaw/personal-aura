
import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  isRecording = signal(false);

  async startRecording(): Promise<void> {
    if (this.isRecording()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = event => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
    } catch (err) {
      console.error("Error starting recording:", err);
      // Potentially update a signal to show an error to the user
    }
  }

  stopRecording(): Promise<{ blob: Blob, base64: string, mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording()) {
        return reject("Not recording");
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve({ blob: audioBlob, base64: base64String, mimeType: audioBlob.type });
        };
        reader.onerror = error => reject(error);
        
        // Cleanup
        this.audioChunks = [];
        this.mediaRecorder = null;
        this.isRecording.set(false);
      };

      this.mediaRecorder.stop();
    });
  }
}
