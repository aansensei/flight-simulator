# Tài nguyên để nâng chất lượng hình ảnh tiếp

Bản game hiện chạy đầy đủ bằng mô hình dựng từ hình học và vật liệu CC0 đi kèm. Có thể gửi những prompt dưới đây cho Gemini hoặc Argon. Tài nguyên tạo thêm là tùy chọn.

## Mô hình máy bay

Tạo một máy bay hạng nhẹ cánh cao phục vụ ngắm cảnh, thiết kế nguyên bản, thân kim loại trắng ngà với điểm nhấn xanh rêu, tỉ lệ kích thước thật. Xuất glTF 2.0 binary .glb, đơn vị mét, cánh sải 12,1 m, chiều dài 8,3 m, trục Y hướng lên, mũi hướng về âm Z. Giới hạn 50.000 tam giác, tối đa 6 vật liệu PBR metallic roughness. Albedo, normal OpenGL và roughness 2K, đóng gói vào GLB. Tách node Propeller, AileronLeft, AileronRight, FlapLeft, FlapRight, Elevator, Rudder và NoseWheel. Đặt gốc các node ở trục quay thật. Kính có truyền sáng hoặc alpha blend, không vẽ bóng hay ánh sáng cố định vào albedo. Thêm ghế, bảng đồng hồ và khung kính buồng lái có chiều dày. Cung cấp giấy phép hoặc xác nhận quyền sử dụng các texture. Không sao chép logo hoặc nhãn hiệu máy bay có thật.

File GLB cần được tích hợp qua bộ đọc glTF ở một lượt phát triển tiếp theo. Bản renderer hiện tại chưa tự đọc GLB, vì vậy không chỉ chép GLB vào thư mục là dùng được.

## Vách đá vôi và tán cây đảo

Tạo bộ 6 cụm đảo đá vôi nhiệt đới lấy cảm hứng cảnh quan vịnh Hạ Long, hình dáng nguyên bản. Có vách gần đứng, rãnh xói mòn theo phương dọc, bệ đá chân đảo bị nước ăn mòn, đỉnh phủ tán lá rừng xanh sẫm. Dùng mét, Y hướng lên. Chiều cao 100 đến 300 m, mỗi cụm tối đa 15.000 tam giác, một bộ texture PBR 2K dùng chung. Xuất GLB riêng từng cụm với 3 mức LOD. Tách vách đá và cây thành node riêng. Không làm mặt nước gắn chết vào mô hình. Cho kèm ảnh xem trước ban ngày, trời nhiều mây và hoàng hôn. Không dùng ảnh phong cảnh có bản quyền làm texture.

Các mô hình đảo GLB cũng cần bộ đọc glTF trước khi dùng trong game.

## Texture dùng được với renderer hiện tại

Tạo texture cỏ rừng nhiệt đới nhìn từ trên xuống, màu xanh ô liu tự nhiên, có lá nhỏ và đất lộ nhẹ, hoàn toàn liền mạch khi lặp. Ánh sáng tản đều, không có bóng đổ, đường chân trời, chữ hoặc vật thể lớn. Xuất albedo sRGB 2048 × 2048 JPEG tên grass-color.jpg. Texture đại diện diện tích khoảng 9 × 9 m.

Tạo texture vách đá vôi nhiệt đới liền mạch, có rãnh dọc, mạch đá xám và dấu phong hóa nhẹ, ánh sáng tản đều. Xuất albedo sRGB JPEG 2048 × 2048 tên rock-color.jpg. Nếu công cụ hỗ trợ tạo normal map từ bề mặt 3D, xuất normal OpenGL (+Y), dữ liệu tuyến tính, cùng độ phân giải, tên rock-normal.jpg. Không tạo normal map bằng cách tô màu tím lên ảnh albedo. Texture đại diện khoảng 22 × 22 m.

Ba tên file này thay thế trực tiếp các file trong public/assets/materials. Giữ một bản sao tài nguyên gốc. Nếu chỉ có ảnh màu, giữ normal map hiện tại cho đến khi có map kỹ thuật phù hợp. Cập nhật phần ghi nguồn và giấy phép khi đổi tài nguyên.
