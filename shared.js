(() => {
"use strict";

window.GAME_PRESETS = [
  { id: 1, theme: "Đồ uống", civilian: "Cà phê", third: "Trà sữa", spy: "Nước cam" },
  { id: 2, theme: "Phương tiện", civilian: "Xe buýt", third: "Tàu điện", spy: "Máy bay" },
  { id: 3, theme: "Đồ ăn nhanh", civilian: "Bánh mì", third: "Hamburger", spy: "Pizza" },
  { id: 4, theme: "Địa điểm", civilian: "Thư viện", third: "Nhà sách", spy: "Bảo tàng" },
  { id: 5, theme: "Thiết bị", civilian: "Điện thoại", third: "Máy tính bảng", spy: "Laptop" },
  { id: 6, theme: "Thiên nhiên", civilian: "Biển", third: "Hồ", spy: "Sông" },
  { id: 7, theme: "Nghề nghiệp", civilian: "Bác sĩ", third: "Y tá", spy: "Dược sĩ" },
  { id: 8, theme: "Thể thao", civilian: "Bóng đá", third: "Bóng rổ", spy: "Bóng chuyền" },
  { id: 9, theme: "Thời tiết", civilian: "Mưa", third: "Tuyết", spy: "Sương mù" },
  { id: 10, theme: "Giải trí", civilian: "Rạp phim", third: "Nhà hát", spy: "Sân khấu ca nhạc" },
  { id: 11, theme: "Du lịch", civilian: "Khách sạn", third: "Nhà nghỉ", spy: "Khu cắm trại" },
  { id: 12, theme: "Động vật", civilian: "Chó", third: "Sói", spy: "Cáo" },
  { id: 13, theme: "Trường học", civilian: "Giảng đường", third: "Phòng họp", spy: "Phòng thí nghiệm" },
  { id: 14, theme: "Không gian", civilian: "Mặt Trời", third: "Mặt Trăng", spy: "Ngôi sao" },
  { id: 15, theme: "Đồ dùng ngày mưa", civilian: "Ô", third: "Áo mưa", spy: "Ủng" }
];

window.ROLE_INFO = {
  civilian: {
    label: "PHE NGƯỜI",
    shortLabel: "Người",
    className: "role-civilian",
    instruction: "Mô tả từ đủ rõ để đồng đội hiểu, nhưng đừng để gián điệp đoán ra từ của số đông."
  },
  spy: {
    label: "PHE GIÁN ĐIỆP",
    shortLabel: "Gián điệp",
    className: "role-spy",
    instruction: "Từ của bạn gần giống phe người. Hãy hòa nhập, suy luận và tránh bị phát hiện."
  },
  third: {
    label: "PHE THỨ BA",
    shortLabel: "Phe thứ ba",
    className: "role-third",
    instruction: "Bạn nhận một từ riêng. Hãy chơi theo điều kiện thắng mà quản trò đã công bố."
  }
};

function isFirebaseConfigured() {
  const config = window.FIREBASE_CONFIG || {};
  return Boolean(
    config.apiKey &&
    config.databaseURL &&
    !String(config.apiKey).includes("PASTE_") &&
    !String(config.databaseURL).includes("PASTE_")
  );
}

async function connectGame() {
  if (!isFirebaseConfigured()) {
    throw new Error("Chưa cấu hình Firebase. Hãy mở firebase-config.js và dán cấu hình dự án của bạn.");
  }

  if (!window.firebase) {
    throw new Error("Không tải được Firebase SDK. Hãy kiểm tra kết nối Internet.");
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(window.FIREBASE_CONFIG);
  }

  const auth = firebase.auth();
  const db = firebase.database();
  await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  if (!auth.currentUser) {
    await auth.signInAnonymously();
  }

  return {
    auth,
    db,
    user: auth.currentUser,
    rootRef: db.ref(window.GAME_ROOT || "single-room")
  };
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(element, text, type = "info") {
  if (!element) return;
  element.textContent = text || "";
  element.className = `message ${text ? `show ${type}` : ""}`.trim();
}

function formatFirebaseError(error) {
  const code = error && error.code ? String(error.code) : "";
  if (code.includes("auth/operation-not-allowed")) {
    return "Firebase Anonymous Authentication chưa được bật.";
  }
  if (code.includes("permission-denied")) {
    return "Firebase từ chối quyền truy cập. Hãy kiểm tra database.rules.json đã được Publish chưa.";
  }
  if (code.includes("network-request-failed")) {
    return "Không kết nối được Firebase. Hãy kiểm tra Internet.";
  }
  return error && error.message ? error.message : "Đã xảy ra lỗi không xác định.";
}

window.GameShared = {
  connectGame,
  shuffle,
  escapeHtml,
  setMessage,
  formatFirebaseError,
  isFirebaseConfigured
};
})();
