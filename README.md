# Ai là gián điệp — một phòng online

Phiên bản này dành cho trường hợp chỉ có **một phòng duy nhất**:

- Quản trò mở `host.html`.
- Người chơi mở `index.html`, nhập tên và tham gia.
- Không có mã phòng, không có đăng ký tài khoản.
- Quản trò chọn một trong 15 bộ từ, cấu hình số gián điệp và phe thứ ba rồi bắt đầu.
- Mỗi người chỉ thấy vai trò và từ của chính mình trên thiết bị của họ.
- Có thể tạo nhiều ván liên tiếp mà vẫn giữ nguyên danh sách người chơi.

GitHub Pages chỉ chứa giao diện tĩnh. Firebase Realtime Database dùng để đồng bộ phòng giữa các thiết bị, còn Firebase Anonymous Authentication tạo định danh tạm cho từng trình duyệt.

## 1. Tạo Firebase project

1. Truy cập Firebase Console và tạo một project.
2. Vào **Project settings** → **Your apps** → chọn biểu tượng Web `</>`.
3. Đăng ký Web App. Không cần bật Firebase Hosting.
4. Sao chép object `firebaseConfig`.
5. Mở file `firebase-config.js` và thay các giá trị `PASTE_...` bằng cấu hình vừa sao chép.

Quan trọng: cấu hình phải có trường `databaseURL`.

## 2. Bật Anonymous Authentication

1. Firebase Console → **Authentication**.
2. Chọn **Get started**.
3. Tab **Sign-in method**.
4. Bật **Anonymous**.

Người chơi vẫn không phải nhập email hoặc mật khẩu.

## 3. Tạo Realtime Database

1. Firebase Console → **Realtime Database**.
2. Chọn **Create Database**.
3. Chọn vị trí gần người dùng.
4. Có thể khởi tạo ở Locked mode.
5. Mở tab **Rules**.
6. Sao chép toàn bộ nội dung file `database.rules.json` vào đó.
7. Nhấn **Publish**.

Các rules cho phép:

- Người chơi tự ghi thông tin của mình trước khi ván bắt đầu.
- Người chơi chỉ đọc được assignment của chính mình.
- Quản trò đọc danh sách và ghi toàn bộ assignment.

## 4. Deploy lên GitHub Pages

1. Tạo một repository GitHub mới.
2. Upload tất cả các file trong thư mục này vào nhánh `main`.
3. Vào **Settings** → **Pages**.
4. Ở **Build and deployment**, chọn **Deploy from a branch**.
5. Chọn branch `main`, folder `/ (root)` rồi Save.
6. Chờ GitHub cung cấp đường dẫn dạng:

```text
https://TEN_GITHUB.github.io/TEN_REPO/
```

Đường dẫn người chơi:

```text
https://TEN_GITHUB.github.io/TEN_REPO/
```

Đường dẫn quản trò:

```text
https://TEN_GITHUB.github.io/TEN_REPO/host.html
```

## 5. Cách vận hành

1. Quản trò mở `host.html` và nhấn **Nhận quyền quản trò**.
2. Gửi link trang chính cho người chơi.
3. Mỗi người nhập tên và nhấn **Tham gia phòng**.
4. Quản trò theo dõi danh sách, chọn bộ từ và số người mỗi phe.
5. Nhấn **Bắt đầu và chia từ**.
6. Mỗi người nhấn **Xem vai trò và từ** trên thiết bị của mình.
7. Khi xong ván, quản trò nhấn **Ván mới, giữ người chơi**.

## Lưu ý về quyền quản trò

Quyền quản trò gắn với trình duyệt đã nhấn **Nhận quyền quản trò**.

- Dùng nút **Nhường quyền quản trò** trước khi chuyển sang máy khác.
- Nếu trình duyệt quản trò bị mất hoàn toàn, vào Realtime Database và xóa trường:

```text
single-room/ownerUid
```

Sau đó thiết bị mới có thể nhận quyền.

## Các file

- `index.html`: trang người chơi.
- `host.html`: trang quản trò.
- `styles.css`: giao diện responsive.
- `firebase-config.js`: nơi dán cấu hình Firebase.
- `shared.js`: dữ liệu 15 bộ từ và hàm dùng chung.
- `player.js`: logic tham gia và xem từ.
- `host.js`: logic quản trò, chia phe và tạo ván mới.
- `database.rules.json`: Security Rules cho Realtime Database.
