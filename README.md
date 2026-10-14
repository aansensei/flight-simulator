# AERONAUT: Wilderness Flight

Game bay Cessna 172 trên trình duyệt PC. Bản đồ Alps giả lập rộng 60 × 60 km, đường băng 1.120 m, hồ, rừng thông và nhiều lựa chọn ánh sáng, thời tiết. Đây là mô phỏng giải trí có mô hình vật lý gần đúng, chưa phải phần mềm huấn luyện bay được kiểm định.

## Chơi trên localhost

Cần Node.js 24 LTS và trình duyệt Chrome hoặc Edge có tăng tốc phần cứng, hỗ trợ WebGL 2.

Trên Windows, mở `CHOI-GAME.cmd`. File sẽ cài dependencies nếu cần, mở trình duyệt và chạy server. Giữ cửa sổ đó mở khi chơi. Nhấn Ctrl+C để dừng server.

Hoặc mở terminal trong thư mục dự án:

```powershell
npm ci
npm run dev
```

Mở http://localhost:5173/flight-simulator/ hoặc http://127.0.0.1:5173/flight-simulator/. Nếu server báo cổng đang dùng, bản game có thể đã chạy. Đừng mở trực tiếp `index.html` vì trình duyệt cần server để tải TypeScript.

## Ngắm cảnh

Chọn **Ngắm cảnh (tự bay, góc nhìn sạch)**. Máy bay tự bay vòng qua hồ bằng bề mặt điều khiển, góc nhìn ẩn máy bay và HUD. Giữ chuột phải để nhìn quanh, cuộn chuột để điều chỉnh khoảng cách nhìn, P tạm dừng để chọn khung ảnh.

Nút **Đổi ánh sáng / thời tiết** mở menu. Chọn **Bình minh**, **Buổi sáng**, **Giữa trưa**, **Hoàng hôn** hoặc **Chạng vạng**, kết hợp **Nắng**, **Sương mỏng**, **Nhiều mây** hoặc **Mưa**. Chọn **Tiếp tục chuyến bay** để giữ vị trí hoặc **Ngắm cảnh** để khởi hành lại. **Chụp ảnh PNG** tải ảnh cảnh quan theo đúng độ phân giải render, không kèm giao diện.

Hồ dùng planar reflection: render thêm góc nhìn phản chiếu của núi, rừng và bầu trời vào texture, kết hợp Fresnel và sóng nhiều hướng có lọc theo khoảng cách để giảm vân lặp. Mây dùng trường noise nhiều lớp, có vùng sáng và tối theo hướng mặt trời. Mưa có màn vệt mưa, sương ẩm, mây xám, thay đổi gợn nước và lớp âm thanh gió mưa. Đây là hiệu ứng thời tiết trực quan, chưa phải mô phỏng vi vật lý mây và giọt mưa.

## FPS và độ chi tiết

Trong menu, **Ưu tiên đồ họa → Mượt, tự điều chỉnh tới 60 FPS** đo tải thực tế và thay đổi độ phân giải nội bộ từ 55% đến 100% theo mỗi chiều. Mức 60 FPS là mục tiêu, không phải bảo đảm. Khi GPU hoặc trình duyệt không đủ nhanh, FPS có thể thấp hơn. **Nét tối đa, giữ độ phân giải** tắt điều chỉnh này.

Cây trong khoảng 1,2 km dùng tán nhiều chi tiết; cây xa dùng tán ít tam giác hơn nhưng cùng chiều cao. Cây quá 6 km không được render. Bộ dữ liệu cây gốc được giữ riêng để việc đổi LOD không xóa rừng. Chế độ Mượt giảm kích thước phản chiếu hồ, cập nhật HUD 10 lần/giây và không khử răng cưa hai lần. Vật lý vẫn chạy 120 Hz.

Bảng FPS có thời gian CPU và GPU cùng số cây gần/xa. GPU timing dùng truy vấn bất đồng bộ, có thể hiện n/a nếu trình duyệt không hỗ trợ extension. Ảnh PNG vẫn được render một lần ở độ phân giải tối đa đã chọn, sau đó game trở lại độ phân giải thích ứng.

Trong một lần kiểm tra trên máy hiện tại, chế độ Mượt ghi nhận 63 FPS ở render nội bộ 2112 × 1188, GPU khoảng 7,3 ms. Đây là số đo quan sát, không phải benchmark bảo đảm cho mọi cảnh hoặc máy. Render 4K cố định có FPS thấp hơn.

Cơ sở tối ưu: [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices), [Khronos GPU timer extension](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/). Sương khí quyển tích phân mật độ theo độ cao trên đường nhìn để cảnh xa và thung lũng hòa màu tự nhiên hơn.

## GPU, 4K và DLSS

Nút **Chất lượng tối đa (4K + Ultra)** bật độ phân giải cao, chi tiết địa hình, bóng 4096 px và tăng nét có giới hạn. Renderer yêu cầu chế độ GPU hiệu năng cao của trình duyệt. Nó sử dụng GPU cho shader và instancing; mô phỏng bay chạy trên CPU. Không cố làm đầy CPU/RAM khi việc đó không cải thiện cảnh.

DLSS chính thức chưa có API WebGL cho dự án này. [NVIDIA DLSS Programming Guide](https://raw.githubusercontent.com/NVIDIA/DLSS/main/doc/DLSS_Programming_Guide_Release.pdf) yêu cầu engine DirectX 11, DirectX 12 hoặc Vulkan. Tùy chọn tăng nét trong bản web không phải DLSS, DLAA hoặc ray tracing. Tích hợp DLSS thật cần phiên bản native và pipeline render phù hợp.

## Bắt đầu dễ nhất

Chọn **Assisted**, **Trời lặng**, **High**, rồi **Bắt đầu bay (Trên hồ)**. Nhả phím A/D để trợ lái đưa cánh về ngang. Máy bay vẫn có thể stall nếu bay quá chậm. Trợ lái chỉ điều khiển elevator, aileron và rudder.

W hoặc mũi tên lên chúi mũi. S hoặc mũi tên xuống kéo mũi. A/D nghiêng cánh. Q/E đạp rudder hoặc lái bánh mũi. Shift hoặc dấu cộng tăng ga, Ctrl hoặc dấu trừ giảm ga. B giữ phanh. G chuyển flap qua 0°, 10°, 20°, 30°. T/Y chỉnh trim. C đổi góc nhìn, giữ chuột phải để nhìn quanh, cuộn chuột để zoom. P tạm dừng, R bắt đầu lại, Esc mở menu, F toàn màn hình, H xem hướng dẫn, M bật tắt âm thanh.

Có thể bật **Lái bằng chuột**: đưa chuột về tâm màn hình để trung tính, đưa sang trái/phải để nghiêng, kéo xuống để nâng mũi. Bàn phím vẫn ưu tiên khi giữ W/S/A/D. Giữ chuột phải để nhìn quanh.

## Cất cánh

1. Chọn **Xuất phát từ đường băng**. Gió mặc định là trời lặng để tập giữ trục.
2. Giữ Shift đến 100% ga. Q/E sửa hướng khi cần. Phanh B phải được nhả.
3. Khi đạt khoảng 55 kt, nhấn S nhẹ từng nhịp để nâng mũi. Tránh kéo mạnh đến stall.
4. Sau khi lên cao ổn định, dùng G chuyển flap về 0° và giảm ga để bay hành trình.

Gió ngang làm máy bay đổi hướng và trôi theo gió. Bật gió nhẹ khi đã quen, dùng rudder và góc nghiêng để bù. Trời lặng không có nhiễu động ngẫu nhiên.

## Hạ cánh

Chọn **Luyện hạ cánh (đã căn đường băng)** để bắt đầu cách ngưỡng đường băng 2,64 km, hướng 000°, flap 20°, ga 32%, tốc độ khoảng 64 kt IAS. Hai bên thung lũng có lối tiếp cận thông thoáng.

1. Theo bảng **Hướng dẫn hạ cánh** bên phải. Nó báo lệch trục và cao/thấp so với dốc 3°.
2. Giữ khoảng 62 đến 65 kt. Giảm ga từ từ bằng Ctrl để xuống, thêm ga bằng Shift nếu chìm quá nhanh. A/D sửa trục bằng những nhịp ngắn.
3. Khi sát đường băng, giảm ga về 0%, nhấn S rất nhẹ để nâng mũi và giảm tốc độ chìm. Đừng giữ S kéo mạnh liên tục.
4. Khi bánh đã chạm mặt đường, giữ B, dùng Q/E giữ trục cho đến khi dừng.
5. Nếu lệch nhiều hoặc có cảnh báo stall, tăng ga, hạ mũi để lấy tốc độ và bay vòng lại.

Trong bài luyện, cấu hình ban đầu đã gần dốc tiếp cận. Có thể giữ nguyên trong phần lớn chặng đầu, sau đó giảm ga và nâng mũi gần ngưỡng. Kiểm thử tự động đã thực hiện tiếp cận, nâng mũi và phanh dừng trên đường băng.

## Đồ họa và phong cách camera

**Độ phân giải render → 4K** render tối đa 3840 × 2160. Trên màn hình 16:9, bộ đệm là đúng 3840 × 2160. Màn hình tỷ lệ khác giữ nguyên tỷ lệ khung hình và nằm trong giới hạn đó. Bảng hiệu năng hiển thị độ phân giải render thực tế.

**Ultra** tăng chi tiết địa hình, tối đa 12.000 cây và shadow map 4096 px. Độ phân giải và mức chi tiết được chọn độc lập. Nếu FPS thấp, dùng High hoặc Medium, rồi chuyển độ phân giải về Theo màn hình.

Shader có PBR, ACES, sương khí quyển, Fresnel và sóng nước, bóng PCF, bề mặt địa hình có chi tiết, mây mềm nhiều lớp bằng shader và tán spruce nhiều tầng. Pass camera có MSAA, FXAA, quầng sáng nhẹ, màu highlight ấm và shadow trung tính, vignette và hạt phim nhỏ. Phong cách màu lấy cảm hứng từ video camera Sony, chưa mô phỏng một thân máy, cảm biến hoặc profile Sony cụ thể.

4K là độ phân giải, không đồng nghĩa với photorealism. Mô hình máy bay, cây và địa hình vẫn là tài nguyên sinh bằng mã. Để đạt mức như cảnh quay thật cần mesh và vật liệu PBR chất lượng cao, ảnh địa hình thực, hệ thống LOD và mây thể tích có ray marching. FPS phụ thuộc GPU, trình duyệt và độ phân giải.

## Vật lý và giới hạn

Vật lý chạy 120 Hz, xử lý tối đa 24 bước mỗi frame và nội suy quaternion. Có trọng lực, mật độ khí quyển theo độ cao, vận tốc tương đối gió, lift theo góc tấn và flap, drag ký sinh và cảm ứng, lift giảm liên tục sau stall, công suất động cơ và actuator disk propeller. Công suất hữu ích T × V không vượt công suất cung cấp. Mô men quay có thành phần gyroscopic của phương trình Euler.

Ba bánh xe có lò xo, giảm chấn, ma sát giới hạn theo phản lực và mô men r × F. Rudder quay bánh mũi để taxi. Không tự cộng vận tốc ở rìa bản đồ, không ép hướng quay khi bay, không sửa vị trí để giữ bánh trên đường băng. Bánh xe, camera và cây dùng nội suy đúng tam giác địa hình đang render.

Hệ máy bay không phải hệ kín: động cơ cấp năng lượng, drag, phanh và giảm chấn tiêu tán năng lượng, gió có thể trao đổi năng lượng. Vì vậy không giữ hằng tổng cơ năng của riêng máy bay. Tích phân thời gian hữu hạn có sai số số học. Hệ số khí động, quán tính và mô hình propeller là xấp xỉ, chưa đối chiếu đầy đủ dữ liệu thử bay. Va chạm hiện kiểm tra địa hình và nước bằng các điểm thân/cánh; chưa mô phỏng va chạm chi tiết với từng cây hoặc công trình. Sự kiện crash kết thúc lượt bay, chưa có mô hình biến dạng hoặc phân rã máy bay.

Thông số tham chiếu: [Textron Cessna Skyhawk](https://cessna.txtav.com/en/piston/cessna-skyhawk). Cơ sở actuator disk: [NASA Propeller Thrust](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/propeller-thrust/).

## Kiểm tra và build

```powershell
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

Preview bản build tại http://localhost:4173/flight-simulator/. CI trên GitHub chạy kiểm thử và build. Các kiểm thử kiểm tra ngân sách công suất, cân bằng mô men, stall, FPS, hướng xuất phát, phanh, cất cánh và hạ cánh.

## GitHub Pages

Repo chính: https://github.com/aansensei/flight-simulator

Địa chỉ chơi sau khi deploy thành công: https://aansensei.github.io/flight-simulator/

Vite dùng base `/flight-simulator/` để đường dẫn JavaScript hoạt động trên GitHub Pages. Workflow `.github/workflows/deploy.yml` chạy kiểm thử, build rồi deploy thư mục `dist` sau mỗi lần push lên `main`. GitHub Pages cần chọn Source là GitHub Actions trong Settings → Pages. Workflow không tạo commit sinh tự động.

Có âm thanh động cơ, cánh quạt, gió, lăn bánh, phanh, tiếp đất, cảnh báo stall và lớp âm thanh mưa. Trình duyệt chỉ cho phát âm thanh sau thao tác người dùng. Bấm bắt đầu hoặc tiếp tục chuyến bay, bật Âm thanh động cơ trong menu, dùng M để bật tắt. Âm thanh được tổng hợp bằng Web Audio API, chưa phải bản thu máy bay thật.

## Git và tác giả

Thư mục làm việc: `C:\Users\Thien An Nguyen\flight-simulator`.

Tác giả và committer: `An Nguyen <nguyencaothienan937@gmail.com>`. Commit chỉ có một tác giả, không thêm dòng Co-Authored-By. Theo AGENTS.md, cần AanSensei xác nhận trước khi commit.

Sau khi kiểm tra thay đổi và được AanSensei duyệt:

```powershell
git add .
git commit --author="An Nguyen <nguyencaothienan937@gmail.com>" -m "Complete flight simulator and configure GitHub Pages"
git push -u origin main
```

`.gitignore` loại `node_modules`, `dist`, `.env` và log khỏi repo. Mã nguồn, kiểm thử, cấu hình, launcher, README và lockfile đều được theo dõi. Chưa gán giấy phép phân phối cho tài nguyên gốc.
