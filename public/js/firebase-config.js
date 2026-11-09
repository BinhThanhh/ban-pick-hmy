/**
 * CẤU HÌNH FIREBASE REALTIME DATABASE (MIỄN PHÍ 100% - SPARK PLAN)
 * -----------------------------------------------------------------
 * Để chạy Online đa thiết bị miễn phí 100% trên Vercel / Firebase Hosting / GitHub Pages:
 * 1. Vào https://console.firebase.google.com/ -> Tạo Project miễn phí (Spark Plan - không cần thẻ VISA).
 * 2. Vào mục "Build" -> "Realtime Database" -> Bấm "Create Database" -> Chọn khu vực Singapore (asia-southeast1) -> Chọn "Start in test mode".
 * 3. Copy đường dẫn Database URL (có dạng: https://ten-project-default-rtdb.asia-southeast1.firebasedatabase.app)
 * 4. Dán vào biến FIREBASE_DATABASE_URL bên dưới (HOẶC dán trực tiếp ngay trong nút "⚙️ Cài đặt Phòng" trên giao diện Web, link mời Đội A & Đội B sẽ tự động kèm URL này!).
 */
window.HOYO_FIREBASE_CONFIG = {
  // Dán URL Firebase Realtime Database của bạn vào đây (nếu để trống, web sẽ dùng Server Node.js / Vercel API hoặc URL truyền qua ?fb=...)
  databaseURL: ''
};

