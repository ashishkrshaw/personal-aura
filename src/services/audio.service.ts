
import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  isRecording = signal(false);

  // For VAD
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private silenceRequestAnimationFrame: number | null = null;
  private silenceStart: number = 0;
  private readonly SILENCE_THRESHOLD = 20; // Lower is more sensitive. Out of 255.
  private readonly SILENCE_DURATION_MS = 1500;

  async startRecording(onSilence?: () => void): Promise<void> {
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
        this.cleanupVAD();
      };
      
      this.mediaRecorder.start();
      this.isRecording.set(true);
      
      if (onSilence) {
        this.audioContext = new AudioContext();
        this.analyser = this.audioContext.createAnalyser();
        this.sourceNode = this.audioContext.createMediaStreamSource(stream);
        this.sourceNode.connect(this.analyser);
        this.analyser.fftSize = 256;
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
        this.silenceStart = Date.now();
        this.checkForSilence(onSilence);
      }

    } catch (err) {
      console.error("Error starting recording:", err);
      this.cleanupVAD();
    }
  }

  private checkForSilence(onSilence: () => void) {
    if (!this.analyser || !this.dataArray || !this.isRecording()) return;

    this.analyser.getByteFrequencyData(this.dataArray);
    const average = this.dataArray.reduce((acc, val) => acc + val, 0) / this.dataArray.length;
    
    if (average < this.SILENCE_THRESHOLD) {
      if (Date.now() - this.silenceStart > this.SILENCE_DURATION_MS) {
        onSilence();
        return; 
      }
    } else {
      this.silenceStart = Date.now();
    }

    this.silenceRequestAnimationFrame = requestAnimationFrame(() => this.checkForSilence(onSilence));
  }
  
  private cleanupVAD() {
    if (this.silenceRequestAnimationFrame) {
      cancelAnimationFrame(this.silenceRequestAnimationFrame);
      this.silenceRequestAnimationFrame = null;
    }
    this.sourceNode?.disconnect();
    this.audioContext?.close().catch(e => console.error("Error closing AudioContext", e));
    this.sourceNode = null;
    this.analyser = null;
    this.audioContext = null;
    this.dataArray = null;
  }

  stopRecording(): Promise<{ blob: Blob, base64: string, mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
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
        
        // Final cleanup
        this.audioChunks = [];
        this.mediaRecorder = null;
        this.isRecording.set(false);
        this.cleanupVAD();
      };
      
      if (this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
      }
    });
  }
}