/* -------------------------------------------------------------
   Web Audio API Procedural Sound Synthesizer
   Synthesizes all ambient horror sounds, humming lights, footstep
   clicks, dynamic heartbeats, and jumpscare screeches in real-time.
   ------------------------------------------------------------- */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.lightHumOsc = null;
    this.lightHumGain = null;
    this.ambientDroneOsc = null;
    this.ambientDroneGain = null;
    this.isEnabled = false;
    this.isHumPlaying = false;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    
    // Master gain controls overall volume
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
    
    this.isEnabled = true;
    this.startAmbientDrone();
  }

  toggle() {
    if (!this.ctx) {
      this.init();
      return true;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
      this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      return true;
    } else if (this.ctx.state === 'running') {
      this.masterGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      this.ctx.suspend();
      return false;
    }
    return false;
  }

  // Creepy horror background synthesizer drone
  startAmbientDrone() {
    if (!this.isEnabled) return;
    try {
      this.ambientDroneOsc = this.ctx.createOscillator();
      this.ambientDroneOsc.type = 'sawtooth';
      this.ambientDroneOsc.frequency.setValueAtTime(45, this.ctx.currentTime); // very low hum
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(80, this.ctx.currentTime);
      
      this.ambientDroneGain = this.ctx.createGain();
      this.ambientDroneGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      
      // Dynamic modulation LFO for creeping volume
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.2, this.ctx.currentTime); // 0.2Hz wave
      
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      
      lfo.connect(lfoGain);
      lfoGain.connect(this.ambientDroneGain.gain);
      
      this.ambientDroneOsc.connect(filter);
      filter.connect(this.ambientDroneGain);
      this.ambientDroneGain.connect(this.masterGain);
      
      this.ambientDroneOsc.start();
      lfo.start();
    } catch (e) {
      console.warn("Drone sound init failed:", e);
    }
  }

  // Synthesizes the famous fluorescent light hum (50Hz hum + high buzz harmonics)
  startLightHum() {
    if (!this.isEnabled || this.isHumPlaying) return;
    try {
      // 50Hz hum
      this.lightHumOsc = this.ctx.createOscillator();
      this.lightHumOsc.type = 'triangle';
      this.lightHumOsc.frequency.setValueAtTime(50, this.ctx.currentTime);

      // Add high frequency harmonic for buzzing sound
      const buzzOsc = this.ctx.createOscillator();
      buzzOsc.type = 'sawtooth';
      buzzOsc.frequency.setValueAtTime(100, this.ctx.currentTime); // harmonic

      const buzzFilter = this.ctx.createBiquadFilter();
      buzzFilter.type = 'bandpass';
      buzzFilter.frequency.setValueAtTime(1500, this.ctx.currentTime);
      buzzFilter.Q.setValueAtTime(4, this.ctx.currentTime);

      this.lightHumGain = this.ctx.createGain();
      this.lightHumGain.gain.setValueAtTime(0.04, this.ctx.currentTime); // low hum

      const buzzGain = this.ctx.createGain();
      buzzGain.gain.setValueAtTime(0.004, this.ctx.currentTime); // low buzz

      // Dynamic electrical crackling modulation (Random hum shifts)
      const crackleOsc = this.ctx.createOscillator();
      crackleOsc.frequency.setValueAtTime(8, this.ctx.currentTime);
      const crackleGain = this.ctx.createGain();
      crackleGain.gain.setValueAtTime(0.002, this.ctx.currentTime);

      crackleOsc.connect(crackleGain);
      crackleGain.connect(this.lightHumGain.gain);

      this.lightHumOsc.connect(this.lightHumGain);
      buzzOsc.connect(buzzFilter);
      buzzFilter.connect(buzzGain);

      this.lightHumGain.connect(this.masterGain);
      buzzGain.connect(this.masterGain);

      this.lightHumOsc.start();
      buzzOsc.start();
      crackleOsc.start();
      this.isHumPlaying = true;
    } catch (e) {
      console.warn("Light hum init failed:", e);
    }
  }

  updateLightHumVolume(distanceToLight) {
    if (!this.isHumPlaying || !this.lightHumGain) return;
    // Lower volume when player is far away
    const maxDistance = 25;
    let volume = 1.0 - Math.min(distanceToLight / maxDistance, 1.0);
    volume = Math.pow(volume, 2) * 0.08; // scale down
    this.lightHumGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
  }

  // Dynamic heartbeat thumping (Triangle low thump)
  playHeartbeat(intensity) {
    if (!this.isEnabled || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      
      const thump = (time, volume) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(55, time); // low frequency thud
        osc.frequency.exponentialRampToValueAtTime(15, time + 0.15);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(70, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + 0.35);
      };

      // Double heartbeat thump (lub-dub)
      const baseVol = 0.15 + (intensity * 0.25);
      thump(now, baseVol);
      thump(now + 0.16, baseVol * 0.7);
    } catch (e) {
      console.warn("Heartbeat synthesis failed:", e);
    }
  }

  // Synthesizes realistic low-frequency footstep thuds using white noise bursts
  playFootstep(isSprinting) {
    if (!this.isEnabled || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.12; // short sound
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Fill buffer with white noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;
      
      // Biquad lowpass filters to simulate dull floor impact
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isSprinting ? 220 : 160, now);
      filter.Q.setValueAtTime(2, now);
      
      const gainNode = this.ctx.createGain();
      const volume = isSprinting ? 0.22 : 0.11;
      gainNode.gain.setValueAtTime(volume, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      
      noiseNode.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      noiseNode.start(now);
    } catch (e) {
      console.warn("Footstep synthesis failed:", e);
    }
  }

  // Synthesizes a sci-fi chime upon key/item pickup
  playPickup() {
    if (!this.isEnabled || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.2); // C6

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, now); // E5
      osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.2); // E6

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(now);
      osc2.start(now);
      
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.warn("Pickup synth failed:", e);
    }
  }

  // Synthesizes a loud, terrifying, screeching screamer jumpscare!
  playJumpscare() {
    if (!this.isEnabled || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime); // full blast volume
      
      const now = this.ctx.currentTime;
      const duration = 2.0;

      // 4 heavy detuned sawtooth oscillators to create a massive screeching wall of sound
      const frequencies = [90, 95, 230, 480];
      const oscillators = [];

      const highPassFilter = this.ctx.createBiquadFilter();
      highPassFilter.type = 'highpass';
      highPassFilter.frequency.setValueAtTime(150, now);
      
      const horrorGain = this.ctx.createGain();
      horrorGain.gain.setValueAtTime(0, now);
      horrorGain.gain.linearRampToValueAtTime(0.65, now + 0.05);
      horrorGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      // Synthesize raw white noise to overlay harsh static fuzz
      const bufferSize = this.ctx.sampleRate * duration;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.45, now + 0.05);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      noiseNode.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noiseNode.start(now);

      frequencies.forEach(f => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now);
        
        // Pitch modulation: rapidly rising pitch to simulate a horrifying scream
        osc.frequency.exponentialRampToValueAtTime(f * 4.2, now + 0.5);
        osc.frequency.exponentialRampToValueAtTime(f * 0.5, now + duration);
        
        osc.connect(highPassFilter);
        oscillators.push(osc);
        osc.start(now);
        osc.stop(now + duration);
      });

      highPassFilter.connect(horrorGain);
      horrorGain.connect(this.masterGain);

    } catch (e) {
      console.warn("Jumpscare sound synthesis failed:", e);
    }
  }
}

export const AudioSys = new AudioEngine();
