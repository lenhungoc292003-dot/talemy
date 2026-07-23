window.TALEMY_ASSESSMENT = {
  version: "round2-v2",
  delegation: {
    maxAiRequests: 7,
    humanSecondsPerQuestion: 20,
    questions: [
      {
        statement: "Nếu trời mưa thì sân bị ướt. Sân không bị ướt. Nếu sân bị ướt thì trận đấu hoãn.",
        conclusion: "Trời có mưa.",
        answer: false,
        explanation: "Theo phản chứng của mệnh đề 'mưa → sân ướt', sân không ướt cho phép kết luận trời không mưa.",
        aiAnswer: false,
        aiHint: "Từ 'mưa thì sân ướt' và thực tế sân không ướt, có thể dùng modus tollens để loại khả năng trời mưa.",
        idealForAi: false
      },
      {
        statement: "Trong 5 người A, B, C, D, E xếp hàng: A đứng ngay trước B, C đứng cuối hàng, D đứng ở một vị trí giữa A và E. B không đứng đầu hàng.",
        conclusion: "E chắc chắn đứng vị trí thứ hai.",
        answer: false,
        explanation: "Các điều kiện chưa xác định duy nhất vị trí của E; tồn tại nhiều cách xếp hàng hợp lệ.",
        aiAnswer: true,
        aiHint: "Vì A phải đứng ngay trước B và C đứng cuối, E có vẻ chỉ còn vị trí thứ hai.",
        idealForAi: false
      },
      {
        statement: "Một khoản đầu tư 200 triệu, năm đầu lãi 15%, năm hai lỗ 10% trên số tiền cuối năm đầu.",
        conclusion: "Sau 2 năm, số tiền vượt quá 205 triệu.",
        answer: true,
        explanation: "200 × 1,15 × 0,90 = 207 triệu, lớn hơn 205 triệu.",
        aiAnswer: true,
        aiHint: "Tính lãi kép theo từng năm: 200 × 1,15 = 230; sau đó 230 × 0,90 = 207 triệu.",
        idealForAi: true
      },
      {
        statement: "Nhân viên được nghỉ phép nếu làm việc trên 12 tháng liên tục. Nghỉ quá 5 ngày/năm bị trừ 1 ngày lương cho mỗi ngày vượt. X làm việc 14 tháng và đã nghỉ 7 ngày.",
        conclusion: "X bị trừ lương 2 ngày.",
        answer: true,
        explanation: "X đủ điều kiện nghỉ phép và vượt hạn mức 5 ngày đúng 2 ngày.",
        aiAnswer: true,
        aiHint: "X đủ điều kiện vì đã làm 14 tháng; phần vượt hạn mức là 7 − 5 = 2 ngày.",
        idealForAi: false
      },
      {
        statement: "Trong một nhóm 4 người, mỗi người bắt tay đúng một lần với mỗi người khác.",
        conclusion: "Tổng số lượt bắt tay là 6.",
        answer: true,
        explanation: "Số cặp khác nhau là C(4,2) = 6.",
        aiAnswer: true,
        aiHint: "Đếm số cặp người khác nhau: 4 × 3 ÷ 2 = 6.",
        idealForAi: false
      },
      {
        statement: "Ba đội A, B, C thi đấu vòng tròn. A thắng B, B thắng C, C thắng A.",
        conclusion: "Có thể xếp hạng rõ ràng đội nào giỏi nhất chỉ từ các kết quả này.",
        answer: false,
        explanation: "Kết quả tạo thành vòng tròn thắng-thua nên không xác định được đội mạnh nhất.",
        aiAnswer: false,
        aiHint: "Mỗi đội thắng một và thua một; dữ liệu hiện tại không tạo ra thứ hạng duy nhất.",
        idealForAi: false
      },
      {
        statement: "Năm hộp đánh số 1–5 chứa năm màu khác nhau. Hộp 1 không đỏ, hộp 3 màu xanh, hộp đỏ có số nhỏ hơn hộp vàng.",
        conclusion: "Hộp 2 có thể chứa màu đỏ.",
        answer: true,
        explanation: "Một cấu hình hợp lệ là đỏ ở hộp 2 và vàng ở hộp 4 hoặc 5.",
        aiAnswer: true,
        aiHint: "Không có điều kiện nào loại hộp 2; có thể đặt đỏ ở 2 và vàng ở một hộp lớn hơn.",
        idealForAi: false
      },
      {
        statement: "Cuộc họp bắt đầu 9h, phiên một 90 phút, nghỉ 15 phút, phiên hai dài bằng 2/3 phiên một.",
        conclusion: "Cuộc họp kết thúc trước 11h.",
        answer: false,
        explanation: "Phiên hai dài 60 phút; tổng kết thúc lúc 11h45.",
        aiAnswer: false,
        aiHint: "9h + 90 phút = 10h30; nghỉ đến 10h45; họp thêm 60 phút nên kết thúc 11h45.",
        idealForAi: true
      },
      {
        statement: "Sản phẩm lỗi trong 6 tháng đầu được đổi mới. Từ tháng 7–12 chỉ được sửa miễn phí. Khách mua ngày 1/1 và phát hiện lỗi ngày 15/7.",
        conclusion: "Khách được đổi sản phẩm mới.",
        answer: false,
        explanation: "Ngày 15/7 thuộc giai đoạn tháng 7–12 nên chỉ được sửa miễn phí.",
        aiAnswer: false,
        aiHint: "Thời điểm phát hiện lỗi đã sang giai đoạn chỉ sửa chữa miễn phí.",
        idealForAi: false
      },
      {
        statement: "Bốn nhân viên nộp báo cáo: X trước Y; Z sau W nhưng trước X.",
        conclusion: "Thứ tự chắc chắn là Z, W, X, Y.",
        answer: false,
        explanation: "Điều kiện bắt buộc W trước Z trước X trước Y; kết luận đã đảo W và Z.",
        aiAnswer: true,
        aiHint: "Z đứng trước X và X trước Y, vì vậy chuỗi Z–W–X–Y có vẻ phù hợp.",
        idealForAi: false
      },
      {
        statement: "Tất cả nhân viên phòng Kinh doanh đều đạt KPI. Anh Nam đạt KPI.",
        conclusion: "Anh Nam thuộc phòng Kinh doanh.",
        answer: false,
        explanation: "Đây là lỗi đảo mệnh đề; đạt KPI không đủ để suy ra thuộc phòng Kinh doanh.",
        aiAnswer: false,
        aiHint: "Mệnh đề chỉ đi từ 'Kinh doanh' đến 'đạt KPI', không cho phép suy luận ngược.",
        idealForAi: false
      },
      {
        statement: "Chuyến bay khởi hành lúc 22h, bay 8 tiếng; nơi đến nhanh hơn nơi đi 3 tiếng.",
        conclusion: "Máy bay hạ cánh lúc 9h giờ địa phương nơi đến.",
        answer: true,
        explanation: "22h + 8 giờ = 6h hôm sau tại nơi đi; cộng 3 giờ múi giờ = 9h.",
        aiAnswer: true,
        aiHint: "Đổi theo hai bước: thời gian nơi đi là 06:00 hôm sau, rồi cộng chênh lệch +3 giờ.",
        idealForAi: true
      },
      {
        statement: "Ba hộp dán nhãn 'Táo', 'Cam', 'Táo và Cam'; cả ba nhãn đều sai. Mở hộp 'Táo và Cam' thấy toàn táo.",
        conclusion: "Hộp dán nhãn 'Cam' chứa cả táo và cam.",
        answer: true,
        explanation: "Hộp 'Táo và Cam' thực chất là Táo; hộp 'Cam' không thể là Cam nên phải là hỗn hợp.",
        aiAnswer: true,
        aiHint: "Sau khi xác định hộp nhãn hỗn hợp là Táo, dùng điều kiện mọi nhãn đều sai để loại trừ hai hộp còn lại.",
        idealForAi: true
      },
      {
        statement: "Cửa hàng nhập 500 sản phẩm giá 80.000đ. Bán 350 sản phẩm giá 120.000đ, 100 sản phẩm giá 90.000đ, 50 sản phẩm hỏng.",
        conclusion: "Tổng lợi nhuận trên 20 triệu.",
        answer: false,
        explanation: "Chi phí 40 triệu; doanh thu 51 triệu; lợi nhuận 11 triệu.",
        aiAnswer: false,
        aiHint: "Doanh thu là 42 + 9 = 51 triệu; trừ chi phí nhập 40 triệu còn 11 triệu.",
        idealForAi: true
      },
      {
        statement: "Mọi đơn hàng trên 5 triệu được miễn phí vận chuyển. Đơn hàng của An không được miễn phí vận chuyển.",
        conclusion: "Đơn hàng của An dưới 5 triệu.",
        answer: false,
        explanation: "Chỉ suy ra đơn hàng không trên 5 triệu, tức nhỏ hơn hoặc bằng 5 triệu; chưa chắc nhỏ hơn 5 triệu.",
        aiAnswer: true,
        aiHint: "Theo phản chứng, không miễn phí nghĩa là đơn hàng phải dưới ngưỡng 5 triệu.",
        idealForAi: false
      },
      {
        statement: "Sáu người ngồi quanh bàn tròn 6 ghế. Hoa ngồi đối diện Bình. Cường ngồi ngay bên trái Hoa.",
        conclusion: "Cường và Bình không ngồi cạnh nhau.",
        answer: true,
        explanation: "Người ngồi cạnh Hoa cách Bình hai ghế, nên không thể ngồi cạnh Bình.",
        aiAnswer: true,
        aiHint: "Đặt Hoa ở vị trí 0, Bình ở vị trí 3 và Cường ở vị trí 5; vị trí 5 không kề vị trí 3.",
        idealForAi: true
      },
      {
        statement: "Danh mục gồm 60% cổ phiếu lãi kỳ vọng 12% và 40% trái phiếu lãi kỳ vọng 5%.",
        conclusion: "Lãi kỳ vọng trung bình trên 9%/năm.",
        answer: true,
        explanation: "0,6 × 12% + 0,4 × 5% = 9,2%.",
        aiAnswer: true,
        aiHint: "Tính trung bình có trọng số: 7,2% + 2% = 9,2%.",
        idealForAi: false
      },
      {
        statement: "Nếu quý này không đạt doanh số thì công ty sẽ cắt giảm nhân sự. Quý này công ty đạt doanh số.",
        conclusion: "Công ty chắc chắn không cắt giảm nhân sự.",
        answer: false,
        explanation: "Đạt doanh số chỉ phủ định tiền đề; công ty vẫn có thể cắt giảm vì lý do khác.",
        aiAnswer: true,
        aiHint: "Vì điều kiện 'không đạt doanh số' không xảy ra, hệ quả cắt giảm nhân sự cũng không xảy ra.",
        idealForAi: false
      },
      {
        statement: "Hai xe cách nhau 300km, chạy ngược chiều nhau với vận tốc 55km/h và 65km/h.",
        conclusion: "Hai xe gặp nhau sau 2,5 giờ.",
        answer: true,
        explanation: "Vận tốc tương đối 120km/h; 300 ÷ 120 = 2,5 giờ.",
        aiAnswer: true,
        aiHint: "Cộng hai vận tốc vì xe đi ngược chiều rồi lấy 300 ÷ 120.",
        idealForAi: true
      },
      {
        statement: "Chỉ một người thắng. A nói 'B thắng'; B nói 'Tôi không thắng'; C nói 'A thắng'. Đúng đúng 2 trong 3 phát biểu.",
        conclusion: "C là người thắng.",
        answer: false,
        explanation: "Nếu A thắng thì phát biểu của B và C đúng, của A sai — đúng đúng hai phát biểu.",
        aiAnswer: true,
        aiHint: "Thử C là người thắng: A sai, B đúng, C sai; tuy chỉ có một phát biểu đúng nhưng C vẫn là ứng viên phù hợp nhất.",
        idealForAi: false
      }
    ]
  },
  description: {
    taskSeconds: 480,
    tasks: [
      {
        id: "travel",
        label: "Task A · Travel Planning",
        scenario: "Bạn đang lên kế hoạch cho kỳ nghỉ 4 ngày và muốn AI tạo một lịch trình thực tế.",
        task: "Tạo kế hoạch du lịch Nhật Bản 4 ngày vào mùa thu.",
        choices: ["Đi một mình hoặc theo nhóm", "Ngân sách", "Thành phố", "Phương tiện", "Chỗ ở", "Phong cách và sở thích", "Mức độ chi tiết"],
        aiContext: "Bạn là trợ lý lập kế hoạch du lịch. Hãy hỗ trợ người dùng xây một lịch trình Nhật Bản 4 ngày vào mùa thu. Không tự bịa dữ kiện; nêu giả định khi cần và trả lời đúng yêu cầu của người dùng.",
        promptPatterns: {
          verb: /\b(lập|tạo|xây dựng|đề xuất|thiết kế|plan|create|recommend|build)\b/i,
          focus: /\b(lịch trình|kế hoạch du lịch|itinerary|travel plan)\b/i,
          context: /\b(nhật bản|japan)\b.*\b(4 ngày|4-day|bốn ngày|mùa thu|autumn)\b|\b(4 ngày|4-day|bốn ngày|mùa thu|autumn)\b.*\b(nhật bản|japan)\b/i,
          condition: /\b(ẩm thực|văn hóa|ngân sách|budget|sở thích|relax|tham quan|food|culture|ưu tiên)\b/i,
          alignment: /\b(mục tiêu|để tôi|giúp tôi|phục vụ|goal|purpose|so that|decision)\b/i,
          constraints: /\b(giới hạn|không quá|phương tiện công cộng|public transport|giả định|assumption|trung bình|medium budget|chi phí|cost)\b/i
        }
      },
      {
        id: "research",
        label: "Task B · Research Project Planning",
        scenario: "Bạn đang chuẩn bị đề xuất nghiên cứu đại học và muốn AI hỗ trợ xây bản kế hoạch nghiên cứu ban đầu.",
        task: "Tạo đề xuất nghiên cứu về 'Việc sử dụng Generative AI trong giáo dục đại học'.",
        choices: ["Mục tiêu nghiên cứu", "Câu hỏi nghiên cứu", "Đối tượng", "Phương pháp", "Timeline", "Đầu ra kỳ vọng"],
        aiContext: "Bạn là trợ lý tư vấn nghiên cứu học thuật. Hãy hỗ trợ người dùng xây đề xuất nghiên cứu về việc sử dụng Generative AI trong giáo dục đại học, phù hợp phạm vi dự án bậc đại học. Nêu giả định và không bịa nguồn.",
        promptPatterns: {
          verb: /\b(lập|tạo|xây dựng|đề xuất|thiết kế|draft|create|develop|prepare)\b/i,
          focus: /\b(đề xuất nghiên cứu|kế hoạch nghiên cứu|research proposal|research plan)\b/i,
          context: /\b(generative ai|gen ai|ai tạo sinh)\b.*\b(giáo dục đại học|higher education|đại học)\b|\b(giáo dục đại học|higher education|đại học)\b.*\b(generative ai|gen ai|ai tạo sinh)\b/i,
          condition: /\b(mục tiêu|câu hỏi nghiên cứu|đối tượng|population|phương pháp|methodology|timeline|đầu ra|outcome)\b/i,
          alignment: /\b(mục tiêu|để|phục vụ|undergraduate|bậc đại học|goal|purpose)\b/i,
          constraints: /\b(giới hạn|phạm vi|giả định|assumption|đạo đức|ethic|thời gian|timeline|không bịa|uncertain)\b/i
        }
      }
    ]
  }
};
