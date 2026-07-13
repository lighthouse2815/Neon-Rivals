# Neon Rivals / Neon Duel

`Neon Rivals` là repo đồ án cho game trình duyệt `Neon Duel`: một game bắn súng đấu trường 1v1 thời gian thực, góc nhìn từ trên xuống, chạy theo mô hình server-authoritative. Hai người chơi có thể tạo phòng riêng, tham gia bằng mã phòng 6 ký tự hoặc link mời, sẵn sàng, thi đấu tối đa 5 hiệp và hệ thống tự động đồng bộ trạng thái trận giữa hai máy khách.

Repo được tổ chức theo dạng `pnpm` + `Turborepo`, tách rõ client, server và shared contracts để dễ phát triển tiếp hoặc mở rộng về sau.

## 1. Tính năng chính

- Chơi offline local practice không cần kết nối server.
- Chơi online 1v1 với phòng riêng tối đa đúng 2 người.
- Server giữ quyền quyết định vị trí, đạn, máu, điểm số và người thắng.
- Có nội suy snapshot, prediction, reconciliation, ping indicator.
- Có reconnect token và thời gian grace 15 giây khi mất kết nối.
- Có test unit, integration và Playwright E2E cho luồng multiplayer.

## 2. Cấu trúc thư mục

- `apps/client`: client Phaser 3, giao diện menu/lobby/arena/result, local practice, Playwright E2E.
- `apps/server`: server Fastify + Socket.IO, quản lý phòng và mô phỏng trận đấu trong bộ nhớ.
- `packages/shared`: constants, schema Zod, event contracts, types và logic mô phỏng dùng chung.
- `docs`: tài liệu thiết kế, kiến trúc, giao thức mạng, kế hoạch test, tiến độ và bằng chứng chạy thực tế.
- `scripts`: script hỗ trợ chạy kiểm thử hoặc preview.

## 3. Yêu cầu môi trường

- Node.js `24+`
- `pnpm` `11+`

Kiểm tra nhanh:

```bash
node -v
pnpm -v
```

Nếu máy chưa có `pnpm`:

```bash
npm install -g pnpm
```

## 4. Cách chạy dự án từ đầu

### Bước 1: cài dependency

```bash
pnpm install
```

Nếu trên Windows gặp lỗi liên quan build script policy của `pnpm`, chạy thêm:

```bash
pnpm approve-builds --all
pnpm install
```

### Bước 2: chạy client và server ở chế độ development

```bash
pnpm dev
```

Lệnh này dùng Turbo để chạy song song:

- client Vite tại `http://127.0.0.1:4173`
- server Fastify + Socket.IO tại `http://127.0.0.1:3001`

Kiểm tra server đã lên:

```text
http://127.0.0.1:3001/health
```

### Bước 3: mở game

Mở trình duyệt tại:

```text
http://127.0.0.1:4173
```

Bạn có thể:

- chọn `Practice Offline` để chơi local practice
- tạo phòng và copy mã phòng / link mời
- mở thêm một trình duyệt hoặc browser context khác để người chơi thứ hai tham gia

## 5. Chạy từng phần riêng lẻ

Khi cần debug tách biệt:

### Chỉ chạy server

```bash
pnpm --filter @neon-duel/server dev
```

### Chỉ chạy client

```bash
pnpm --filter @neon-duel/client dev
```

## 6. Các lệnh kiểm tra chất lượng

### Lint

```bash
pnpm lint
```

### Type check

```bash
pnpm typecheck
```

### Test unit + integration

```bash
pnpm test
```

### Build toàn bộ monorepo

```bash
pnpm build
```

### Chạy E2E multiplayer bằng Playwright

```bash
pnpm test:e2e
```

## 7. Chạy preview production để test gần giống deploy

```bash
pnpm preview:e2e
```

Lệnh này sẽ:

- build project
- chạy server từ bản build production
- chạy client bằng Vite preview

Phù hợp để test lại flow multiplayer trước khi bàn giao hoặc deploy.

## 8. Biến môi trường server

Server hiện dùng các biến sau, nếu không khai báo sẽ lấy giá trị mặc định:

- `HOST`: mặc định `127.0.0.1`
- `PORT`: mặc định `3001`
- `CLIENT_ORIGIN`: mặc định `http://127.0.0.1:4173`
- `INVITATION_BASE_URL`: mặc định `http://127.0.0.1:4173`

Ví dụ chạy server với cấu hình khác:

```powershell
$env:PORT='4001'
$env:CLIENT_ORIGIN='http://127.0.0.1:5173'
pnpm --filter @neon-duel/server dev
```

## 9. Hướng dẫn test nhanh luồng multiplayer

1. Chạy `pnpm dev`.
2. Mở trình duyệt A tại `http://127.0.0.1:4173`.
3. Chọn tạo phòng.
4. Mở trình duyệt B hoặc browser context khác.
5. Nhập mã phòng hoặc mở link mời.
6. Cả hai người chơi bấm sẵn sàng.
7. Kiểm tra countdown, di chuyển, bắn, trừ máu, hết hiệp, cập nhật điểm.
8. Thử reload một tab để kiểm tra reconnect.
9. Sau khi kết thúc trận, thử rematch.

## 10. Tài liệu quan trọng

- `docs/00_GAME_DESIGN.md`: mô tả gameplay và luật chơi
- `docs/01_ARCHITECTURE.md`: kiến trúc tổng thể
- `docs/02_MULTIPLAYER_PROTOCOL.md`: event và schema mạng
- `docs/03_ASSET_GUIDE.md`: hướng dẫn asset
- `docs/04_TEST_PLAN.md`: kế hoạch test
- `docs/05_PROGRESS.md`: nhật ký tiến độ và kết quả kiểm chứng
- `docs/evidence/`: ảnh chụp và artifact test

## 11. Triển khai

### Client

- build ra thư mục `apps/client/dist`
- có thể deploy lên static host bất kỳ

Nếu server không nằm ở `http://127.0.0.1:3001`, cần cấu hình lại URL server tương ứng ở phía client trước khi deploy.

### Server

- entry production là `apps/server/dist/index.js`
- cần Node.js `24+`
- cấu hình `PORT`, `HOST`, `CLIENT_ORIGIN`, `INVITATION_BASE_URL` theo môi trường thực tế

## 12. Lưu ý hiện tại

- Trạng thái phòng và trận đấu chỉ nằm trong memory; restart server sẽ mất phòng đang hoạt động.
- Repo có sẵn ảnh bằng chứng test trong `docs/evidence/`.
- Đây là repo monorepo, nên mọi lệnh ở trên cần chạy tại thư mục gốc của dự án.
