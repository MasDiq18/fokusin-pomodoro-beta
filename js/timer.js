export const MODES = {
  focus: {
    label: "FOCUS",
    displayName: "Focus"
  },
  short: {
    label: "SHORT BREAK",
    displayName: "Short Break"
  },
  long: {
    label: "LONG BREAK",
    displayName: "Long Break"
  }
};

export const MODE_ORDER = ["focus", "short", "long"];

export function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export class PomodoroTimer {
  constructor({ settings, onTick, onComplete, onModeChange }) {
    this.mode = "focus";
    this.intervalId = null;
    this.isRunning = false;
    this.targetEndTime = null;

    this.onTick = onTick;
    this.onComplete = onComplete;
    this.onModeChange = onModeChange;

    this.durations = this.createDurations(settings);
    this.remainingMilliseconds = this.totalMilliseconds;
    this.remainingSeconds = Math.ceil(this.remainingMilliseconds / 1000);

    this.emitModeChange();
    this.emitTick();
  }

  createDurations(settings) {
    return {
      focus: Number(settings.focusMinutes) * 60,
      short: Number(settings.shortMinutes) * 60,
      long: Number(settings.longMinutes) * 60
    };
  }

  get totalSeconds() {
    return this.durations[this.mode];
  }

  get totalMilliseconds() {
    return this.totalSeconds * 1000;
  }

  start() {
    if (this.isRunning) {
      return;
    }

    if (this.remainingMilliseconds <= 0) {
      this.remainingMilliseconds = this.totalMilliseconds;
      this.remainingSeconds = Math.ceil(this.remainingMilliseconds / 1000);
    }

    this.isRunning = true;
    this.targetEndTime = Date.now() + this.remainingMilliseconds;

    this.emitTick();

    this.intervalId = setInterval(() => {
      this.tick();
    }, 100);
  }

  pause() {
    if (!this.isRunning) {
      return;
    }

    this.syncRemainingTime();
    this.stop();
    this.emitTick();
  }

  stop() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    this.targetEndTime = null;
  }

  reset() {
    this.stop();
    this.remainingMilliseconds = this.totalMilliseconds;
    this.remainingSeconds = Math.ceil(this.remainingMilliseconds / 1000);
    this.emitTick();
  }

  setMode(mode) {
    if (!MODES[mode]) {
      return;
    }

    this.stop();
    this.mode = mode;
    this.remainingMilliseconds = this.totalMilliseconds;
    this.remainingSeconds = Math.ceil(this.remainingMilliseconds / 1000);

    this.emitModeChange();
    this.emitTick();
  }

  updateDurations(settings) {
    this.stop();
    this.durations = this.createDurations(settings);
    this.remainingMilliseconds = this.totalMilliseconds;
    this.remainingSeconds = Math.ceil(this.remainingMilliseconds / 1000);
    this.emitTick();
  }

  syncRemainingTime() {
    if (!this.targetEndTime) {
      return;
    }

    const millisecondsLeft = Math.max(0, this.targetEndTime - Date.now());

    this.remainingMilliseconds = millisecondsLeft;
    this.remainingSeconds = Math.ceil(millisecondsLeft / 1000);
  }

  tick() {
    this.syncRemainingTime();
    this.emitTick();

    if (this.remainingMilliseconds <= 0) {
      this.finish();
    }
  }

  finish() {
    this.stop();
    this.remainingMilliseconds = 0;
    this.remainingSeconds = 0;
    this.emitTick();

    if (typeof this.onComplete === "function") {
      this.onComplete(this.mode);
    }
  }

  emitTick() {
    if (typeof this.onTick !== "function") {
      return;
    }

    this.onTick({
      mode: this.mode,
      remainingSeconds: this.remainingSeconds,
      remainingMilliseconds: this.remainingMilliseconds,
      totalSeconds: this.totalSeconds,
      totalMilliseconds: this.totalMilliseconds,
      isRunning: this.isRunning
    });
  }

  emitModeChange() {
    if (typeof this.onModeChange === "function") {
      this.onModeChange(this.mode);
    }
  }
}