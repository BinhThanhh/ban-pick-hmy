# HoYoverse Ban/Pick Arena (Genshin Impact — Cấm 5 Chọn 8)

Hệ thống Web Ban/Pick giải đấu các tựa game nhà HoYoverse (hiện tại hỗ trợ đầy đủ **Genshin Impact**, sẵn sàng khung mở rộng cho *Honkai: Star Rail* và *Zenless Zone Zero*).

---

## 1. Phân quyền chặt chẽ (Người chơi không được tự đổi Team)

- **Ban Tổ Chức / Khán giả (`?role=SPEC`):**
  - Toàn quyền điều khiển trận đấu: **Bắt đầu**, **Tạm dừng / Tiếp tục**, **Hoàn tác (Undo)**, **Reset trận đấu**.
  - **Đổi Đội A ↔ B (`⇄ Đổi Đội A ↔ B`):** Chỉ Ban Tổ Chức mới có quyền hoán đổi 2 đội (Đi trước ↔ Đi sau) hoặc gán phe.
  - **Chỉnh Cung mệnh (`C0`–`C6`) & Vũ khí (`R1`–`R5`):** Bấm vào bất kỳ nhân vật nào đã được Pick ở 2 bên để cập nhật.
- **Người chơi Phe A (`?role=PLAYER&team=A`) & Phe B (`?role=PLAYER&team=B`):**
  - Khi người chơi vào qua link của phe mình (hoặc sau khi được BTC gán phe), giao diện sẽ **KHÓA CỐ ĐỊNH ở phe đó** — người chơi **không thể tự đổi sang đội kia** và **không thể chuyển sang chế độ BTC**.
  - Chỉ có quyền **Ban / Pick** khi đến lượt của đội mình và **sắp xếp đội hình 8 nhân vật (4 Trên & 4 Dưới)** của đội mình.

---

## 2. Giải pháp Deploy Online Tối Ưu 100% Chi Phí ($0 Free Forever)

Dự án đã được thiết kế kiến trúc **Hybrid Serverless** ([draft-engine.js](public/js/draft-engine.js) + [api/index.js](api/index.js) + [firebase-config.js](public/js/firebase-config.js)) để chạy **miễn phí 100% (không tốn bất kỳ chi phí server nào, không cần thẻ tín dụng)**:

### Cách A: Deploy lên Vercel + Firebase Realtime Database (Khuyên dùng — 0đ, siêu mượt)
1. **Tạo Firebase Realtime Database miễn phí (2 phút):**
   - Truy cập [Firebase Console](https://console.firebase.google.com/) → Tạo Project mới (gói **Spark Plan — Free $0**, không cần thẻ VISA).
   - Vào **Build** → **Realtime Database** → **Create Database** → Chọn vùng Singapore (`asia-southeast1`) → Chọn **Start in test mode**.
   - Sao chép đường dẫn URL của Database (ví dụ: `https://ten-project-default-rtdb.asia-southeast1.firebasedatabase.app`).
   - Dán URL đó vào file [public/js/firebase-config.js](public/js/firebase-config.js) **HOẶC** dán trực tiếp vào ô **☁️ Firebase Realtime Database URL** trong nút **⚙️ Cài đặt & Link** trên web (link mời Đội A & Đội B sẽ tự động đính kèm URL Firebase này!).
2. **Đẩy web lên Vercel (Miễn phí 100%):**
   - Đẩy thư mục code này lên GitHub, vào [vercel.com](https://vercel.com) → **Add New Project** → Chọn repo của bạn → Bấm **Deploy** (file [vercel.json](vercel.json) và [api/index.js](api/index.js) đã được cấu hình sẵn).

### Cách B: Deploy cả Web & Database lên Firebase Hosting (Gói Spark Free 100%)
File [firebase.json](firebase.json) đã được cấu hình sẵn:
```bash
npx firebase-tools login
npx firebase-tools init hosting
npx firebase-tools deploy --only hosting
```

### Cách C: Chạy trực tiếp trên máy / mạng LAN
```bash
node server.js
```
Mở `http://localhost:3000` trên trình duyệt.
