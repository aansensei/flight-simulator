# AERONAUT: Wilderness Flight

Game bay Cessna 172 trên trình duyệt PC. Bản đồ giả lập rộng 120 × 120 km, thung lũng Alps và hơn 60 đảo đá vôi, đường băng 2.200 × 48 m, hồ, rừng thông và nhiều lựa chọn ánh sáng, thời tiết. Đây là mô phỏng giải trí có mô hình vật lý gần đúng, chưa phải phần mềm huấn luyện bay được kiểm định.

## Chơi trên localhost

Cần Node.js 24 LTS và trình duyệt Chrome hoặc Edge có tăng tốc phần cứng, hỗ trợ WebGL 2.

Trên Windows, mở `CHOI-GAME.cmd`. File sẽ cài dependencies nếu cần, mở trình duyệt và chạy server. Giữ cửa sổ đó mở khi chơi. Nhấn Ctrl+C để dừng server.

Hoặc mở terminal trong thư mục dự án:

```powershell
npm ci
npm run dev
```

Mở http://localhost:5173/flight-simulator/ hoặc http://127.0.0.1:5173/flight-simulator/. Nếu server báo cổng đang dùng, bản game có thể đã chạy. Đừng mở trực tiếp `index.html` vì trình duyệt cần server để tải TypeScript.

## Máy bay và leo núi

Menu có Cessna 172 Skyhawk (180 HP), Ranger 260 STOL (260 HP) và Coastal Twin 620 (hai động cơ, tổng 620 HP). Ranger có cánh dài, hàng rào đầu cánh và bánh lớn. Coastal có hai cụm động cơ và cánh quạt trên cánh. Hai mẫu này là thiết kế giả lập, chia sẻ một phần hình học buồng lái và thân, không phải bản sao được kiểm định của máy bay thương mại. Khối lượng, diện tích cánh, quán tính và công suất khác nhau thực sự tác động đến mô phỏng. Công suất của Twin được chia cho hai cánh quạt trước khi tính lực đẩy.

Để leo cao: chọn Assisted, tăng ga bằng Shift đến 100%, thu flap về 0° bằng G rồi giữ S. Khi giữ S hết hành trình, trợ lái điều khiển elevator theo tốc độ leo mục tiêu của từng mẫu, giúp tránh kéo mũi lên rồi mất tốc độ. Simulation vẫn điều khiển trực tiếp. Không cộng lực nâng hay vận tốc miễn phí. Núi cao vẫn cần thời gian lấy độ cao và chọn đường vòng. Điểm bắt đầu trên hồ cao 460 m để có thêm khoảng trống quan sát.

Trong bài kiểm thử trời lặng, bắt đầu ở 650 m trên mặt nước và giữ S, ga tối đa trong 120 giây, ba mẫu đều lên cao thêm hơn 350 m, không stall, công suất hữu ích không vượt công suất cấp. Đây là kết quả của mô hình giải trí, không phải dữ liệu hiệu năng thử bay thật.

## Ngắm cảnh

Chọn **Ngắm cảnh (tự bay, góc nhìn sạch)** để xem thung lũng, hoặc **Ngắm vịnh (tự bay)** để xem quần đảo lấy cảm hứng từ cảnh quan đá vôi Hạ Long. Đây là cảnh quan thủ tục, không phải bản đồ địa lý Hạ Long. **Khám phá vịnh đảo đá vôi** cho phép tự lái ngay trên vịnh. M bật hoặc tắt radar trong cả hai chế độ. Radar hướng Bắc lên trên, biểu tượng máy bay xoay theo hướng bay, đường băng màu vàng, nút +/− chỉnh tầm xem. Máy bay tự bay vòng qua hồ bằng bề mặt điều khiển, góc nhìn ẩn máy bay và HUD. Giữ chuột phải để nhìn quanh, cuộn chuột để điều chỉnh khoảng cách nhìn, P tạm dừng để chọn khung ảnh.

Nút **Đổi ánh sáng / thời tiết** mở menu. Chọn **Bình minh**, **Buổi sáng**, **Giữa trưa**, **Hoàng hôn** hoặc **Chạng vạng**, kết hợp **Nắng**, **Sương mỏng**, **Nhiều mây** hoặc **Mưa**. Chọn **Tiếp tục chuyến bay** để giữ vị trí hoặc **Ngắm cảnh** để khởi hành lại. **Chụp ảnh PNG** tải ảnh cảnh quan theo đúng độ phân giải render, không kèm giao diện.

Nước có ba lớp sóng hình học ở vùng 8 × 8 km quanh máy bay và chín dải gợn nhỏ, lọc theo kích thước pixel để giảm nhấp nháy từ xa. Tốc độ truyền sóng dùng quan hệ phân tán sóng nước sâu, sóng ở vịnh lớn hơn trong hồ. Ngoài vùng gần, mặt nước dùng lưới thưa để giữ FPS. Va chạm nước vẫn dùng mực nước trung bình. Hồ dùng planar reflection: render thêm góc nhìn phản chiếu của núi, rừng và bầu trời vào texture, kết hợp Fresnel và sóng nhiều hướng có lọc theo khoảng cách để giảm vân lặp. Mây dùng trường noise nhiều lớp, có vùng sáng và tối theo hướng mặt trời. Mưa có màn vệt mưa, sương ẩm, mây xám, thay đổi gợn nước và lớp âm thanh gió mưa. Đây là hiệu ứng thời tiết trực quan, chưa phải mô phỏng vi vật lý mây và giọt mưa.

## FPS và độ chi tiết

Trong menu, **Ưu tiên đồ họa → Mượt, tự điều chỉnh tới 60 FPS** đo tải thực tế và thay đổi độ phân giải nội bộ từ 55% đến 100% theo mỗi chiều. Mức 60 FPS là mục tiêu, không phải bảo đảm. Khi GPU hoặc trình duyệt không đủ nhanh, FPS có thể thấp hơn. **Nét tối đa, giữ độ phân giải** tắt điều chỉnh này.

Cây trong khoảng 650 m dùng nhiều cành lá chụp thật có alpha; cây xa dùng ảnh cây được dựng một lần thành texture từ cùng mô hình, chỉ hai tam giác mỗi cây. Ảnh cây được cập nhật khi đổi ánh sáng hoặc thời tiết. Alpha được xử lý khi lấy mipmap để hạn chế viền đen. Cây quá 6 km không được render. Bộ dữ liệu cây gốc được giữ riêng để việc đổi LOD không xóa rừng. Chế độ Mượt giảm kích thước phản chiếu hồ, cập nhật HUD 10 lần/giây và không khử răng cưa hai lần. Vật lý vẫn chạy 120 Hz.

Bảng FPS có thời gian CPU và GPU cùng số cây gần/xa. GPU timing dùng truy vấn bất đồng bộ, có thể hiện n/a nếu trình duyệt không hỗ trợ extension. Ảnh PNG vẫn được render một lần ở độ phân giải tối đa đã chọn, sau đó game trở lại độ phân giải thích ứng.

Mật độ cây: Low 8.000, Medium 20.000, High 40.000, Ultra 100.000 cây. Chọn High và ưu tiên Mượt để bắt đầu, sau đó tăng theo khả năng máy. Render 4K cố định và rừng Ultra có thể giảm FPS đáng kể.

Các lưới đảo được gộp thành một lần vẽ mỗi lượt render; cây trên đảo dùng instancing. Radar cập nhật tối đa 10 lần/giây và chỉ dựng lại nền bản đồ khi máy bay rời vùng đã lưu hoặc đổi tầm xem.

Cơ sở tối ưu: [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices), [Khronos GPU timer extension](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/). Sương khí quyển tích phân mật độ theo độ cao trên đường nhìn để cảnh xa và thung lũng hòa màu tự nhiên hơn.

## GPU, 4K và DLSS

Nút **Chất lượng tối đa (4K + Ultra)** bật độ phân giải cao, chi tiết địa hình, bóng 4096 px và tăng nét có giới hạn. Renderer yêu cầu chế độ GPU hiệu năng cao của trình duyệt. Nó sử dụng GPU cho shader và instancing; mô phỏng bay chạy trên CPU. Không cố làm đầy CPU/RAM khi việc đó không cải thiện cảnh.

DLSS chính thức chưa có API WebGL cho dự án này. [NVIDIA DLSS Programming Guide](https://raw.githubusercontent.com/NVIDIA/DLSS/main/doc/DLSS_Programming_Guide_Release.pdf) yêu cầu engine DirectX 11, DirectX 12 hoặc Vulkan. Tùy chọn tăng nét trong bản web không phải DLSS, DLAA hoặc ray tracing. Tích hợp DLSS thật cần phiên bản native và pipeline render phù hợp.

## Bắt đầu dễ nhất

Chọn **Assisted**, **Trời lặng**, **High**, rồi **Bắt đầu bay (Trên hồ)**. Nhả phím A/D để trợ lái đưa cánh về ngang. Máy bay vẫn có thể stall nếu bay quá chậm. Trợ lái chỉ điều khiển elevator, aileron và rudder.

W hoặc mũi tên lên chúi mũi. S hoặc mũi tên xuống kéo mũi. A/D nghiêng cánh. Q/E đạp rudder hoặc lái bánh mũi. Shift hoặc dấu cộng tăng ga, Ctrl hoặc dấu trừ giảm ga. B giữ phanh. G chuyển flap qua 0°, 10°, 20°, 30°. T/Y chỉnh trim. C đổi góc nhìn, giữ chuột phải để nhìn quanh, cuộn chuột để zoom. P tạm dừng, R bắt đầu lại, Esc mở menu, F toàn màn hình, H xem hướng dẫn, M bật tắt radar ở góc phải trên, N bật tắt âm thanh. Nút +/− trên radar thay đổi tầm xem từ 1,5 đến 24 km.

Có thể bật **Lái bằng chuột**: đưa chuột về tâm màn hình để trung tính, đưa sang trái/phải để nghiêng, kéo xuống để nâng mũi. Bàn phím vẫn ưu tiên khi giữ W/S/A/D. Giữ chuột phải để nhìn quanh.

## Cất cánh

1. Chọn **Xuất phát từ đường băng**. Gió mặc định là trời lặng để tập giữ trục.
2. Giữ Shift đến 100% ga. Q/E sửa hướng khi cần. Phanh B phải được nhả.
3. Khi đạt khoảng 55 kt, nhấn S nhẹ từng nhịp để nâng mũi. Tránh kéo mạnh đến stall.
4. Sau khi lên cao ổn định, dùng G chuyển flap về 0° và giảm ga để bay hành trình.

Gió ngang làm máy bay đổi hướng và trôi theo gió. Bật gió nhẹ khi đã quen, dùng rudder và góc nghiêng để bù. Trời lặng không có nhiễu động ngẫu nhiên.

## Hạ cánh

Chọn **Luyện hạ cánh (đã căn đường băng)** để bắt đầu cách ngưỡng đường băng 2,64 km, hướng 000°, flap 20°, ga 32%, tốc độ khoảng 64 kt IAS. Hai bên thung lũng có lối tiếp cận thông thoáng.

1. Dùng radar để tìm đường băng màu vàng, căn hướng 000° và giữ máy bay thẳng trục. M bật hoặc tắt radar. Hướng dẫn chi tiết nằm trong menu H.
2. Giữ khoảng 62 đến 65 kt. Giảm ga từ từ bằng Ctrl để xuống, thêm ga bằng Shift nếu chìm quá nhanh. A/D sửa trục bằng những nhịp ngắn.
3. Khi sát đường băng, giảm ga về 0%, nhấn S rất nhẹ để nâng mũi và giảm tốc độ chìm. Đừng giữ S kéo mạnh liên tục.
4. Khi bánh đã chạm mặt đường, giữ B, dùng Q/E giữ trục cho đến khi dừng.
5. Nếu lệch nhiều hoặc có cảnh báo stall, tăng ga, hạ mũi để lấy tốc độ và bay vòng lại.

Trong bài luyện, cấu hình ban đầu đã gần dốc tiếp cận. Có thể giữ nguyên trong phần lớn chặng đầu, sau đó giảm ga và nâng mũi gần ngưỡng. Kiểm thử tự động đã thực hiện tiếp cận, nâng mũi và phanh dừng trên đường băng.

## Đồ họa và phong cách camera

**Độ phân giải render → 4K** render tối đa 3840 × 2160. Trên màn hình 16:9, bộ đệm là đúng 3840 × 2160. Màn hình tỷ lệ khác giữ nguyên tỷ lệ khung hình và nằm trong giới hạn đó. Bảng hiệu năng hiển thị độ phân giải render thực tế.

**Ultra** tăng chi tiết địa hình, tối đa 100.000 cây và shadow map 4096 px. Độ phân giải và mức chi tiết được chọn độc lập. Nếu FPS thấp, dùng High hoặc Medium, rồi chuyển độ phân giải về Theo màn hình.

Shader có PBR, ACES, sương khí quyển, Fresnel và sóng nước, bóng PCF, bề mặt địa hình có chi tiết, mây mềm nhiều lớp bằng shader và tán spruce nhiều tầng. Pass camera có MSAA, FXAA, quầng sáng nhẹ, màu highlight ấm và shadow trung tính, vignette và hạt phim nhỏ. Phong cách màu lấy cảm hứng từ video camera Sony, chưa mô phỏng một thân máy, cảm biến hoặc profile Sony cụ thể.

4K là độ phân giải, không đồng nghĩa với photorealism. Mô hình máy bay, cây và địa hình vẫn là tài nguyên sinh bằng mã. Để đạt mức như cảnh quay thật cần mesh và vật liệu PBR chất lượng cao, ảnh địa hình thực, hệ thống LOD và mây thể tích có ray marching. FPS phụ thuộc GPU, trình duyệt và độ phân giải.

## Vật liệu và nguồn nghiên cứu

Núi dùng DEM vùng Alps N46E007 từ Mapzen Terrain Tiles, được lấy mẫu lại thành lưới 1025 × 1025. Game xoay và đổi tỷ lệ tọa độ, hạ cao độ nền, nén độ cao địa hình 0,65 lần rồi tạo thung lũng, hồ, sân bay và bờ biển cho gameplay. Vì thế đây là cảnh quan được thiết kế dựa trên địa hình đo cao, không phải bản sao địa lý chính xác. Dữ liệu chạm đất dùng cùng tam giác đã dựng, không dùng DEM thô độc lập.

Nguồn địa hình: [Mapzen Terrain Tiles trên AWS](https://registry.opendata.aws/terrain-tiles/), [ghi nguồn và giấy phép](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). Produced using Copernicus data and information funded by the European Union, EU-DEM layers. Global GMTED2010 and SRTM data courtesy of the U.S. Geological Survey.

Rừng dùng ảnh cành thông và alpha atlas từ [Poly Haven Pine Tree 01](https://polyhaven.com/a/pine_tree_01), CC0. Ở gần, alpha cutoff thay đổi theo khoảng cách để lá không biến mất khi tạo mipmap. Ở xa, ảnh dựng từ cây thật trong game thay thế hình học cành để tăng mật độ rừng.

Địa hình có bóng che nắng theo height field và giảm ánh sáng môi trường trong khe núi. Height field che nắng có độ phân giải 125 m, độc lập với vùng shadow map chi tiết quanh máy bay. Đây là bóng địa hình gần đúng, có thể mềm hoặc bỏ lỡ vách rất nhỏ.

Địa hình dùng ảnh vật liệu 2K có mipmap và lọc anisotropic, đá được chiếu triplanar để giảm kéo giãn trên vách, normal map tăng chi tiết ánh sáng. Tài nguyên được đóng gói trong repo, không tải API bên ngoài khi chơi. Nguồn và giấy phép: [Poly Haven aerial_grass_rock](https://polyhaven.com/a/aerial_grass_rock), [rock_boulder_cracked](https://polyhaven.com/a/rock_boulder_cracked), [CC0](https://polyhaven.com/license). Chi tiết file nằm trong public/assets/materials/CREDITS.md.

Cơ sở sóng hình học và gợn nhỏ: [NVIDIA GPU Gems, Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models). Quan hệ tốc độ và độ cao tham khảo [FAA Airplane Flying Handbook, Energy Management](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/05_afh_ch4.pdf). Tham khảo cảnh quan [UNESCO Ha Long Bay, Cat Ba Archipelago](https://whc.unesco.org/en/list/672/).

Máy bay vẫn dựng từ hình học, cây thông dùng các cành ảnh chụp có alpha, bầu trời noise và phản chiếu phẳng. Đây chưa phải chất lượng quay từ camera thật, chưa có volumetric cloud ray marching hoặc ray tracing. [ASSET-PROMPTS.md](ASSET-PROMPTS.md) có prompt tạo thêm máy bay, đảo và texture, kèm định dạng và giới hạn tích hợp hiện tại.

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

Địa chỉ chơi sau khi deploy thành công: https://aansensei.github.io/flight-simulator/. GitHub hiện chuyển hướng đến tên miền của tài khoản: https://aansensei.dev/flight-simulator/.

Vite dùng base `/flight-simulator/` để đường dẫn JavaScript hoạt động trên GitHub Pages. Workflow `.github/workflows/deploy.yml` chạy kiểm thử, build rồi deploy thư mục `dist` sau mỗi lần push lên `main`. GitHub Pages cần chọn Source là GitHub Actions trong Settings → Pages. Workflow không tạo commit sinh tự động.

Có âm thanh động cơ, cánh quạt, gió, lăn bánh, phanh, tiếp đất, cảnh báo stall và lớp âm thanh mưa. Trình duyệt chỉ cho phát âm thanh sau thao tác người dùng. Bấm bắt đầu hoặc tiếp tục chuyến bay, bật Âm thanh động cơ trong menu, dùng N để bật tắt. Âm thanh được tổng hợp bằng Web Audio API, chưa phải bản thu máy bay thật.

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
