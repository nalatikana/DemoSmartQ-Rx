const STORAGE_KEY = "pharmacy-queue-demo-state";
const SESSION_KEY = "pharmacy-queue-demo-session";
const CHANNEL_NAME = "pharmacy-queue-demo-sync";
const STATE_VERSION = 5;
const MAX_QUEUE = 600;
const COOLDOWN_SECONDS = 4;

const accounts = {
  nurse: { password: "1234", name: "Nurse A", role: "พนักงานห้องยา", views: ["operation", "tv"] },
  manager: { password: "1234", name: "Manager", role: "ผู้บริหาร", views: ["executive", "tv"] },
  admin: { password: "1234", name: "Admin", role: "แอดมิน", views: ["operation", "tv", "executive", "admin"] }
};

const defaultUsers = [
  { name: "Nurse A", role: "พนักงานห้องยา", status: "ใช้งาน" },
  { name: "Manager", role: "ผู้บริหาร", status: "ใช้งาน" },
  { name: "Admin", role: "แอดมิน", status: "ใช้งาน" }
];

const defaultState = {
  version: STATE_VERSION,
  currentQueue: 1,
  nextQueueNumber: 2,
  counter: "ช่องรับยา 1",
  counterQueues: {
    "ช่องรับยา 1": 1,
    "ช่องรับยา 2": null
  },
  banner:
    "ประกาศ: กรุณาเตรียมบัตรประชาชนและใบสั่งยาให้พร้อมก่อนเข้ารับบริการ | ห้องยาขออภัยหากท่านรอนาน",
  skipped: [],
  completedQueues: [],
  completed: 0,
  totalCalled: 1,
  highestQueue: 1,
  events: [
    {
      type: "call",
      queue: 1,
      counter: "ช่องรับยา 1",
      note: "คิวเริ่มต้น",
      user: "System",
      time: new Date().toISOString(),
      date: getTodayKey()
    }
  ],
  bannerHistory: [
    {
      banner:
        "ประกาศ: กรุณาเตรียมบัตรประชาชนและใบสั่งยาให้พร้อมก่อนเข้ารับบริการ | ห้องยาขออภัยหากท่านรอนาน",
      user: "System",
      time: new Date().toISOString(),
      date: getTodayKey()
    }
  ],
  auditLogs: [],
  users: defaultUsers,
  lastUpdated: new Date().toISOString(),
  serviceDate: getTodayKey()
};

const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
let state = loadState();
let session = loadSession();
let cooldownTimer = null;

const els = {
  loginScreen: document.querySelector("#login-screen"),
  appShell: document.querySelector("#app-shell"),
  loginForm: document.querySelector("#login-form"),
  usernameInput: document.querySelector("#username-input"),
  passwordInput: document.querySelector("#password-input"),
  loginError: document.querySelector("#login-error"),
  signedInName: document.querySelector("#signed-in-name"),
  signedInRole: document.querySelector("#signed-in-role"),
  logoutBtn: document.querySelector("#logout-btn"),
  navItems: document.querySelectorAll(".nav-item"),
  panels: document.querySelectorAll("[data-view-panel]"),
  tvBanner: document.querySelector("#tv-banner"),
  tvDate: document.querySelector("#tv-date"),
  tvTime: document.querySelector("#tv-time"),
  tvCounter1: document.querySelector("#tv-counter-1"),
  tvCounter2: document.querySelector("#tv-counter-2"),
  tvCalledGrid: document.querySelector("#tv-called-grid"),
  tvWaitingQueue: document.querySelector("#tv-waiting-queue"),
  tvLastUpdated: document.querySelector("#tv-last-updated"),
  missedCount: document.querySelector("#missed-count"),
  opCurrentNumber: document.querySelector("#op-current-number"),
  opCurrentCounter: document.querySelector("#op-current-counter"),
  staffTotal: document.querySelector("#staff-total"),
  staffWaiting: document.querySelector("#staff-waiting"),
  staffNext: document.querySelector("#staff-next"),
  staffCalled: document.querySelector("#staff-called"),
  counterButtons: document.querySelectorAll(".counter-button"),
  nextBtn: document.querySelector("#next-btn"),
  recallBtn: document.querySelector("#recall-btn"),
  skipBtn: document.querySelector("#skip-btn"),
  completeBtn: document.querySelector("#complete-btn"),
  nextQueueNote: document.querySelector("#next-queue-note"),
  cooldownText: document.querySelector("#cooldown-text"),
  manualForm: document.querySelector("#manual-form"),
  manualQueueInput: document.querySelector("#manual-queue-input"),
  manualHelp: document.querySelector("#manual-help"),
  opHistoryList: document.querySelector("#op-history-list"),
  historyCount: document.querySelector("#history-count"),
  completedList: document.querySelector("#completed-list"),
  completedCount: document.querySelector("#completed-count"),
  metricTotal: document.querySelector("#metric-total"),
  metricComplete: document.querySelector("#metric-complete"),
  metricSkipped: document.querySelector("#metric-skipped"),
  metricWait: document.querySelector("#metric-wait"),
  barChart: document.querySelector("#bar-chart"),
  dashboardDate: document.querySelector("#dashboard-date"),
  dashboardBanner: document.querySelector("#dashboard-banner"),
  exportBtn: document.querySelector("#export-btn"),
  exportQueueBtn: document.querySelector("#export-queue-btn"),
  exportDashboardBtn: document.querySelector("#export-dashboard-btn"),
  bannerInput: document.querySelector("#banner-input"),
  saveBannerBtn: document.querySelector("#save-banner-btn"),
  resetBtn: document.querySelector("#reset-btn"),
  userList: document.querySelector("#user-list"),
  auditList: document.querySelector("#audit-list")
};

function getTodayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function createDefaultState() {
  const now = new Date().toISOString();
  const today = getTodayKey();
  const nextState = JSON.parse(JSON.stringify(defaultState));
  nextState.lastUpdated = now;
  nextState.serviceDate = today;
  nextState.events = nextState.events.map((event) => ({ ...event, time: now, date: today }));
  nextState.bannerHistory = nextState.bannerHistory.map((item) => ({ ...item, time: now, date: today }));
  return nextState;
}

function padQueue(number) {
  return String(number).padStart(3, "0");
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const parsed = saved ? JSON.parse(saved) : createDefaultState();

  if (parsed.version !== STATE_VERSION) {
    return createDefaultState();
  }

  if (parsed.serviceDate !== getTodayKey()) {
    return {
      ...createDefaultState(),
      auditLogs: [
        {
          action: "ระบบรีเซ็ตคิวอัตโนมัติ",
          user: "System",
          time: new Date().toISOString()
        }
      ]
    };
  }

  return { ...defaultState, ...parsed };
}

function loadSession() {
  const saved = sessionStorage.getItem(SESSION_KEY);
  return saved ? JSON.parse(saved) : null;
}

function saveSession(nextSession) {
  session = nextSession;
  if (session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
  renderAuth();
}

function currentUserName() {
  return session?.name || "Demo User";
}

function persist(action, user = currentUserName()) {
  state.lastUpdated = new Date().toISOString();
  state.highestQueue = Math.max(state.highestQueue || 1, state.currentQueue);
  if (action) {
    state.auditLogs = [
      { action, user, time: state.lastUpdated },
      ...state.auditLogs
    ].slice(0, 60);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (channel) {
    channel.postMessage(state);
  }
  render();
}

function addEvent(type, queue, note, counter = state.counter) {
  state.events = [
    {
      type,
      queue,
      counter,
      note,
      user: currentUserName(),
      time: new Date().toISOString(),
      date: getTodayKey()
    },
    ...(state.events || [])
  ].slice(0, 1000);
}

function renderAuth() {
  const isLoggedIn = Boolean(session);
  els.loginScreen.classList.toggle("is-hidden", isLoggedIn);
  els.appShell.classList.toggle("is-hidden", !isLoggedIn);

  if (!session) return;

  els.signedInName.textContent = session.name;
  els.signedInRole.textContent = session.role;

  els.navItems.forEach((item) => {
    const allowed = session.views.includes(item.dataset.view);
    item.classList.toggle("is-hidden", !allowed);
  });

  const activeAllowed = [...els.navItems].some(
    (item) => item.classList.contains("active") && !item.classList.contains("is-hidden")
  );
  if (!activeAllowed) {
    switchView(session.views[0]);
  }
}

function render() {
  const queueText = padQueue(state.currentQueue);
  const called = state.totalCalled || 0;
  const waiting = Math.max(MAX_QUEUE - (state.nextQueueNumber || 1) + 1, 0);
  const nextText = padQueue(state.nextQueueNumber || 1);
  const now = new Date();

  els.tvBanner.textContent = state.banner;
  els.tvDate.textContent = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(now);
  els.tvTime.textContent = new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(now);
  els.tvCounter1.textContent = formatTvQueue(state.counterQueues?.["ช่องรับยา 1"]);
  els.tvCounter2.textContent = formatTvQueue(state.counterQueues?.["ช่องรับยา 2"]);
  els.tvWaitingQueue.textContent = nextText;
  els.tvLastUpdated.textContent = `อัปเดตล่าสุด ${formatTime(state.lastUpdated)}`;
  els.opCurrentNumber.textContent = queueText;
  els.opCurrentCounter.textContent = state.counter;
  els.staffTotal.textContent = MAX_QUEUE;
  els.staffWaiting.textContent = waiting;
  els.staffNext.textContent = nextText;
  els.staffCalled.textContent = called;
  els.nextQueueNote.textContent = `กดแล้วจะเรียกคิว ${nextText}`;
  els.bannerInput.value = state.banner;
  renderCounters();
  renderMissed();
  renderHistory();
  renderCompleted();
  renderMetrics();
  renderDashboardBanner();
  renderUsers();
  renderAudit();
}

function renderCounters() {
  els.counterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.counter === state.counter);
  });
}

function renderMissed() {
  const calledEvents = (state.events || [])
    .filter((event) => isTvCalledEvent(event.type))
    .slice(0, 42);
  els.missedCount.textContent = `${calledEvents.length} รายการ`;
  els.tvCalledGrid.innerHTML = calledEvents.length
    ? calledEvents.map((event) => `<div class="tv-called-chip">${padQueue(event.queue)}</div>`).join("")
    : `<div class="tv-called-chip">-</div>`;
}

function formatTvQueue(queue) {
  return queue ? padQueue(queue) : "-";
}

function isTvCalledEvent(type) {
  return ["call", "manual_call", "recall", "recall_missed"].includes(type);
}

function renderHistory() {
  els.historyCount.textContent = `${state.skipped.length} รายการ`;
  els.opHistoryList.innerHTML = state.skipped.length
    ? state.skipped
        .map(
          (item) => `
            <div class="history-item">
              <div class="history-card-head">
                <strong>${padQueue(item.queue)}</strong>
                <small>${item.counter} | ${formatTime(item.time)}</small>
              </div>
              <div class="history-actions">
                <button data-complete-missed="${item.queue}" class="complete-missed-btn">รับยาเลย</button>
                <button data-recall="${item.queue}">เรียกย้อนหลัง</button>
                <button data-cancel-missed="${item.queue}" class="cancel-missed-btn">ยกเลิก</button>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="empty">ไม่มีคิวค้างเรียกย้อนหลัง</div>`;

  els.opHistoryList.querySelectorAll("[data-recall]").forEach((button) => {
    button.addEventListener("click", () => recallSkipped(Number(button.dataset.recall)));
  });
  els.opHistoryList.querySelectorAll("[data-complete-missed]").forEach((button) => {
    button.addEventListener("click", () => completeMissedQueue(Number(button.dataset.completeMissed)));
  });
  els.opHistoryList.querySelectorAll("[data-cancel-missed]").forEach((button) => {
    button.addEventListener("click", () => cancelMissedQueue(Number(button.dataset.cancelMissed)));
  });
}

function renderCompleted() {
  const completed = state.completedQueues || [];
  els.completedCount.textContent = `${completed.length} รายการ`;
  els.completedList.innerHTML = completed.length
    ? completed
        .slice(0, 10)
        .map(
          (item) => `
            <div class="completed-item">
              <div>
                <strong>${padQueue(item.queue)}</strong>
                <small>${item.counter} | ${formatTime(item.time)}</small>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="empty">ยังไม่มีคิวที่รับยาแล้ว</div>`;
}

function renderMetrics() {
  const selectedDate = getDashboardDate();
  const events = getEventsForDate(selectedDate);
  const total = events.filter((event) => isCallEvent(event.type)).length;
  const skipped = events.filter((event) => event.type === "skip").length;
  const completed = events.filter((event) => event.type === "complete").length;
  const wait = total ? Math.max(3, Math.round((skipped * 2 + completed * 4) / total)) : 0;

  els.metricTotal.textContent = total;
  els.metricComplete.textContent = completed;
  els.metricSkipped.textContent = skipped;
  els.metricWait.textContent = `${wait} นาที`;

  const chartData = [
    ["คิวที่เรียก", total, varColor("--blue")],
    ["รับยาสำเร็จ", completed, varColor("--green")],
    ["ข้าม / ค้าง", skipped, varColor("--amber")]
  ];
  const max = Math.max(...chartData.map((item) => item[1]), 1);

  els.barChart.innerHTML = chartData
    .map(([label, value, color]) => {
      const width = Math.round((value / max) * 100);
      return `
        <div class="bar-row">
          <strong>${label}</strong>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%; background:${color}"></div></div>
          <span>${value}</span>
        </div>
      `;
    })
    .join("");
}

function renderDashboardBanner() {
  const selectedDate = getDashboardDate();
  const banners = (state.bannerHistory || []).filter((item) => item.date === selectedDate);

  els.dashboardBanner.innerHTML = banners.length
    ? banners
        .map(
          (item) => `
            <div class="banner-summary-item">
              <strong>${escapeHtml(item.banner)}</strong>
              <small>${formatTime(item.time)} | ${item.user}</small>
            </div>
          `
        )
        .join("")
    : `<div class="empty">ไม่พบประวัติประกาศในวันที่เลือก</div>`;
}

function getDashboardDate() {
  if (!els.dashboardDate.value) {
    els.dashboardDate.value = getTodayKey();
  }
  return els.dashboardDate.value;
}

function getEventsForDate(date) {
  return (state.events || []).filter((event) => event.date === date);
}

function isCallEvent(type) {
  return ["call", "manual_call", "recall_missed"].includes(type);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderUsers() {
  els.userList.innerHTML = state.users
    .map(
      (user) => `
        <div class="user-item">
          <div>
            <strong>${user.name}</strong>
            <small>${user.role}</small>
          </div>
          <small>${user.status}</small>
        </div>
      `
    )
    .join("");
}

function renderAudit() {
  els.auditList.innerHTML = state.auditLogs.length
    ? state.auditLogs
        .map(
          (log) => `
            <div class="audit-item">
              <div>
                <strong>${log.action}</strong>
                <small>${log.user}</small>
              </div>
              <small>${formatTime(log.time)}</small>
            </div>
          `
        )
        .join("")
    : `<div class="empty">ยังไม่มีประวัติการใช้งาน</div>`;
}

function varColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function formatTime(value) {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function announce() {
  const target = getTvCounterElement(state.counter);
  if (target) {
    target.classList.remove("flash");
    void target.offsetWidth;
    target.classList.add("flash");
  }
  playTone();
}

function getTvCounterElement(counter) {
  return counter === "ช่องรับยา 2" ? els.tvCounter2 : els.tvCounter1;
}

function playTone() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const audio = new AudioContext();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.08, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.45);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.45);
}

function startCooldown() {
  let seconds = COOLDOWN_SECONDS;
  els.nextBtn.disabled = true;
  els.cooldownText.textContent = `ป้องกันกดซ้ำ ${seconds} วินาที`;
  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    seconds -= 1;
    els.cooldownText.textContent = seconds > 0 ? `ป้องกันกดซ้ำ ${seconds} วินาที` : "พร้อมใช้งาน";
    if (seconds <= 0) {
      els.nextBtn.disabled = false;
      clearInterval(cooldownTimer);
    }
  }, 1000);
}

function getNextSequentialQueue(queue) {
  return queue >= MAX_QUEUE ? 1 : queue + 1;
}

function setCurrentQueue(queue, actionText, eventType = "call", advanceSequential = false) {
  state.currentQueue = queue;
  state.counterQueues = {
    ...(state.counterQueues || {}),
    [state.counter]: queue
  };
  state.highestQueue = Math.max(state.highestQueue || 1, queue);
  state.totalCalled += 1;
  if (advanceSequential) {
    state.nextQueueNumber = getNextSequentialQueue(queue);
  }
  state.skipped = state.skipped.filter((item) => item.queue !== queue);
  addEvent(eventType, queue, actionText);
  persist(`${actionText} ${padQueue(queue)}`);
  announce();
}

function nextQueue() {
  const next = state.nextQueueNumber || 1;
  setCurrentQueue(next, "เรียกคิวถัดไป", "call", true);
  startCooldown();
}

function skipQueue() {
  if (!state.skipped.some((item) => item.queue === state.currentQueue)) {
    state.skipped = [
      {
        queue: state.currentQueue,
        counter: state.counter,
        time: new Date().toISOString()
      },
      ...state.skipped
    ].slice(0, 120);
  }
  addEvent("skip", state.currentQueue, "ข้ามคิว");
  persist(`ข้ามคิว ${padQueue(state.currentQueue)}`);
}

function addCompletedQueue(queue, counter, note) {
  state.completed += 1;
  state.completedQueues = [
    {
      queue,
      counter,
      time: new Date().toISOString(),
      date: getTodayKey()
    },
    ...(state.completedQueues || [])
  ].slice(0, 80);
  addEvent("complete", queue, note, counter);
}

function completeQueue() {
  const completedQueue = state.currentQueue;
  addCompletedQueue(completedQueue, state.counter, "รับยาแล้ว");

  const next = state.nextQueueNumber || 1;
  state.currentQueue = next;
  state.counterQueues = {
    ...(state.counterQueues || {}),
    [state.counter]: next
  };
  state.highestQueue = Math.max(state.highestQueue || 1, next);
  state.totalCalled += 1;
  state.nextQueueNumber = getNextSequentialQueue(next);
  addEvent("call", next, "เรียกคิวถัดไปหลังรับยาแล้ว");
  persist(`รับยาแล้ว ${padQueue(completedQueue)} และเรียกคิวถัดไป ${padQueue(next)}`);
  announce();
  startCooldown();
}

function completeMissedQueue(queue) {
  const item = state.skipped.find((skipped) => skipped.queue === queue);
  if (!item) return;
  state.skipped = state.skipped.filter((skipped) => skipped.queue !== queue);
  addCompletedQueue(item.queue, item.counter, "รับยาย้อนหลังจากรายการคิวที่ข้าม");
  persist(`รับยาย้อนหลัง ${padQueue(item.queue)}`);
}

function cancelMissedQueue(queue) {
  const item = state.skipped.find((skipped) => skipped.queue === queue);
  if (!item) return;
  state.skipped = state.skipped.filter((skipped) => skipped.queue !== queue);
  addEvent("cancel_missed", item.queue, "ยกเลิกคิวที่ข้าม", item.counter);
  persist(`ยกเลิกคิวที่ข้าม ${padQueue(item.queue)}`);
}

function recallSkipped(queue) {
  const item = state.skipped.find((skipped) => skipped.queue === queue);
  if (!item) return;
  state.currentQueue = item.queue;
  state.counter = item.counter;
  state.counterQueues = {
    ...(state.counterQueues || {}),
    [item.counter]: item.queue
  };
  state.skipped = state.skipped.filter((skipped) => skipped.queue !== queue);
  state.totalCalled += 1;
  addEvent("recall_missed", queue, "เรียกย้อนหลัง", item.counter);
  persist(`เรียกย้อนหลัง ${padQueue(queue)}`);
  announce();
}

function manualCall(queueText) {
  const queue = Number(queueText);
  if (!Number.isInteger(queue) || queue < 1 || queue > MAX_QUEUE) {
    els.manualHelp.textContent = `กรุณากรอกเลขคิว 1-${MAX_QUEUE}`;
    els.manualHelp.classList.add("manual-error");
    return;
  }

  els.manualHelp.textContent = "กรอกเลข 1-600 ระบบจะแปลงเป็นเลข 3 หลักอัตโนมัติ";
  els.manualHelp.classList.remove("manual-error");
  els.manualQueueInput.value = "";
  setCurrentQueue(queue, "เรียกคิวแบบ Manual", "manual_call", false);
}

function exportQueueReport() {
  const date = getDashboardDate();
  const events = getEventsForDate(date);
  const rows = [
    ["วันที่", "เวลา", "ประเภท", "เลขคิว", "ช่องรับยา", "ผู้ใช้งาน", "รายละเอียด"],
    ...events.map((event) => [
      event.date,
      formatTime(event.time),
      eventTypeLabel(event.type),
      padQueue(event.queue),
      event.counter,
      event.user,
      event.note
    ])
  ];
  downloadExcel(`queue-call-report-${date}.xls`, "Queue Report", rows);
  persist(`Export รายงานการเรียกคิว Excel วันที่ ${date}`);
}

function exportDashboardSummary() {
  const date = getDashboardDate();
  const events = getEventsForDate(date);
  const total = events.filter((event) => isCallEvent(event.type)).length;
  const skipped = events.filter((event) => event.type === "skip").length;
  const completed = events.filter((event) => event.type === "complete").length;
  const banners = (state.bannerHistory || []).filter((item) => item.date === date);
  const rows = [
    ["วันที่", date],
    ["จำนวนคิวที่เรียก", total],
    ["รับยาแล้ว", completed],
    ["ข้ามคิว", skipped],
    ["ประกาศของวันนั้น", banners.map((item) => item.banner).join(" | ") || "-"]
  ];
  downloadExcel(`dashboard-summary-${date}.xls`, "Dashboard Summary", rows);
  persist(`Export สรุป Dashboard Excel วันที่ ${date}`);
}

function downloadExcel(filename, sheetName, rows) {
  const htmlRows = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? "")}</td>`).join("")}</tr>`
    )
    .join("");
  const workbook = `
    <html>
      <head><meta charset="UTF-8" /></head>
      <body>
        <table>
          <caption>${escapeHtml(sheetName)}</caption>
          ${htmlRows}
        </table>
      </body>
    </html>
  `;
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function eventTypeLabel(type) {
  const labels = {
    call: "เรียกคิวถัดไป",
    manual_call: "เรียกคิวแบบ Manual",
    recall: "เรียกซ้ำ",
    recall_missed: "เรียกย้อนหลัง",
    skip: "ข้ามคิว",
    complete: "รับยาแล้ว",
    cancel_missed: "ยกเลิกคิวที่ข้าม"
  };
  return labels[type] || type;
}

function resetDemo() {
  state = {
    ...createDefaultState(),
    lastUpdated: new Date().toISOString(),
    serviceDate: getTodayKey(),
    auditLogs: []
  };
  persist("รีเซ็ตข้อมูลเดโม");
  announce();
}

function switchView(view) {
  els.navItems.forEach((nav) => nav.classList.toggle("active", nav.dataset.view === view));
  els.panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === view));
}

els.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = els.usernameInput.value.trim().toLowerCase();
  const password = els.passwordInput.value;
  const account = accounts[username];

  if (!account || account.password !== password) {
    els.loginError.textContent = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
    return;
  }

  els.loginError.textContent = "";
  saveSession({ username, name: account.name, role: account.role, views: account.views });
  switchView(account.views[0]);
  persist("เข้าสู่ระบบ");
});

els.logoutBtn.addEventListener("click", () => {
  persist("ออกจากระบบ");
  saveSession(null);
});

els.navItems.forEach((item) => {
  item.addEventListener("click", () => {
    if (session && !session.views.includes(item.dataset.view)) return;
    switchView(item.dataset.view);
  });
});

els.counterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.counter = button.dataset.counter;
    persist(`เปลี่ยนช่องรับบริการเป็น ${state.counter}`);
  });
});

els.nextBtn.addEventListener("click", nextQueue);
els.recallBtn.addEventListener("click", () => {
  addEvent("recall", state.currentQueue, "เรียกซ้ำ");
  persist(`เรียกซ้ำ ${padQueue(state.currentQueue)}`);
  announce();
});
els.skipBtn.addEventListener("click", skipQueue);
els.completeBtn.addEventListener("click", completeQueue);
els.manualForm.addEventListener("submit", (event) => {
  event.preventDefault();
  manualCall(els.manualQueueInput.value.trim());
});
els.exportBtn.addEventListener("click", exportQueueReport);
els.exportQueueBtn.addEventListener("click", exportQueueReport);
els.exportDashboardBtn.addEventListener("click", exportDashboardSummary);
els.dashboardDate.addEventListener("change", () => {
  renderMetrics();
  renderDashboardBanner();
});
els.saveBannerBtn.addEventListener("click", () => {
  state.banner = els.bannerInput.value.trim() || defaultState.banner;
  state.bannerHistory = [
    {
      banner: state.banner,
      user: currentUserName(),
      time: new Date().toISOString(),
      date: getTodayKey()
    },
    ...(state.bannerHistory || [])
  ].slice(0, 200);
  persist("แก้ไขข้อความประกาศบนทีวี");
});
els.resetBtn.addEventListener("click", resetDemo);

if (channel) {
  channel.addEventListener("message", (event) => {
    state = event.data;
    render();
  });
}

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY && event.newValue) {
    state = JSON.parse(event.newValue);
    render();
  }
});

renderAuth();
render();
