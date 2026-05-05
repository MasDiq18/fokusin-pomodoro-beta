function getAudioContextClass() {
  return window.AudioContext || window.webkitAudioContext;
}

export class LofiPlayer {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.filter = null;
    this.intervalId = null;
    this.isPlaying = false;
    this.volume = 0.65;
    this.step = 0;

    this.track = {
      id: "generated",
      label: "Lofi Synth Bawaan",
      type: "generated",
      src: null
    };

    this.audioElement = null;

    this.chords = [
      [261.63, 329.63, 392.0],
      [220.0, 277.18, 329.63],
      [246.94, 311.13, 369.99],
      [196.0, 246.94, 293.66]
    ];
  }

  setAudioElement(audioElement) {
    this.audioElement = audioElement;

    if (this.audioElement) {
      this.audioElement.loop = true;
      this.audioElement.volume = this.volume;
    }
  }

  setTrack(track) {
    const wasPlaying = this.isPlaying;

    this.pause();

    this.track = track;

    if (this.audioElement && track.type === "audio") {
      this.audioElement.src = track.src;
      this.audioElement.load();
    }

    if (wasPlaying) {
      this.play();
    }
  }

  async initGeneratedAudio() {
    if (this.audioContext) {
      return;
    }

    const AudioContextClass = getAudioContextClass();

    if (!AudioContextClass) {
      throw new Error("Browser tidak mendukung Web Audio API.");
    }

    this.audioContext = new AudioContextClass();

    this.filter = this.audioContext.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 1350;

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.volume;

    this.filter.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);
  }

  async play() {
    if (this.track.type === "audio") {
      if (!this.audioElement) {
        throw new Error("Elemen audio belum tersedia.");
      }

      if (!this.audioElement.src) {
        this.audioElement.src = this.track.src;
      }

      this.audioElement.volume = this.volume;
      await this.audioElement.play();

      this.isPlaying = true;
      return;
    }

    await this.initGeneratedAudio();

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    this.playChord();

    this.intervalId = setInterval(() => {
      this.playChord();
    }, 1050);
  }

  pause() {
    if (this.audioElement) {
      this.audioElement.pause();
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isPlaying = false;
  }

  setVolume(volume) {
    this.volume = Number(volume);

    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }

    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(
        this.volume,
        this.audioContext.currentTime,
        0.01
      );
    }
  }

  playChord() {
    if (!this.audioContext || !this.filter) {
      return;
    }

    const now = this.audioContext.currentTime;
    const chord = this.chords[this.step % this.chords.length];

    chord.forEach((frequency, index) => {
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;

      const peakGain = index === 0 ? 0.13 : 0.09;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peakGain, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

      oscillator.connect(gain);
      gain.connect(this.filter);

      oscillator.start(now);
      oscillator.stop(now + 1);
    });

    this.step += 1;
  }
}

export function playNotificationBeep() {
  try {
    const AudioContextClass = getAudioContextClass();

    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;

    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, audioContext.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.45);
  } catch {
    // Suara notifikasi diabaikan jika browser memblokir audio.
  }
}
