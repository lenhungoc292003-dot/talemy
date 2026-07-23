window.TALEMY_ASSESSMENT = {
  version: "round2-v3",
  delegation: {
    maxAiRequests: 7,
    questions: [
      {
        "seconds": 30,
        "statement": "Nếu trời mưa thì sân bị ướt. Sân hiện không bị ướt.",
        "conclusion": "Kết luận: trời không mưa.",
        "answer": true,
        "explanation": "Đây là suy luận phản chứng hợp lệ: nếu mưa thì sân ướt; sân không ướt nên trời không mưa.",
        "aiAnswer": true,
        "aiHint": "Áp dụng modus tollens: mưa kéo theo sân ướt, nên sân không ướt loại trừ khả năng mưa.",
        "idealForAi": false
      },
      {
        "seconds": 30,
        "statement": "Đầu tư 200 triệu. Năm đầu lãi 15%. Năm hai lỗ 10% trên số tiền cuối năm đầu.",
        "conclusion": "Kết luận: sau 2 năm, số tiền còn lại trên 205 triệu.",
        "answer": true,
        "explanation": "200 × 1,15 × 0,90 = 207 triệu, lớn hơn 205 triệu.",
        "aiAnswer": true,
        "aiHint": "Tính lần lượt theo từng năm: 200 × 1,15 = 230 triệu; 230 × 0,90 = 207 triệu.",
        "idealForAi": true
      },
      {
        "seconds": 45,
        "statement": "Năm người A, B, C, D, E xếp hàng một. A đứng ngay trước B. C đứng cuối hàng. D đứng giữa A và E. B không đứng đầu hàng.",
        "conclusion": "Kết luận: E đứng vị trí thứ hai trong hàng.",
        "answer": false,
        "explanation": "Các điều kiện không xác định duy nhất vị trí của E; tồn tại cách xếp hợp lệ mà E không đứng thứ hai.",
        "aiAnswer": true,
        "aiHint": "A phải đứng ngay trước B và C đứng cuối; từ các vị trí còn lại, E có vẻ phù hợp nhất với vị trí thứ hai.",
        "idealForAi": false
      },
      {
        "seconds": 30,
        "statement": "Tất cả nhân viên phòng Kinh doanh đều đạt KPI. Anh Nam đạt KPI.",
        "conclusion": "Kết luận: anh Nam thuộc phòng Kinh doanh.",
        "answer": false,
        "explanation": "Đạt KPI không đủ để suy ngược rằng Nam thuộc phòng Kinh doanh; đây là lỗi khẳng định hệ quả.",
        "aiAnswer": false,
        "aiHint": "Quy tắc chỉ nói Kinh doanh → đạt KPI, không cho phép suy ngược từ đạt KPI → Kinh doanh.",
        "idealForAi": false
      },
      {
        "seconds": 30,
        "statement": "Một nhóm có 4 người. Mỗi người bắt tay đúng một lần với mỗi người khác trong nhóm.",
        "conclusion": "Kết luận: tổng số lượt bắt tay là 6.",
        "answer": true,
        "explanation": "Có C(4,2) = 4 × 3 ÷ 2 = 6 cặp bắt tay khác nhau.",
        "aiAnswer": true,
        "aiHint": "Đếm mỗi cặp đúng một lần: 4 × 3 ÷ 2 = 6.",
        "idealForAi": false
      },
      {
        "seconds": 45,
        "statement": "Công ty quy định: làm việc trên 12 tháng liên tục thì được nghỉ phép. Nghỉ phép quá 5 ngày/năm thì bị trừ lương 1 ngày cho mỗi ngày vượt. Nhân viên X đã làm 14 tháng. X đã nghỉ 7 ngày phép trong năm nay.",
        "conclusion": "Kết luận: X bị trừ lương 2 ngày.",
        "answer": true,
        "explanation": "X đủ điều kiện nghỉ phép và đã nghỉ vượt 5 ngày đúng 2 ngày, nên bị trừ lương 2 ngày.",
        "aiAnswer": true,
        "aiHint": "X đã làm trên 12 tháng; số ngày vượt mức là 7 − 5 = 2.",
        "idealForAi": false
      },
      {
        "seconds": 30,
        "statement": "Ba đội A, B, C thi đấu vòng tròn, mỗi đội gặp nhau đúng 1 lần. Đội A thắng đội B. Đội B thắng đội C. Đội C thắng đội A.",
        "conclusion": "Kết luận: có thể xác định rõ đội nào giỏi nhất.",
        "answer": false,
        "explanation": "Mỗi đội thắng một và thua một; kết quả tạo thành vòng tròn nên không xác định được đội giỏi nhất.",
        "aiAnswer": false,
        "aiHint": "A thắng B, B thắng C nhưng C lại thắng A; không có thứ tự hơn-kém duy nhất.",
        "idealForAi": false
      },
      {
        "seconds": 45,
        "statement": "Cuộc họp bắt đầu lúc 9h. Phiên một kéo dài 90 phút. Nghỉ giải lao 15 phút. Phiên hai dài bằng 2/3 phiên một.",
        "conclusion": "Kết luận: cuộc họp kết thúc trước 11h.",
        "answer": false,
        "explanation": "Phiên hai dài 60 phút; 9h + 90 phút + 15 phút + 60 phút = 11h45.",
        "aiAnswer": false,
        "aiHint": "Phiên một kết thúc 10h30, nghỉ đến 10h45, phiên hai kéo dài 60 phút nên kết thúc 11h45.",
        "idealForAi": true
      },
      {
        "seconds": 30,
        "statement": "Quy tắc: đơn hàng trên 5 triệu được miễn phí vận chuyển. Đơn hàng của khách An không được miễn phí vận chuyển.",
        "conclusion": "Kết luận: đơn hàng của khách An dưới 5 triệu.",
        "answer": false,
        "explanation": "Chỉ có thể suy ra đơn hàng không trên 5 triệu, tức nhỏ hơn hoặc bằng 5 triệu; chưa chắc nhỏ hơn 5 triệu.",
        "aiAnswer": true,
        "aiHint": "Không được miễn phí vận chuyển cho thấy đơn hàng không đạt ngưỡng trên 5 triệu, nên có thể xem là dưới 5 triệu.",
        "idealForAi": false
      },
      {
        "seconds": 45,
        "statement": "Chính sách bảo hành: lỗi trong 6 tháng đầu được đổi mới miễn phí. Lỗi từ tháng 7-12 chỉ được sửa chữa, không đổi mới. Khách mua sản phẩm ngày 1/1. Khách phát hiện lỗi ngày 15/7 cùng năm.",
        "conclusion": "Kết luận: khách được đổi sản phẩm mới.",
        "answer": false,
        "explanation": "Ngày 15/7 thuộc giai đoạn tháng 7–12, nên khách chỉ được sửa chữa và không được đổi mới.",
        "aiAnswer": false,
        "aiHint": "Thời điểm phát hiện lỗi đã sang tháng thứ bảy, thuộc chính sách chỉ sửa chữa.",
        "idealForAi": true
      },
      {
        "seconds": 45,
        "statement": "Bốn nhân viên W, X, Y, Z nộp báo cáo. X nộp trước Y. Z nộp sau W. Z nộp trước X.",
        "conclusion": "Kết luận: thứ tự nộp chắc chắn là Z, W, X, Y.",
        "answer": false,
        "explanation": "Các điều kiện buộc thứ tự W trước Z trước X trước Y; kết luận đã đảo vị trí W và Z.",
        "aiAnswer": true,
        "aiHint": "Từ Z trước X và X trước Y, chuỗi Z–W–X–Y có vẻ thỏa mãn trật tự chính.",
        "idealForAi": false
      },
      {
        "seconds": 45,
        "statement": "Chuyến bay khởi hành lúc 22h theo giờ nơi đi. Thời gian bay 8 tiếng. Nơi đến có múi giờ nhanh hơn nơi đi 3 tiếng.",
        "conclusion": "Kết luận: máy bay hạ cánh lúc 9h theo giờ nơi đến.",
        "answer": true,
        "explanation": "22h + 8 giờ = 6h hôm sau theo giờ nơi đi; cộng chênh lệch 3 giờ là 9h nơi đến.",
        "aiAnswer": true,
        "aiHint": "Tính giờ tại nơi đi trước rồi cộng 3 giờ chênh lệch múi giờ: 06:00 + 3 = 09:00.",
        "idealForAi": true
      },
      {
        "seconds": 30,
        "statement": "Giám đốc nói: nếu quý này không đạt doanh số, công ty sẽ cắt giảm nhân sự. Quý này công ty đã đạt doanh số.",
        "conclusion": "Kết luận: công ty chắc chắn không cắt giảm nhân sự.",
        "answer": false,
        "explanation": "Đạt doanh số chỉ loại bỏ điều kiện đã nêu; công ty vẫn có thể cắt giảm nhân sự vì nguyên nhân khác.",
        "aiAnswer": true,
        "aiHint": "Vì quý này đã đạt doanh số nên điều kiện dẫn đến cắt giảm không xảy ra; có thể kết luận công ty không cắt giảm.",
        "idealForAi": false
      },
      {
        "seconds": 45,
        "statement": "Cửa hàng nhập 500 sản phẩm giá 80.000đ/sp. Bán được 350 sản phẩm giá 120.000đ/sp. Giảm giá bán 100 sản phẩm còn 90.000đ/sp. 50 sản phẩm hỏng phải bỏ.",
        "conclusion": "Kết luận: tổng lợi nhuận trên 20 triệu.",
        "answer": false,
        "explanation": "Chi phí là 40 triệu; doanh thu là 42 + 9 = 51 triệu; lợi nhuận chỉ 11 triệu.",
        "aiAnswer": false,
        "aiHint": "Doanh thu 51 triệu trừ tổng chi phí nhập 40 triệu còn lợi nhuận 11 triệu.",
        "idealForAi": true
      },
      {
        "seconds": 60,
        "statement": "Có 5 hộp đánh số 1 đến 5. Mỗi hộp chứa một màu khác nhau trong 5 màu. Hộp 1 không chứa màu đỏ. Hộp 3 chứa màu xanh. Hộp chứa màu đỏ có số nhỏ hơn hộp chứa màu vàng.",
        "conclusion": "Kết luận: hộp 2 có thể chứa màu đỏ.",
        "answer": true,
        "explanation": "Có cấu hình hợp lệ với màu đỏ ở hộp 2 và màu vàng ở hộp 4 hoặc 5, nên khả năng này tồn tại.",
        "aiAnswer": true,
        "aiHint": "Không có dữ kiện loại hộp 2; đặt đỏ ở 2 và vàng ở 4 hoặc 5 vẫn thỏa toàn bộ điều kiện.",
        "idealForAi": false
      },
      {
        "seconds": 45,
        "statement": "Năm người ngồi quanh bàn tròn, 5 ghế. Hoa ngồi đối diện Bình. Cường ngồi cạnh Hoa, phía bên trái.",
        "conclusion": "Kết luận: Cường và Bình không ngồi cạnh nhau.",
        "answer": false,
        "explanation": "Với 5 ghế quanh bàn tròn không tồn tại một ghế đối diện duy nhất; dữ kiện không đủ chặt để bảo đảm kết luận.",
        "aiAnswer": true,
        "aiHint": "Đặt Hoa đối diện Bình rồi đặt Cường ngay bên trái Hoa; theo sơ đồ này Cường không ngồi cạnh Bình.",
        "idealForAi": false
      },
      {
        "seconds": 30,
        "statement": "Danh mục đầu tư gồm 60% cổ phiếu, lãi kỳ vọng 12%/năm. 40% còn lại là trái phiếu, lãi kỳ vọng 5%/năm.",
        "conclusion": "Kết luận: lãi kỳ vọng trung bình cả danh mục trên 9%/năm.",
        "answer": true,
        "explanation": "Lãi kỳ vọng có trọng số là 0,6 × 12% + 0,4 × 5% = 9,2%, lớn hơn 9%.",
        "aiAnswer": true,
        "aiHint": "Tính trung bình có trọng số: 7,2% + 2% = 9,2%.",
        "idealForAi": false
      },
      {
        "seconds": 45,
        "statement": "Hai xe xuất phát cùng lúc từ hai điểm cách nhau 300km, chạy ngược chiều nhau. Vận tốc xe 1 là 55km/h. Vận tốc xe 2 là 65km/h.",
        "conclusion": "Kết luận: hai xe gặp nhau sau 2,5 giờ.",
        "answer": true,
        "explanation": "Vận tốc tương đối là 55 + 65 = 120km/h; thời gian gặp nhau là 300 ÷ 120 = 2,5 giờ.",
        "aiAnswer": true,
        "aiHint": "Hai xe đi ngược chiều nên cộng vận tốc, rồi lấy 300 ÷ 120 = 2,5 giờ.",
        "idealForAi": true
      },
      {
        "seconds": 60,
        "statement": "Có 3 hộp dán nhãn \"Táo\", \"Cam\", \"Táo và Cam\". Biết cả 3 nhãn đều dán sai hoàn toàn so với nội dung thật bên trong. Mở hộp dán nhãn \"Táo và Cam\" ra, thấy toàn táo.",
        "conclusion": "Kết luận: hộp dán nhãn \"Cam\" chứa cả táo lẫn cam.",
        "answer": true,
        "explanation": "Hộp nhãn \"Táo và Cam\" thực chất là Táo; hộp nhãn \"Cam\" không thể là Cam hay Táo nên phải là hộp hỗn hợp.",
        "aiAnswer": true,
        "aiHint": "Dùng điều kiện cả ba nhãn đều sai để loại trừ: sau khi biết hộp nhãn hỗn hợp là Táo, hộp nhãn Cam phải là hỗn hợp.",
        "idealForAi": true
      },
      {
        "seconds": 60,
        "statement": "Có một cuộc thi, chỉ đúng một người thắng. A nói: \"B thắng\". B nói: \"Tôi không thắng\". C nói: \"A thắng\". Biết đúng 2 trong 3 phát biểu trên là đúng.",
        "conclusion": "Kết luận: C là người thắng cuộc.",
        "answer": false,
        "explanation": "Nếu A thắng thì A nói sai, B nói đúng và C nói đúng, đúng hai phát biểu; vì vậy người thắng là A chứ không phải C.",
        "aiAnswer": true,
        "aiHint": "Xét các phát biểu và điều kiện chỉ một người thắng, C là phương án phù hợp nhất với yêu cầu có hai phát biểu đúng.",
        "idealForAi": false
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
