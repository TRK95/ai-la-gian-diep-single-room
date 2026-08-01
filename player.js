(() => {
"use strict";

const { connectGame, setMessage, formatFirebaseError } = window.GameShared;
const roleInfo = window.ROLE_INFO;

const views = {
  loading: document.getElementById("loadingView"),
  join: document.getElementById("joinView"),
  lobby: document.getElementById("lobbyView"),
  secret: document.getElementById("secretView"),
  error: document.getElementById("errorView")
};

const elements = {
  playerName: document.getElementById("playerName"),
  joinBtn: document.getElementById("joinBtn"),
  leaveBtn: document.getElementById("leaveBtn"),
  joinMessage: document.getElementById("joinMessage"),
  lobbyMessage: document.getElementById("lobbyMessage"),
  welcomeName: document.getElementById("welcomeName"),
  lobbyText: document.getElementById("lobbyText"),
  publicPlayerCount: document.getElementById("publicPlayerCount"),
  roundNumber: document.getElementById("roundNumber"),
  secretGreeting: document.getElementById("secretGreeting"),
  secretCover: document.getElementById("secretCover"),
  secretContent: document.getElementById("secretContent"),
  revealSecretBtn: document.getElementById("revealSecretBtn"),
  hideSecretBtn: document.getElementById("hideSecretBtn"),
  roleBadge: document.getElementById("roleBadge"),
  secretWord: document.getElementById("secretWord"),
  roleInstruction: document.getElementById("roleInstruction"),
  fatalError: document.getElementById("fatalError")
};

let db;
let user;
let rootRef;
let playerRef;
let assignmentRef;
let publicState = {};
let playerData = null;
let assignmentData = null;
let disconnectHandler = null;

function showView(name) {
  Object.entries(views).forEach(([key, view]) => {
    view.classList.toggle("is-hidden", key !== name);
  });
}

async function init() {
  try {
    const connection = await connectGame();
    ({ db, user, rootRef } = connection);
    playerRef = rootRef.child(`players/${user.uid}`);
    assignmentRef = rootRef.child(`assignments/${user.uid}`);

    const savedName = localStorage.getItem("spy-game-player-name") || "";
    elements.playerName.value = savedName;

    rootRef.child("public").on("value", (snapshot) => {
      publicState = snapshot.val() || {};
      render();
    });

    playerRef.on("value", async (snapshot) => {
      playerData = snapshot.val();
      if (playerData) {
        try {
          disconnectHandler = playerRef.child("online").onDisconnect();
          await disconnectHandler.set(false);
          await playerRef.child("online").set(true);
        } catch (error) {
          console.warn("Không thể cập nhật trạng thái online:", error);
        }
      }
      render();
    });

    assignmentRef.on("value", (snapshot) => {
      assignmentData = snapshot.val();
      render();
    });

    elements.joinBtn.addEventListener("click", joinRoom);
    elements.playerName.addEventListener("keydown", (event) => {
      if (event.key === "Enter") joinRoom();
    });
    elements.leaveBtn.addEventListener("click", leaveRoom);
    elements.revealSecretBtn.addEventListener("click", () => toggleSecret(true));
    elements.hideSecretBtn.addEventListener("click", () => toggleSecret(false));
  } catch (error) {
    elements.fatalError.textContent = formatFirebaseError(error);
    showView("error");
  }
}

async function joinRoom() {
  const name = elements.playerName.value.trim().replace(/\s+/g, " ");
  if (!name) {
    setMessage(elements.joinMessage, "Vui lòng nhập tên của bạn.", "error");
    return;
  }
  if (name.length > 40) {
    setMessage(elements.joinMessage, "Tên tối đa 40 ký tự.", "error");
    return;
  }
  if (publicState.status === "started") {
    setMessage(elements.joinMessage, "Ván đã bắt đầu. Hãy nhờ quản trò chuyển về trạng thái chờ.", "error");
    return;
  }

  elements.joinBtn.disabled = true;
  setMessage(elements.joinMessage, "Đang tham gia…", "info");

  try {
    await playerRef.set({
      name,
      joinedAt: firebase.database.ServerValue.TIMESTAMP,
      online: true
    });
    localStorage.setItem("spy-game-player-name", name);
    setMessage(elements.joinMessage, "", "info");
  } catch (error) {
    setMessage(elements.joinMessage, formatFirebaseError(error), "error");
  } finally {
    elements.joinBtn.disabled = false;
  }
}

async function leaveRoom() {
  if (publicState.status === "started") {
    setMessage(elements.lobbyMessage, "Không thể rời phòng khi ván đang diễn ra. Hãy báo quản trò.", "error");
    return;
  }

  try {
    if (disconnectHandler) await disconnectHandler.cancel();
    await playerRef.remove();
    localStorage.removeItem("spy-game-player-name");
    playerData = null;
    assignmentData = null;
    toggleSecret(false);
    render();
  } catch (error) {
    setMessage(elements.lobbyMessage, formatFirebaseError(error), "error");
  }
}

function toggleSecret(show) {
  elements.secretCover.classList.toggle("is-hidden", show);
  elements.secretContent.classList.toggle("is-hidden", !show);
}

function render() {
  if (!user) {
    showView("loading");
    return;
  }

  if (!playerData) {
    showView("join");
    const started = publicState.status === "started";
    elements.joinBtn.disabled = started;
    setMessage(
      elements.joinMessage,
      started ? "Ván đang diễn ra; hiện chưa thể tham gia." : "",
      started ? "error" : "info"
    );
    return;
  }

  const name = playerData.name || "Người chơi";
  const currentRound = Number(publicState.roundNumber || 0);
  const hasCurrentAssignment = Boolean(
    assignmentData &&
    Number(assignmentData.roundNumber) === currentRound &&
    publicState.status === "started"
  );

  if (hasCurrentAssignment) {
    showView("secret");
    const info = roleInfo[assignmentData.role] || roleInfo.civilian;
    elements.roundNumber.textContent = currentRound;
    elements.secretGreeting.textContent = `${name}, đây là vai trò của bạn`;
    elements.roleBadge.textContent = info.label;
    elements.roleBadge.className = `big-role-badge ${info.className}`;
    elements.secretWord.textContent = assignmentData.word || "—";
    elements.roleInstruction.textContent = info.instruction;
    return;
  }

  showView("lobby");
  toggleSecret(false);
  elements.welcomeName.textContent = `Xin chào, ${name}!`;
  elements.publicPlayerCount.textContent = publicState.playerCount ?? "—";
  elements.lobbyText.textContent = currentRound > 0
    ? "Ván trước đã kết thúc hoặc quản trò đang chuẩn bị ván mới."
    : "Bạn đã vào phòng. Không cần tải lại trang.";
}

init();
})();
