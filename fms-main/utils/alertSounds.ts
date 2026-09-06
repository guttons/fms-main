export class AlertSoundEngine {
  private static instance: AlertSoundEngine;
  private audioContext: AudioContext | null = null;
  private currentOscillators: OscillatorNode[] = [];
  private currentGainNodes: GainNode[] = [];
  private loopTimeoutId: number | NodeJS.Timeout | null = null;
  private _isPlaying: boolean = false;

  private constructor() {}

  public static getInstance(): AlertSoundEngine {
    if (!AlertSoundEngine.instance) {
      AlertSoundEngine.instance = new AlertSoundEngine();
    }
    return AlertSoundEngine.instance;
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public stop(): void {
    if (this.loopTimeoutId !== null) {
      clearTimeout(this.loopTimeoutId as any);
      this.loopTimeoutId = null;
    }

    this.currentOscillators.forEach(osc => {
      try { osc.stop(); } catch (e) {}
      osc.disconnect();
    });
    this.currentGainNodes.forEach(gain => {
      try { gain.disconnect(); } catch (e) {}
    });
    
    this.currentOscillators = [];
    this.currentGainNodes = [];
    this._isPlaying = false;
  }

  public async resume(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  public async playHighAlertAlarm(): Promise<void> {
    this.stop();
    this._isPlaying = true;
    const ctx = this.getContext();
    await this.resume();

    const playCycle = () => {
      if (!this._isPlaying) return;

      const now = ctx.currentTime;
      
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
        gain.gain.setValueAtTime(0.5, startTime + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
        
        this.currentOscillators.push(osc);
        this.currentGainNodes.push(gain);
      };

      // 800Hz / 600Hz, 200ms each, 100ms gap
      playTone(800, now, 0.2);
      playTone(600, now + 0.3, 0.2);
      
      this.loopTimeoutId = setTimeout(() => {
        if (this._isPlaying) {
          playCycle();
        }
      }, 600);
    };

    playCycle();
  }

  public async playEtaWarning(): Promise<void> {
    this.stop();
    this._isPlaying = true;
    const ctx = this.getContext();
    await this.resume();

    const now = ctx.currentTime;

    const playChime = (freq: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.6, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 1);
      
      this.currentOscillators.push(osc);
      this.currentGainNodes.push(gain);
    };

    // Gentler three-chime pattern
    playChime(523.25, now);       // C5
    playChime(659.25, now + 0.3); // E5
    playChime(783.99, now + 0.6); // G5

    setTimeout(() => {
      if (this._isPlaying) {
        this._isPlaying = false;
        this.currentOscillators = [];
        this.currentGainNodes = [];
      }
    }, 1600);
  }

  public async playEtaCritical(): Promise<void> {
    this.stop();
    this._isPlaying = true;
    const ctx = this.getContext();
    await this.resume();

    const playCycle = () => {
      if (!this._isPlaying) return;

      const now = ctx.currentTime;
      
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.4, startTime + 0.02);
        gain.gain.setValueAtTime(0.4, startTime + duration - 0.02);
        gain.gain.linearRampToValueAtTime(0, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
        
        this.currentOscillators.push(osc);
        this.currentGainNodes.push(gain);
      };

      playTone(1200, now, 0.1);
      playTone(1000, now + 0.15, 0.1);
      
      this.loopTimeoutId = setTimeout(() => {
        if (this._isPlaying) {
          playCycle();
        }
      }, 300);
    };

    playCycle();
  }

  public async playLandingChime(): Promise<void> {
    this.stop();
    this._isPlaying = true;
    const ctx = this.getContext();
    await this.resume();

    const playAscendingChime = (startTime: number) => {
      const notes = [
        { freq: 523.25, offset: 0.0, dur: 0.18 },   // C5
        { freq: 659.25, offset: 0.18, dur: 0.18 },  // E5
        { freq: 783.99, offset: 0.36, dur: 0.18 },  // G5
        { freq: 1046.50, offset: 0.54, dur: 0.45 }, // C6
      ];

      notes.forEach(({ freq, offset, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime + offset);

        gain.gain.setValueAtTime(0, startTime + offset);
        gain.gain.linearRampToValueAtTime(0.5, startTime + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.005, startTime + offset + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime + offset);
        osc.stop(startTime + offset + dur);

        this.currentOscillators.push(osc);
        this.currentGainNodes.push(gain);
      });
    };

    const now = ctx.currentTime;
    playAscendingChime(now);
    playAscendingChime(now + 1.1);

    setTimeout(() => {
      if (this._isPlaying) {
        this.stop();
      }
    }, 2400);
  }
}

export const alertSoundEngine = AlertSoundEngine.getInstance();
