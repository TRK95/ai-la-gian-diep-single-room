(() => {
"use strict";

const {
  connectGame,
  shuffle,
  escapeHtml,
  setMessage,
  formatFirebaseError
} = window.GameShared;

const presets = window.GAME_PRESETS;
const roleInfo = window.ROLE_INFO;

const views = {
  loading: document.getElementById("hostLoading"),
  claim: document.getElementById("claimView"),
  locked: document.getElementById("lockedView"),
  dashboard: document.getElementById("dashboard"),
  error: document.getElementById("hostErrorView")
};

const elements = {
  claimHostBtn: document.getElementById("claimHostBtn"),
  claimMessage: document.getElementById("claimMessage"),
  playerCountMetric: document.getElementById("playerCountMetric"),
  statusMetric: document.getElementById("statusMetric"),
  roundMetric: document.getElementById("roundMetric"),
  roomStatusBadge: document.getElementById("roomStatusBadge"),
  presetSelect: document.getElementById("presetSelect"),
  presetPreview: document.getElementById("presetPreview"),
  spyCount: document.getElementById("spyCount"),
  thirdCount: document.getElementById("thirdCount"),
  civilianCountPreview: document.getElementById("civilianCountPreview"),
  customTheme: document.getElementById("customTheme"),
  customCivilian: document.getElementById("customCivilian"),
  customSpy: document.getElementById("customSpy"),
  customThird: document.getElementById("customThird"),
  useCustomBtn: document.getElementById("useCustomBtn"),
  startGameBtn: document.getElementById("startGameBtn"),
  newRoundBtn: document.getElementById("newRoundBtn"),
  gameMessage: document.getElementById("gameMessage"),
  emptyPlayers: document.getElementById("emptyPlayers"),
  playerTableWrap: document.getElementById("playerTableWrap"),
  playerTable: document.getElementById("playerTable"),
  copyLinkBtn: document.getElementById("copyLinkBtn"),
  clearPlayersBtn: document.getElementById("clearPlayersBtn"),
  releaseHostBtn: document.getElementById("releaseHostBtn"),
  hostFatalError: document.getElementById("hostFatalError")
};

let user;
let rootRef;
let ownerUid = null;
let players = {};
let assignments = {};
let publicState = {};
let selectedPreset = presets[0];
let listenersAttached = false;
let updatingCount = false;

function showView(name) {
  views.loading.classList.toggle("is-hidden", name !== "loading");
  views.claim.classList.toggle("is-hidden", name !== "claim");
  views.locked.classList.toggle("is-hidden", name !== "locked");
  views.dashboard.classList.toggle("is-hidden", name !== "dashboard");
  views.error.classList.toggle("is-hidden", name !== "error");
}

async function init() {
  try {
    const connection = await connectGame();
    ({ user, rootRef } = connection);

    renderPresetOptions();
    bindEvents();

    rootRef.child("ownerUid").on("value", (snapshot) => {
      ownerUid = snapshot.val();
      if (!ownerUid) {
        showView("claim");
      } else if (ownerUid === user.uid) {
        showView("dashboard");
        attachDashboardListeners();
      } else {
        showView("locked");
      }
    });
  } catch (error) {
    elements.hostFatalError.textContent = formatFirebaseError(error);
    showView("error");
  }
}

function bindEvents() {
  elements.claimHostBtn.addEventListener("click", claimHost);
  elements.presetSelect.addEventListener("change", () => {
    const id = Number(elements.presetSelect.value);
    selectedPreset = presets.find((preset) => preset.id === id) || presets[0];
    renderPresetPreview();
  });
  elements.spyCount.addEventListener("input", updateCountPreview);
  elements.thirdCount.addEventListener("input", updateCountPreview);
  elements.useCustomBtn.addEventListener("click", useCustomPreset);
  elements.startGameBtn.addEventListener("click", startGame);
  elements.newRoundBtn.addEventListener("click", prepareNewRound);
  elements.copyLinkBtn.addEventListener("click", copyJoinLink);
  elements.clearPlayersBtn.addEventListener("click", clearPlayers);
  elements.releaseHostBtn.addEventListener("click", releaseHost);
}

function attachDashboardListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  rootRef.child("public").on("value", (snapshot) => {
    publicState = snapshot.val() || {};
    renderDashboard();
  });

  rootRef.child("players").on("value", async (snapshot) => {
    players = snapshot.val() || {};
    renderDashboard();
    await syncPublicPlayerCount();
  });

  rootRef.child("assignments").on("value", (snapshot) => {
    assignments = snapshot.val() || {};
    renderPlayerTable();
  });
}

async function claimHost() {
  elements.claimHostBtn.disabled = true;
  setMessage(elements.claimMessage, "Đang nhận quyền…", "info");
  try {
    const result = await rootRef.child("ownerUid").transaction((current) => current || user.uid);
    if (result.snapshot.val() !== user.uid) {
      setMessage(elements.claimMessage, "Một thiết bị khác vừa nhận quyền quản trò.", "error");
    } else {
      await rootRef.child("public").update({
        status: publicState.status || "waiting",
        roundNumber: Number(publicState.roundNumber || 0),
        playerCount: Object.keys(players).length,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
      setMessage(elements.claimMessage, "", "info");
    }
  } catch (error) {
    setMessage(elements.claimMessage, formatFirebaseError(error), "error");
  } finally {
    elements.claimHostBtn.disabled = false;
  }
}

function renderPresetOptions() {
  elements.presetSelect.innerHTML = presets
    .map((preset) => `<option value="${preset.id}">Ván ${preset.id}: ${escapeHtml(preset.theme)}</option>`)
    .join("");
  elements.presetSelect.value = String(selectedPreset.id);
  renderPresetPreview();
}

function renderPresetPreview() {
  elements.presetPreview.innerHTML = `
    <p><strong>${escapeHtml(selectedPreset.theme)}</strong></p>
    <div class="word-chip-list">
      <span class="word-chip role-civilian">Người: ${escapeHtml(selectedPreset.civilian)}</span>
      <span class="word-chip role-spy">Gián điệp: ${escapeHtml(selectedPreset.spy)}</span>
      <span class="word-chip role-third">Phe ba: ${escapeHtml(selectedPreset.third)}</span>
    </div>
  `;
}

function useCustomPreset() {
  const theme = elements.customTheme.value.trim() || "Tự chọn";
  const civilian = elements.customCivilian.value.trim();
  const spy = elements.customSpy.value.trim();
  const third = elements.customThird.value.trim();

  if (!civilian || !spy || !third) {
    setMessage(elements.gameMessage, "Vui lòng nhập đủ ba từ.", "error");
    return;
  }

  selectedPreset = { id: "custom", theme, civilian, spy, third };
  renderPresetPreview();
  setMessage(elements.gameMessage, "Đã dùng bộ từ tự nhập.", "success");
}

function getCounts() {
  const total = Object.keys(players).length;
  const spy = Math.max(0, Number.parseInt(elements.spyCount.value, 10) || 0);
  const third = Math.max(0, Number.parseInt(elements.thirdCount.value, 10) || 0);
  return { total, spy, third, civilian: total - spy - third };
}

function updateCountPreview() {
  const counts = getCounts();
  elements.civilianCountPreview.textContent = Math.max(0, counts.civilian);
}

async function startGame() {
  const counts = getCounts();
  if (counts.total < 3) {
    setMessage(elements.gameMessage, "Cần ít nhất 3 người chơi.", "error");
    return;
  }
  if (counts.spy < 1 || counts.third < 1 || counts.civilian < 1) {
    setMessage(elements.gameMessage, "Mỗi phe phải có ít nhất 1 người.", "error");
    return;
  }

  const playerIds = Object.keys(players);
  const roles = shuffle([
    ...Array(counts.civilian).fill("civilian"),
    ...Array(counts.spy).fill("spy"),
    ...Array(counts.third).fill("third")
  ]);
  const nextRound = Number(publicState.roundNumber || 0) + 1;
  const assignmentUpdates = {};

  Object.keys(assignments).forEach((uid) => {
    assignmentUpdates[uid] = null;
  });

  playerIds.forEach((uid, index) => {
    const role = roles[index];
    assignmentUpdates[uid] = {
      role,
      word: selectedPreset[role],
      roundNumber: nextRound,
      assignedAt: firebase.database.ServerValue.TIMESTAMP
    };
  });

  elements.startGameBtn.disabled = true;
  setMessage(elements.gameMessage, "Đang chia vai…", "info");

  try {
    await rootRef.child("assignments").update(assignmentUpdates);
    await rootRef.child("public").set({
      status: "started",
      roundNumber: nextRound,
      playerCount: counts.total,
      theme: selectedPreset.theme,
      spyCount: counts.spy,
      thirdCount: counts.third,
      startedAt: firebase.database.ServerValue.TIMESTAMP,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
    setMessage(elements.gameMessage, `Đã bắt đầu ván ${nextRound} và chia từ cho ${counts.total} người.`, "success");
  } catch (error) {
    setMessage(elements.gameMessage, formatFirebaseError(error), "error");
  } finally {
    elements.startGameBtn.disabled = false;
  }
}

async function prepareNewRound() {
  elements.newRoundBtn.disabled = true;
  setMessage(elements.gameMessage, "Đang kết thúc ván và mở lại phòng…", "info");

  try {
    // Do not call assignments.remove() at the parent path. Older Firebase rules
    // only grant write access at assignments/$uid, so deleting the parent is denied.
    // A single multi-location update is atomic and works with both old and new rules.
    const updates = {
      "public/status": "waiting",
      "public/playerCount": Object.keys(players).length,
      "public/theme": null,
      "public/spyCount": null,
      "public/thirdCount": null,
      "public/startedAt": null,
      "public/updatedAt": firebase.database.ServerValue.TIMESTAMP
    };

    Object.keys(assignments).forEach((uid) => {
      updates[`assignments/${uid}`] = null;
    });

    await rootRef.update(updates);
    assignments = {};
    setMessage(
      elements.gameMessage,
      "Đã kết thúc ván. Phòng đã mở lại và giữ nguyên danh sách người chơi.",
      "success"
    );
  } catch (error) {
    setMessage(elements.gameMessage, formatFirebaseError(error), "error");
  } finally {
    elements.newRoundBtn.disabled = false;
  }
}

async function syncPublicPlayerCount() {
  if (updatingCount || ownerUid !== user.uid) return;
  updatingCount = true;
  try {
    await rootRef.child("public/playerCount").set(Object.keys(players).length);
  } catch (error) {
    console.warn("Không thể đồng bộ số người:", error);
  } finally {
    updatingCount = false;
  }
}

function renderDashboard() {
  const count = Object.keys(players).length;
  const started = publicState.status === "started";
  elements.playerCountMetric.textContent = count;
  elements.statusMetric.textContent = started ? "Đang chơi" : "Đang chờ";
  elements.roundMetric.textContent = publicState.roundNumber || 0;
  elements.roomStatusBadge.textContent = started ? "Đang chơi" : "Đang chờ";
  elements.roomStatusBadge.className = `status-badge ${started ? "live" : "waiting"}`;
  elements.startGameBtn.textContent = started ? "Chia lại và bắt đầu ván mới" : "Bắt đầu và chia từ";
  updateCountPreview();
  renderPlayerTable();
}

function renderPlayerTable() {
  const entries = Object.entries(players).sort(([, a], [, b]) => {
    return Number(a.joinedAt || 0) - Number(b.joinedAt || 0);
  });

  elements.emptyPlayers.classList.toggle("is-hidden", entries.length > 0);
  elements.playerTableWrap.classList.toggle("is-hidden", entries.length === 0);

  elements.playerTable.innerHTML = entries.map(([uid, player], index) => {
    const assignment = assignments[uid];
    const info = assignment ? roleInfo[assignment.role] : null;
    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(player.name)}</strong></td>
        <td><span class="online-dot ${player.online ? "online" : "offline"}"></span>${player.online ? "Đang mở" : "Mất kết nối"}</td>
        <td>${info ? `<span class="table-role ${info.className}">${escapeHtml(info.shortLabel)}</span>` : "—"}</td>
        <td>${assignment ? `<strong>${escapeHtml(assignment.word)}</strong>` : "—"}</td>
        <td><button class="icon-btn remove-player" type="button" data-uid="${escapeHtml(uid)}" aria-label="Xóa ${escapeHtml(player.name)}">×</button></td>
      </tr>
    `;
  }).join("");

  elements.playerTable.querySelectorAll(".remove-player").forEach((button) => {
    button.addEventListener("click", () => removePlayer(button.dataset.uid));
  });
}

async function removePlayer(uid) {
  const player = players[uid];
  if (!player) return;
  if (!window.confirm(`Xóa ${player.name} khỏi phòng?`)) return;
  try {
    await rootRef.child(`players/${uid}`).remove();
    await rootRef.child(`assignments/${uid}`).remove();
  } catch (error) {
    setMessage(elements.gameMessage, formatFirebaseError(error), "error");
  }
}

async function copyJoinLink() {
  const url = new URL("index.html", window.location.href).href;
  try {
    await navigator.clipboard.writeText(url);
    setMessage(elements.gameMessage, "Đã sao chép link tham gia.", "success");
  } catch (_error) {
    window.prompt("Sao chép đường dẫn này:", url);
  }
}

async function clearPlayers() {
  if (!window.confirm("Xóa toàn bộ người chơi và kết quả hiện tại?")) return;

  elements.clearPlayersBtn.disabled = true;
  setMessage(elements.gameMessage, "Đang đặt lại phòng…", "info");

  try {
    const updates = {
      "public/status": "waiting",
      "public/roundNumber": 0,
      "public/playerCount": 0,
      "public/theme": null,
      "public/spyCount": null,
      "public/thirdCount": null,
      "public/startedAt": null,
      "public/updatedAt": firebase.database.ServerValue.TIMESTAMP
    };

    Object.keys(players).forEach((uid) => {
      updates[`players/${uid}`] = null;
    });
    Object.keys(assignments).forEach((uid) => {
      updates[`assignments/${uid}`] = null;
    });

    await rootRef.update(updates);
    players = {};
    assignments = {};
    setMessage(elements.gameMessage, "Đã xóa toàn bộ người chơi và đưa phòng về trạng thái chờ.", "success");
  } catch (error) {
    setMessage(elements.gameMessage, formatFirebaseError(error), "error");
  } finally {
    elements.clearPlayersBtn.disabled = false;
  }
}

async function releaseHost() {
  if (!window.confirm("Nhường quyền quản trò? Thiết bị khác sẽ có thể nhận quyền.")) return;
  try {
    await rootRef.child("ownerUid").remove();
  } catch (error) {
    setMessage(elements.gameMessage, formatFirebaseError(error), "error");
  }
}

init();
})();
