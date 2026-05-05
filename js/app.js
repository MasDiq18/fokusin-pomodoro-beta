import { getJSON, setJSON } from "./storage.js";
import { AuthService } from "./auth.js";
import { TodoService } from "./todos.js";
import { MODES, MODE_ORDER, PomodoroTimer, formatTime } from "./timer.js";
import { LofiPlayer, playNotificationBeep } from "./lofi.js";

const DEFAULT_SETTINGS = {
    focusMinutes: 25,
    shortMinutes: 5,
    longMinutes: 15,
    autoMusic: false,
    musicVolume: 0.65,
    selectedMusic: "generated",
    dailyTarget: 4,
    theme: "light"
};

const MUSIC_TRACKS = [
    {
        id: "generated",
        label: "Lofi Synth Bawaan",
        type: "generated",
        src: null
    },
    {
        id: "lofi-chill",
        label: "Lofi Chill",
        type: "audio",
        src: "./audio/lofi-chill.mp3"
    },
    {
        id: "rain-focus",
        label: "Rain Focus",
        type: "audio",
        src: "./audio/rain-focus.mp3"
    },
    {
        id: "cafe-ambience",
        label: "Cafe Ambience",
        type: "audio",
        src: "./audio/cafe-ambience.mp3"
    },
    {
        id: "nature-calm",
        label: "Nature Calm",
        type: "audio",
        src: "./audio/nature-calm.mp3"
    }
];

const STANDARD_CYCLE_SETTINGS = {
    focusMinutes: 25,
    shortMinutes: 5,
    longMinutes: 15
};

const TOTAL_SESSION_DOTS = 8;
const RING_RADIUS = 132;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

let currentUser = null;
let settings = { ...DEFAULT_SETTINGS };
let stats = { completedSessions: 0 };
let timer = null;

let focusedTaskId = null;

let cycleModeEnabled = false;
let cycleFocusCount = 0;

let lastRenderedSecond = null;
let lastRenderedMode = null;

const lofiPlayer = new LofiPlayer();

const elements = {
    navUser: document.getElementById("navUser"),
    welcomeText: document.getElementById("welcomeText"),

    loginTabBtn: document.getElementById("loginTabBtn"),
    registerTabBtn: document.getElementById("registerTabBtn"),
    loginPanel: document.getElementById("loginPanel"),
    registerPanel: document.getElementById("registerPanel"),
    switchToRegisterLink: document.getElementById("switchToRegisterLink"),
    switchToLoginLink: document.getElementById("switchToLoginLink"),

    authView: document.getElementById("authView"),
    appView: document.getElementById("appView"),
    profileView: document.getElementById("profileView"),

    loginForm: document.getElementById("loginForm"),
    loginUsername: document.getElementById("loginUsername"),
    loginPassword: document.getElementById("loginPassword"),
    loginMessage: document.getElementById("loginMessage"),

    registerForm: document.getElementById("registerForm"),
    registerName: document.getElementById("registerName"),
    registerEmail: document.getElementById("registerEmail"),
    registerUsername: document.getElementById("registerUsername"),
    registerPassword: document.getElementById("registerPassword"),
    registerMessage: document.getElementById("registerMessage"),

    profileBtn: document.getElementById("profileBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    backToAppBtn: document.getElementById("backToAppBtn"),

    profileForm: document.getElementById("profileForm"),
    profileName: document.getElementById("profileName"),
    profileEmail: document.getElementById("profileEmail"),
    profileUsername: document.getElementById("profileUsername"),
    profileCreatedAt: document.getElementById("profileCreatedAt"),
    profileMessage: document.getElementById("profileMessage"),

    themeToggleBtn: document.getElementById("themeToggleBtn"),
    themeToggleIcon: document.getElementById("themeToggleIcon"),

    focusedTaskBox: document.getElementById("focusedTaskBox"),
    focusedTaskName: document.getElementById("focusedTaskName"),
    clearFocusedTaskBtn: document.getElementById("clearFocusedTaskBtn"),

    dailyTargetSelect: document.getElementById("dailyTargetSelect"),
    dailyTargetProgressBar: document.getElementById("dailyTargetProgressBar"),
    dailyTargetProgressText: document.getElementById("dailyTargetProgressText"),

    streakCalendar: document.getElementById("streakCalendar"),

    musicTrackSelect: document.getElementById("musicTrackSelect"),
    musicAudio: document.getElementById("musicAudio"),

    toastContainer: document.getElementById("toastContainer"),

    sessionPopup: document.getElementById("sessionPopup"),
    sessionPopupTitle: document.getElementById("sessionPopupTitle"),
    sessionPopupMessage: document.getElementById("sessionPopupMessage"),
    sessionPopupNextText: document.getElementById("sessionPopupNextText"),
    sessionPopupActionBtn: document.getElementById("sessionPopupActionBtn"),

    modeButtons: document.querySelectorAll(".mode-tab"),
    progressSvg: document.getElementById("progressSvg"),
    progressCircle: document.getElementById("progressCircle"),
    timerDisplay: document.getElementById("timerDisplay"),
    modeLabel: document.getElementById("modeLabel"),
    durationValue: document.getElementById("durationValue"),

    increaseBtn: document.getElementById("increaseBtn"),
    decreaseBtn: document.getElementById("decreaseBtn"),

    resetBtn: document.getElementById("resetBtn"),
    startPauseBtn: document.getElementById("startPauseBtn"),
    startPauseIcon: document.getElementById("startPauseIcon"),
    nextBtn: document.getElementById("nextBtn"),

    focusMinutes: document.getElementById("focusMinutes"),
    shortMinutes: document.getElementById("shortMinutes"),
    longMinutes: document.getElementById("longMinutes"),
    saveDurationBtn: document.getElementById("saveDurationBtn"),

    sessionDots: document.getElementById("sessionDots"),
    sessionCount: document.getElementById("sessionCount"),

    streakFlame: document.getElementById("streakFlame"),
    streakNumber: document.getElementById("streakNumber"),
    streakStatusText: document.getElementById("streakStatusText"),
    todaySessionCount: document.getElementById("todaySessionCount"),

    profileCompletedSessions: document.getElementById("profileCompletedSessions"),
    profileCurrentStreak: document.getElementById("profileCurrentStreak"),
    profileLongestStreak: document.getElementById("profileLongestStreak"),
    profileTotalFocus: document.getElementById("profileTotalFocus"),

    cycleModeSwitch: document.getElementById("cycleModeSwitch"),
    cycleModeText: document.getElementById("cycleModeText"),

    todoForm: document.getElementById("todoForm"),
    taskInput: document.getElementById("taskInput"),
    taskList: document.getElementById("taskList"),

    lofiDisc: document.getElementById("lofiDisc"),

    todoMenuBtn: document.getElementById("todoMenuBtn"),
    todoMenu: document.getElementById("todoMenu"),
    taskListNameInput: document.getElementById("taskListNameInput"),
    createTaskListBtn: document.getElementById("createTaskListBtn"),
    todoListSelect: document.getElementById("todoListSelect"),

    musicToggleBtn: document.getElementById("musicToggleBtn"),
    autoMusicCheck: document.getElementById("autoMusicCheck"),
    musicVolume: document.getElementById("musicVolume")
};

document.addEventListener("DOMContentLoaded", init);

function init() {
    setupProgressRing();
    bindAuthEvents();
    bindAuthTabEvents();
    bindAppEvents();

    currentUser = AuthService.getCurrentUser();

    if (currentUser) {
        startUserSession();
    } else {
        showAuthView();
        showAuthPanel("login");
    }
}

function setupProgressRing() {
    elements.progressCircle.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
    elements.progressCircle.style.strokeDashoffset = "0";
}

function bindAuthTabEvents() {
    elements.loginTabBtn.addEventListener("click", () => {
        showAuthPanel("login");
    });

    elements.registerTabBtn.addEventListener("click", () => {
        showAuthPanel("register");
    });

    elements.switchToRegisterLink.addEventListener("click", () => {
        showAuthPanel("register");
    });

    elements.switchToLoginLink.addEventListener("click", () => {
        showAuthPanel("login");
    });
}

function showAuthPanel(panelName) {
    const isLogin = panelName === "login";

    elements.loginTabBtn.classList.toggle("active", isLogin);
    elements.registerTabBtn.classList.toggle("active", !isLogin);

    const activePanel = isLogin ? elements.loginPanel : elements.registerPanel;
    const inactivePanel = isLogin ? elements.registerPanel : elements.loginPanel;

    inactivePanel.classList.add("d-none");
    activePanel.classList.remove("d-none");

    activePanel.classList.remove("auth-panel-animate");

    requestAnimationFrame(() => {
        activePanel.classList.add("auth-panel-animate");
    });

    clearMessage(elements.loginMessage);
    clearMessage(elements.registerMessage);
}

function bindAuthEvents() {
    elements.loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage(elements.loginMessage);

        try {
            currentUser = await AuthService.login(
                elements.loginUsername.value,
                elements.loginPassword.value
            );

            elements.loginForm.reset();
            startUserSession();
        } catch (error) {
            showMessage(elements.loginMessage, error.message, "error");
        }
    });

    elements.registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessage(elements.registerMessage);

        try {
            currentUser = await AuthService.register({
                name: elements.registerName.value,
                email: elements.registerEmail.value,
                username: elements.registerUsername.value,
                password: elements.registerPassword.value
            });

            elements.registerForm.reset();
            startUserSession();
        } catch (error) {
            showMessage(elements.registerMessage, error.message, "error");
        }
    });

    elements.logoutBtn.addEventListener("click", () => {
        AuthService.logout();

        if (timer) {
            timer.stop();
        }

        lofiPlayer.pause();
        updateMusicButton();

        currentUser = null;
        timer = null;

        showAuthView();
    });

    elements.profileBtn.addEventListener("click", () => {
        renderProfile();
        showProfileView();
    });

    elements.backToAppBtn.addEventListener("click", () => {
        showAppView();
    });

    elements.profileForm.addEventListener("submit", (event) => {
        event.preventDefault();
        clearMessage(elements.profileMessage);

        try {
            currentUser = AuthService.updateProfile({
                name: elements.profileName.value,
                email: elements.profileEmail.value
            });

            renderUser();
            showMessage(elements.profileMessage, "Profil berhasil disimpan.", "success");
        } catch (error) {
            showMessage(elements.profileMessage, error.message, "error");
        }
    });
}

function bindAppEvents() {
    elements.modeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            if (!timer || cycleModeEnabled) {
                return;
            }

            timer.setMode(button.dataset.mode);
            saveCurrentMode(button.dataset.mode);

            if (settings.autoMusic) {
                lofiPlayer.pause();
                updateMusicButton();
            }
        });
    });

    elements.increaseBtn.addEventListener("click", () => {
        if (cycleModeEnabled) {
            return;
        }

        adjustActiveDuration(1);
    });

    elements.decreaseBtn.addEventListener("click", () => {
        if (cycleModeEnabled) {
            return;
        }

        adjustActiveDuration(-1);
    });

    elements.startPauseBtn.addEventListener("click", async () => {
        if (!timer) {
            return;
        }

        if (timer.isRunning) {
            timer.pause();

            if (settings.autoMusic) {
                lofiPlayer.pause();
                updateMusicButton();
            }

            return;
        }

        timer.start();

        if (settings.autoMusic) {
            await lofiPlayer.play();
            updateMusicButton();
        }
    });

    elements.resetBtn.addEventListener("click", () => {
        if (!timer) {
            return;
        }

        timer.reset();

        if (settings.autoMusic) {
            lofiPlayer.pause();
            updateMusicButton();
        }
    });

    elements.nextBtn.addEventListener("click", () => {
        if (!timer || cycleModeEnabled) {
            return;
        }

        const nextMode = getManualNextMode(timer.mode);
        timer.setMode(nextMode);
        saveCurrentMode(nextMode);

        if (settings.autoMusic) {
            lofiPlayer.pause();
            updateMusicButton();
        }
    });

    elements.saveDurationBtn.addEventListener("click", () => {
        if (cycleModeEnabled) {
            return;
        }

        const nextSettings = {
            ...settings,
            focusMinutes: Number(elements.focusMinutes.value),
            shortMinutes: Number(elements.shortMinutes.value),
            longMinutes: Number(elements.longMinutes.value)
        };

        if (!isValidDurationSettings(nextSettings)) {
            showToast("Durasi tidak valid", "Gunakan angka positif sesuai batas input.");
            return;
        }

        settings = nextSettings;
        saveSettings();

        if (timer) {
            timer.updateDurations(settings);
        }

        renderSettingsForm();
    });

    elements.todoForm.addEventListener("submit", (event) => {
        event.preventDefault();

        try {
            TodoService.add(currentUser.username, elements.taskInput.value);
            elements.taskInput.value = "";
            renderTasks();
        } catch (error) {
            showToast("Error", error.message);
        }
    });

    elements.taskList.addEventListener("click", (event) => {
        const checkbox = event.target.closest(".task-check");
        const deleteButton = event.target.closest(".delete-task");
        const focusButton = event.target.closest(".focus-task-btn");

        if (checkbox) {
            TodoService.toggle(currentUser.username, checkbox.dataset.id);
            renderTasks();
            renderFocusedTask();
            return;
        }

        if (focusButton) {
            focusedTaskId = focusButton.dataset.id;
            saveFocusedTaskId();
            renderTasks();
            renderFocusedTask();

            showToast("Task difokuskan", "Timer sekarang terhubung dengan task pilihanmu.");
            return;
        }

        if (deleteButton) {
            const taskId = deleteButton.dataset.id;

            TodoService.remove(currentUser.username, taskId);

            if (focusedTaskId === taskId) {
                focusedTaskId = null;
                saveFocusedTaskId();
            }

            renderTasks();
            renderFocusedTask();

            showToast("Task dihapus", "Task berhasil dihapus dari list aktif.");
        }
    });

    elements.musicToggleBtn.addEventListener("click", async () => {
        if (lofiPlayer.isPlaying) {
            lofiPlayer.pause();
        } else {
            await lofiPlayer.play();
        }

        updateMusicButton();
    });

    elements.autoMusicCheck.addEventListener("change", () => {
        settings.autoMusic = elements.autoMusicCheck.checked;
        saveSettings();

        if (!settings.autoMusic) {
            lofiPlayer.pause();
            updateMusicButton();
        }
    });

    elements.musicVolume.addEventListener("input", () => {
        settings.musicVolume = Number(elements.musicVolume.value);
        lofiPlayer.setVolume(settings.musicVolume);
        saveSettings();
    });

    elements.todoMenuBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        elements.todoMenuBtn.closest(".todo-menu-wrapper").classList.toggle("is-open");
    });

    elements.todoMenu.addEventListener("click", (event) => {
        event.stopPropagation();
    });

    document.addEventListener("click", () => {
        const wrapper = elements.todoMenuBtn.closest(".todo-menu-wrapper");
        wrapper.classList.remove("is-open");
    });

    elements.createTaskListBtn.addEventListener("click", () => {
        try {
            TodoService.addList(currentUser.username, elements.taskListNameInput.value);
            elements.taskListNameInput.value = "";

            renderTaskLists();
            renderTasks();

            elements.todoMenuBtn.closest(".todo-menu-wrapper").classList.remove("is-open");
        } catch (error) {
            alert(error.message);
        }
    });

    elements.taskListNameInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
            return;
        }

        event.preventDefault();
        elements.createTaskListBtn.click();
    });

    elements.todoListSelect.addEventListener("change", () => {
        TodoService.setActiveListId(currentUser.username, elements.todoListSelect.value);
        renderTasks();
    });

    elements.cycleModeSwitch.addEventListener("change", () => {
        if (elements.cycleModeSwitch.checked) {
            enableCycleMode();
        } else {
            disableCycleMode();
        }
    });

    elements.themeToggleBtn.addEventListener("click", () => {
  settings.theme = settings.theme === "dark" ? "light" : "dark";

  saveThemePreference();
  applyTheme();

  showToast(
    "Tema diperbarui",
    settings.theme === "dark"
      ? "Mode gelap diaktifkan."
      : "Mode terang diaktifkan."
  );
});

    elements.clearFocusedTaskBtn.addEventListener("click", () => {
        focusedTaskId = null;
        saveFocusedTaskId();
        renderFocusedTask();
        renderTasks();

        showToast("Task dilepas", "Tidak ada task yang sedang difokuskan.");
    });

    elements.dailyTargetSelect.addEventListener("change", () => {
        settings.dailyTarget = Number(elements.dailyTargetSelect.value);
        saveSettings();
        renderDailyTarget();

        showToast(
            "Target harian diperbarui",
            `Target hari ini menjadi ${settings.dailyTarget} sesi Focus.`
        );
    });

    elements.musicTrackSelect.addEventListener("change", () => {
        settings.selectedMusic = elements.musicTrackSelect.value;
        saveSettings();

        lofiPlayer.setTrack(getSelectedMusicTrack());
        updateMusicButton();

        showToast(
            "Musik diganti",
            `Pilihan musik sekarang: ${getSelectedMusicTrack().label}.`
        );
    });

    elements.sessionPopupActionBtn.addEventListener("click", () => {
        elements.sessionPopup.classList.add("d-none");
    });
}

function startUserSession() {
    settings = loadSettings();
    stats = normalizeStats(loadStats());
    saveStats();

    focusedTaskId = loadFocusedTaskId();

    cycleModeEnabled = loadCycleMode();
    cycleFocusCount = loadCycleFocusCount();

    if (cycleModeEnabled) {
        settings = {
            ...settings,
            ...STANDARD_CYCLE_SETTINGS
        };

        saveSettings();
    }

    applyTheme();

    renderUser();
    renderSettingsForm();
    renderTaskLists();
    renderTasks();
    renderFocusedTask();
    renderSessionDots();
    renderStats();
    renderStreakCard();
    renderDailyTarget();
    renderCycleMode();

    initTimer();

    applyCycleModeLock();

    lofiPlayer.setAudioElement(elements.musicAudio);
    lofiPlayer.setTrack(getSelectedMusicTrack());
    lofiPlayer.setVolume(settings.musicVolume);
    updateMusicButton();

    showAppView();
}

function initTimer() {
    lastRenderedSecond = null;
    lastRenderedMode = null;

    timer = new PomodoroTimer({
        settings,
        onTick: renderTimer,
        onComplete: handleTimerComplete,
        onModeChange: renderMode
    });

    const savedMode = getJSON(`mode_${currentUser.username}`, "focus");

    if (MODES[savedMode]) {
        timer.setMode(savedMode);
    }
}

function handleTimerComplete(completedMode) {
    playNotificationBeep();

    if (completedMode === "focus") {
        updateFocusCompletionStats();

        if (cycleModeEnabled) {
            cycleFocusCount += 1;
            saveCycleFocusCount();
        }

        saveStats();
        renderStats();
        renderSessionDots();
        renderStreakCard();
        renderDailyTarget();
        renderCycleMode();
    }

    const nextMode = getAutoNextMode(completedMode);

    showSessionCompletePopup(completedMode, nextMode);

    timer.setMode(nextMode);
    saveCurrentMode(nextMode);

    if (cycleModeEnabled && completedMode === "long") {
        cycleFocusCount = 0;
        saveCycleFocusCount();
        renderCycleMode();
    }

    if (settings.autoMusic) {
        lofiPlayer.pause();
        updateMusicButton();
    }
}

function getAutoNextMode(completedMode) {
    if (completedMode !== "focus") {
        return "focus";
    }

    if (cycleModeEnabled) {
        const shouldTakeLongBreak =
            cycleFocusCount > 0 && cycleFocusCount % 4 === 0;

        return shouldTakeLongBreak ? "long" : "short";
    }

    const shouldTakeLongBreak =
        stats.completedSessions > 0 && stats.completedSessions % 4 === 0;

    return shouldTakeLongBreak ? "long" : "short";
}

function getManualNextMode(currentMode) {
    const currentIndex = MODE_ORDER.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % MODE_ORDER.length;

    return MODE_ORDER[nextIndex];
}

function adjustActiveDuration(delta) {
    if (!timer) {
        return;
    }

    const activeMode = timer.mode;
    const settingKey = getSettingKeyByMode(activeMode);
    const maxValue = getMaxDurationByMode(activeMode);
    const currentValue = Number(settings[settingKey]);
    const nextValue = Math.min(maxValue, Math.max(1, currentValue + delta));

    settings[settingKey] = nextValue;
    saveSettings();
    renderSettingsForm();

    timer.updateDurations(settings);

    if (settings.autoMusic) {
        lofiPlayer.pause();
        updateMusicButton();
    }
}

function getSettingKeyByMode(mode) {
    const map = {
        focus: "focusMinutes",
        short: "shortMinutes",
        long: "longMinutes"
    };

    return map[mode];
}

function getMaxDurationByMode(mode) {
    const map = {
        focus: 180,
        short: 60,
        long: 120
    };

    return map[mode];
}

function renderTimer({
    mode,
    remainingSeconds,
    remainingMilliseconds,
    totalSeconds,
    totalMilliseconds,
    isRunning
}) {
    const visibleSecond = Math.max(0, remainingSeconds);

    if (lastRenderedSecond !== visibleSecond) {
        elements.timerDisplay.textContent = formatTime(visibleSecond);

        if (isRunning) {
            restartTimerTickAnimation();
        }

        lastRenderedSecond = visibleSecond;
    }

    const safeRemainingMilliseconds =
        typeof remainingMilliseconds === "number"
            ? remainingMilliseconds
            : remainingSeconds * 1000;

    const safeTotalMilliseconds =
        typeof totalMilliseconds === "number"
            ? totalMilliseconds
            : totalSeconds * 1000;

    const progressRatio =
        safeTotalMilliseconds > 0
            ? safeRemainingMilliseconds / safeTotalMilliseconds
            : 0;

    const dashOffset = RING_CIRCUMFERENCE * (1 - progressRatio);

    elements.progressCircle.style.strokeDashoffset = dashOffset;
    elements.progressSvg.classList.toggle("running", isRunning);

    elements.startPauseIcon.className = isRunning
        ? "bi bi-pause-fill"
        : "bi bi-play-fill";

    elements.durationValue.textContent = settings[getSettingKeyByMode(mode)];

    renderMode(mode);
}

function restartTimerTickAnimation() {
    elements.timerDisplay.classList.remove("timer-tick");

    void elements.timerDisplay.offsetWidth;

    elements.timerDisplay.classList.add("timer-tick");
}

function renderMode(mode) {
    if (lastRenderedMode === mode) {
        return;
    }

    elements.modeLabel.textContent = MODES[mode].label;

    document.body.classList.remove("mode-focus", "mode-short", "mode-long");
    document.body.classList.add(`mode-${mode}`);

    elements.modeButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.mode === mode);
    });

    lastRenderedMode = mode;
}

function renderUser() {
    elements.welcomeText.textContent = `Halo, ${currentUser.name}`;
}

function renderSettingsForm() {
    elements.focusMinutes.value = settings.focusMinutes;
    elements.shortMinutes.value = settings.shortMinutes;
    elements.longMinutes.value = settings.longMinutes;

    elements.autoMusicCheck.checked = settings.autoMusic;
    elements.musicVolume.value = settings.musicVolume;
    elements.musicTrackSelect.value = settings.selectedMusic;
    elements.dailyTargetSelect.value = String(settings.dailyTarget);

    if (timer) {
        elements.durationValue.textContent = settings[getSettingKeyByMode(timer.mode)];
    }

    applyCycleModeLock();
}

function renderStats() {
    elements.sessionCount.textContent = stats.completedSessions;
}

function renderStreakCard() {
    if (!elements.streakFlame) {
        return;
    }

    const today = getTodayDateKey();
    const todaySessions = Number(stats.dailySessions[today] || 0);
    const hasCompletedToday = todaySessions > 0;

    elements.streakFlame.classList.toggle("streak-active", hasCompletedToday);
    elements.streakNumber.textContent = stats.currentStreak;
    elements.todaySessionCount.textContent = todaySessions;

    if (hasCompletedToday) {
        elements.streakStatusText.textContent =
            `Streak menyala. Kamu sudah menyelesaikan ${todaySessions} sesi Focus hari ini.`;
    } else {
        elements.streakStatusText.textContent =
            "Selesaikan 1 sesi Focus hari ini untuk menyalakan streak.";
    }

    renderStreakCalendar();
}

function renderSessionDots() {
    elements.sessionDots.innerHTML = "";

    const activeDots = Math.min(stats.completedSessions, TOTAL_SESSION_DOTS);

    for (let index = 0; index < TOTAL_SESSION_DOTS; index += 1) {
        const dot = document.createElement("span");
        dot.className = "session-dot";

        if (index < activeDots) {
            dot.classList.add("active");
        }

        elements.sessionDots.appendChild(dot);
    }
}

function renderTaskLists() {
    const lists = TodoService.getLists(currentUser.username);
    const activeListId = TodoService.getActiveListId(currentUser.username);

    elements.todoListSelect.innerHTML = "";

    lists.forEach((list) => {
        const option = document.createElement("option");

        option.value = list.id;
        option.textContent = list.name;
        option.selected = list.id === activeListId;

        elements.todoListSelect.appendChild(option);
    });
}

function renderTasks() {
    const tasks = TodoService.getAll(currentUser.username);

    elements.taskList.innerHTML = "";

    if (tasks.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "list-group-item empty-task";
        emptyItem.textContent = "Belum ada kegiatan. Tambahkan tugas pertamamu.";
        elements.taskList.appendChild(emptyItem);
        return;
    }

    tasks.forEach((task) => {
        const item = document.createElement("li");
        item.className = "list-group-item task-item";

        const isFocused = task.id === focusedTaskId;

        item.innerHTML = `
    <div class="d-flex align-items-center justify-content-between gap-3">
      <div class="form-check d-flex align-items-center gap-2 mb-0">
        <input
          class="form-check-input task-check"
          type="checkbox"
          data-id="${task.id}"
          ${task.completed ? "checked" : ""}
        />

        <label class="form-check-label task-name ${task.completed ? "completed" : ""}">
          ${escapeHTML(task.name)}
        </label>
      </div>

      <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
        <button
          class="btn btn-sm ${isFocused ? "btn-accent" : "btn-outline-secondary"} focus-task-btn"
          data-id="${task.id}"
          type="button"
        >
          ${isFocused ? "Aktif" : "Fokuskan"}
        </button>

        <button
  class="btn btn-sm btn-outline-danger delete-task delete-task-icon-btn"
  data-id="${task.id}"
  type="button"
  title="Hapus tugas"
  aria-label="Hapus tugas"
>
  <i class="bi bi-trash"></i>
</button>
      </div>
    </div>
  `;

        elements.taskList.appendChild(item);
    });
}

function renderProfile() {
    elements.profileName.value = currentUser.name;
    elements.profileEmail.value = currentUser.email;
    elements.profileUsername.value = currentUser.username;

    const createdDate = new Date(currentUser.createdAt).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short"
    });

    elements.profileCreatedAt.textContent = `Akun dibuat pada ${createdDate}.`;

    renderProfileStats();
    clearMessage(elements.profileMessage);
}

function renderProfileStats() {
    if (!elements.profileCompletedSessions) {
        return;
    }

    elements.profileCompletedSessions.textContent = stats.completedSessions;
    elements.profileCurrentStreak.textContent = `${stats.currentStreak} hari`;
    elements.profileLongestStreak.textContent = `${stats.longestStreak} hari`;
    elements.profileTotalFocus.textContent = formatFocusMinutes(stats.totalFocusMinutes);
}

function formatFocusMinutes(totalMinutes) {
    const minutes = Number(totalMinutes || 0);

    if (minutes < 60) {
        return `${minutes} menit`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
        return `${hours} jam`;
    }

    return `${hours} jam ${remainingMinutes} menit`;
}

function showAuthView() {
    elements.navUser.classList.add("d-none");
    elements.navUser.classList.remove("d-flex");

    elements.authView.classList.remove("d-none");
    elements.appView.classList.add("d-none");
    elements.profileView.classList.add("d-none");

    showAuthPanel("login");
}

function showAppView() {
    elements.navUser.classList.remove("d-none");
    elements.navUser.classList.add("d-flex");

    elements.authView.classList.add("d-none");
    elements.appView.classList.remove("d-none");
    elements.profileView.classList.add("d-none");
}

function showProfileView() {
    elements.authView.classList.add("d-none");
    elements.appView.classList.add("d-none");
    elements.profileView.classList.remove("d-none");
}

function enableCycleMode() {
    cycleModeEnabled = true;
    cycleFocusCount = 0;

    settings = {
        ...settings,
        ...STANDARD_CYCLE_SETTINGS
    };

    saveSettings();
    saveCycleMode();
    saveCycleFocusCount();

    if (timer) {
        timer.stop();
        timer.updateDurations(settings);
        timer.setMode("focus");
        saveCurrentMode("focus");
    }

    if (settings.autoMusic) {
        lofiPlayer.pause();
        updateMusicButton();
    }

    lastRenderedSecond = null;
    lastRenderedMode = null;

    renderSettingsForm();
    renderCycleMode();
    applyCycleModeLock();
}

function disableCycleMode() {
    cycleModeEnabled = false;
    cycleFocusCount = 0;

    saveCycleMode();
    saveCycleFocusCount();

    renderCycleMode();
    applyCycleModeLock();
}

function renderCycleMode() {
    if (!elements.cycleModeSwitch || !elements.cycleModeText) {
        return;
    }

    elements.cycleModeSwitch.checked = cycleModeEnabled;
    document.body.classList.toggle("cycle-mode-active", cycleModeEnabled);

    if (cycleModeEnabled) {
        const progress = cycleFocusCount % 4;

        elements.cycleModeText.textContent =
            `Mode siklus aktif: Focus 25 menit → Short Break 5 menit → Long Break 15 menit setelah 4 sesi. Progress siklus: ${progress}/4.`;

        return;
    }

    elements.cycleModeText.textContent =
        "Mode bebas: durasi dan mode bisa diatur manual.";
}

function applyCycleModeLock() {
    if (!elements.cycleModeSwitch) {
        return;
    }

    elements.modeButtons.forEach((button) => {
        button.disabled = cycleModeEnabled;
    });

    elements.increaseBtn.disabled = cycleModeEnabled;
    elements.decreaseBtn.disabled = cycleModeEnabled;
    elements.nextBtn.disabled = cycleModeEnabled;

    elements.focusMinutes.disabled = cycleModeEnabled;
    elements.shortMinutes.disabled = cycleModeEnabled;
    elements.longMinutes.disabled = cycleModeEnabled;
    elements.saveDurationBtn.disabled = cycleModeEnabled;
}

function loadCycleMode() {
    return getJSON(`cycle_mode_${currentUser.username}`, false);
}

function saveCycleMode() {
    setJSON(`cycle_mode_${currentUser.username}`, cycleModeEnabled);
}

function loadCycleFocusCount() {
    return getJSON(`cycle_focus_count_${currentUser.username}`, 0);
}

function saveCycleFocusCount() {
    setJSON(`cycle_focus_count_${currentUser.username}`, cycleFocusCount);
}

function loadSettings() {
    return {
        ...DEFAULT_SETTINGS,
        ...getJSON(`settings_${currentUser.username}`, {})
    };
}

function saveSettings() {
    setJSON(`settings_${currentUser.username}`, settings);
}

function loadStats() {
    return getJSON(`stats_${currentUser.username}`, createEmptyStats());
}

function createEmptyStats() {
    return {
        completedSessions: 0,
        totalFocusMinutes: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        dailySessions: {}
    };
}

function normalizeStats(rawStats) {
    const baseStats = createEmptyStats();

    const normalized = {
        ...baseStats,
        ...rawStats,
        dailySessions:
            rawStats && typeof rawStats.dailySessions === "object" && rawStats.dailySessions !== null
                ? rawStats.dailySessions
                : {}
    };

    if (!normalized.lastActiveDate) {
        return normalized;
    }

    const today = getTodayDateKey();
    const yesterday = getYesterdayDateKey();

    const streakStillValid =
        normalized.lastActiveDate === today ||
        normalized.lastActiveDate === yesterday;

    if (!streakStillValid) {
        normalized.currentStreak = 0;
    }

    return normalized;
}

function updateFocusCompletionStats() {
    const today = getTodayDateKey();
    const yesterday = getYesterdayDateKey();

    const sessionsToday = Number(stats.dailySessions[today] || 0);
    const hasCompletedToday = sessionsToday > 0;

    stats.completedSessions += 1;
    stats.totalFocusMinutes += Number(settings.focusMinutes) || 25;

    stats.dailySessions[today] = sessionsToday + 1;

    if (!hasCompletedToday) {
        if (stats.lastActiveDate === yesterday) {
            stats.currentStreak += 1;
        } else if (stats.lastActiveDate === today) {
            stats.currentStreak = Math.max(1, stats.currentStreak);
        } else {
            stats.currentStreak = 1;
        }

        stats.lastActiveDate = today;
        stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    }
}

function getTodayDateKey() {
    return formatDateKey(new Date());
}

function getYesterdayDateKey() {
    const date = new Date();
    date.setDate(date.getDate() - 1);

    return formatDateKey(date);
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function saveStats() {
    setJSON(`stats_${currentUser.username}`, stats);
}

function saveCurrentMode(mode) {
    setJSON(`mode_${currentUser.username}`, mode);
}

function isValidDurationSettings(value) {
    return (
        Number.isFinite(value.focusMinutes) &&
        Number.isFinite(value.shortMinutes) &&
        Number.isFinite(value.longMinutes) &&
        value.focusMinutes >= 1 &&
        value.shortMinutes >= 1 &&
        value.longMinutes >= 1 &&
        value.focusMinutes <= 180 &&
        value.shortMinutes <= 60 &&
        value.longMinutes <= 120
    );
}

function updateMusicButton() {
    elements.musicToggleBtn.textContent = lofiPlayer.isPlaying
        ? "Hentikan Musik"
        : "Putar Musik";

    if (elements.lofiDisc) {
        elements.lofiDisc.classList.toggle("playing", lofiPlayer.isPlaying);
    }
}

function showMessage(element, message, type) {
    element.textContent = message;
    element.classList.remove("error", "success");
    element.classList.add(type);
}

function clearMessage(element) {
    element.textContent = "";
    element.classList.remove("error", "success");
}

function getSelectedMusicTrack() {
    const selectedTrack = MUSIC_TRACKS.find((track) => {
        return track.id === settings.selectedMusic;
    });

    return selectedTrack || MUSIC_TRACKS[0];
}

async function playMusicSafely() {
    try {
        lofiPlayer.setTrack(getSelectedMusicTrack());
        await lofiPlayer.play();
        updateMusicButton();
    } catch {
        showToast(
            "Musik tidak dapat diputar",
            "Pastikan file audio tersedia atau gunakan Lofi Synth Bawaan."
        );
    }
}

function applyTheme() {
    const isDark = settings.theme === "dark";

    document.body.classList.toggle("theme-dark", isDark);

    elements.themeToggleIcon.className = isDark
        ? "bi bi-sun"
        : "bi bi-moon-stars";
}

function renderFocusedTask() {
    const focusedTask = getFocusedTask();

    if (!focusedTask) {
        elements.focusedTaskName.textContent = "Belum ada task dipilih";
        elements.focusedTaskBox.classList.remove("has-focused-task");
        elements.clearFocusedTaskBtn.disabled = true;
        return;
    }

    elements.focusedTaskName.textContent = focusedTask.name;
    elements.focusedTaskBox.classList.add("has-focused-task");
    elements.clearFocusedTaskBtn.disabled = false;
}

function getFocusedTask() {
    if (!focusedTaskId) {
        return null;
    }

    const tasks = TodoService.getAll(currentUser.username);

    return tasks.find((task) => task.id === focusedTaskId) || null;
}

function loadFocusedTaskId() {
    return getJSON(`focused_task_${currentUser.username}`, null);
}

function saveFocusedTaskId() {
    setJSON(`focused_task_${currentUser.username}`, focusedTaskId);
}

function renderDailyTarget() {
    const today = getTodayDateKey();
    const todaySessions = Number(stats.dailySessions[today] || 0);
    const target = Number(settings.dailyTarget || 4);

    const progressPercent = Math.min(100, (todaySessions / target) * 100);

    elements.dailyTargetSelect.value = String(target);
    elements.dailyTargetProgressBar.style.width = `${progressPercent}%`;
    elements.dailyTargetProgressText.textContent =
        `${todaySessions}/${target} sesi selesai hari ini.`;

    if (todaySessions >= target) {
        elements.dailyTargetProgressText.textContent =
            `${todaySessions}/${target} sesi selesai. Target hari ini tercapai.`;
    }
}

function renderStreakCalendar() {
    if (!elements.streakCalendar) {
        return;
    }

    elements.streakCalendar.innerHTML = "";

    const todayKey = getTodayDateKey();

    for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - offset);

        const dateKey = formatDateKey(date);
        const dayLabel = date.toLocaleDateString("id-ID", {
            weekday: "short"
        });

        const hasSession = Number(stats.dailySessions[dateKey] || 0) > 0;

        const item = document.createElement("div");
        item.className = "streak-day";

        if (hasSession) {
            item.classList.add("active");
        }

        if (dateKey === todayKey) {
            item.classList.add("today");
        }

        item.innerHTML = `
      <span class="streak-day-label">${dayLabel}</span>
      <span class="streak-day-dot"></span>
    `;

        elements.streakCalendar.appendChild(item);
    }
}

function showToast(title, message, duration = 3200) {
    if (!elements.toastContainer) {
        return;
    }

    const toast = document.createElement("div");
    toast.className = "toast-custom";

    toast.innerHTML = `
    <i class="bi bi-info-circle-fill"></i>
    <div>
      <strong>${escapeHTML(title)}</strong>
      <span>${escapeHTML(message)}</span>
    </div>
  `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "toastLeave 0.2s ease forwards";

        setTimeout(() => {
            toast.remove();
        }, 220);
    }, duration);
}

function showSessionCompletePopup(completedMode, nextMode) {
    const focusedTask = getFocusedTask();

    let title = `${MODES[completedMode].displayName} selesai`;
    let message = "Bagus. Kamu sudah menyelesaikan satu sesi dengan konsisten.";

    if (completedMode === "focus") {
        title = "Sesi Focus selesai";
        message = focusedTask
            ? `Bagus. Kamu berhasil fokus pada “${focusedTask.name}”. Ambil jeda sejenak agar energi tetap terjaga.`
            : "Bagus. Kamu sudah menyelesaikan satu sesi Focus. Ambil jeda sejenak sebelum lanjut.";
    }

    if (completedMode === "short") {
        message = "Waktu istirahat singkat selesai. Saatnya kembali fokus perlahan.";
    }

    if (completedMode === "long") {
        message = "Istirahat panjang selesai. Kamu sudah menyelesaikan satu rangkaian Pomodoro dengan baik.";
    }

    elements.sessionPopupTitle.textContent = title;
    elements.sessionPopupMessage.textContent = message;
    elements.sessionPopupNextText.textContent =
        `Mode berikutnya: ${MODES[nextMode].displayName}.`;

    elements.sessionPopup.classList.remove("d-none");
}

function escapeHTML(value) {
    return value.replace(/[&<>"']/g, (character) => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return replacements[character];
    });
}
