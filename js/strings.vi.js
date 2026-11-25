// strings.vi.js — Toàn bộ chữ hiển thị trên giao diện (tiếng Việt).
// Muốn sửa lời thì sửa phần chữ trong dấu nháy, giữ nguyên tên ở bên trái dấu hai chấm.
// Chỗ nào có dạng (n) => `... ${n} ...` là câu có số thay đổi: giữ nguyên ${n}.

const WEEKDAYS = [
  'Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy',
];

export const S = {
  nav: {
    label: 'Các mục chính',
    today: 'Hôm nay',
    counter: 'Niệm Phật',
    schedule: 'Thời khóa',
    lessons: 'Học',
    calendar: 'Lịch',
  },

  header: {
    fontSmaller: 'Giảm cỡ chữ',
    fontLarger: 'Tăng cỡ chữ',
    settings: 'Cài đặt',
  },

  common: {
    back: 'Quay lại',
    cancel: 'Không',
    abort: 'Thôi',
    reviewLabel: 'CẦN THẨM ĐỊNH',
    number: (n) => n.toLocaleString('vi-VN'),
    comingSoon: 'Phần này đang được xây dựng.',
    comingSoonStage: (stage) => `Sẽ có ở Giai đoạn ${stage}.`,
    errorTitle: 'Có lỗi nhỏ xảy ra',
    errorBody: 'Xin tải lại trang. Dữ liệu đã lưu của quý vị vẫn còn trên máy.',
    saveFailed: 'Chưa lưu được vào máy. Có thể bộ nhớ đã đầy.',
    notSaving:
      'Trình duyệt này đang không cho lưu dữ liệu (có thể do chế độ ẩn danh). Số câu niệm sẽ mất khi đóng app.',
  },

  phrases: {
    'nam-mo-a-di-da-phat': 'Nam Mô A Di Đà Phật',
    'a-di-da-phat': 'A Di Đà Phật',
  },
  phraseLength: {
    'nam-mo-a-di-da-phat': '6 chữ',
    'a-di-da-phat': '4 chữ',
  },

  today: {
    title: 'Hôm nay',
    solarDate: (d) =>
      `${WEEKDAYS[d.getDay()]}, ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`,
    countLabel: 'Số câu đã niệm hôm nay',
    countUnit: 'câu',
    start: 'Bắt đầu niệm Phật',
  },

  counter: {
    title: 'Niệm Phật',
    hints: {
      idle: 'Chạm để bắt đầu',
      running: 'Chạm để đếm',
      paused: 'Đang tạm nghỉ',
    },
    idleKnockHint: 'Chạm để gõ mõ',
    // Dòng nhắc trong vòng tròn, theo cách đếm
    runningHints: {
      touch: 'Chạm để đếm',
      handWoodfish: 'Chạm để gõ mõ',
      autoWoodfish: 'App đang đếm',
      voice: 'App đang nghe',
    },
    micStatus: {
      off: '',
      starting: 'Đang mở micro. Nếu máy hỏi, xin chọn Cho phép.',
      warming: 'Xin giữ yên lặng một chút để máy làm quen.',
      listening: 'Đang lắng nghe.',
      voice: 'Đang nghe thấy tiếng.',
      missing: 'Máy chưa có micro. Xin cắm micro hoặc tai nghe có micro vào, app sẽ tự nghe tiếp. Trong lúc đó vẫn chạm vòng tròn để đếm được.',
      busy: 'Micro đang bận hoặc bị máy chặn. Xin đóng app khác đang dùng micro, rồi bấm Tạm nghỉ và Niệm tiếp.',
      denied: 'Micro đang bị chặn. Xin cho phép micro trong cài đặt trình duyệt, hoặc chạm vòng tròn để đếm.',
      unsupported: 'Không dùng được micro ở đây. Quý vị vẫn chạm vòng tròn để đếm được.',
      failed: 'Không mở được micro. Quý vị vẫn chạm vòng tròn để đếm được.',
    },
    knock: 'Gõ mõ',
    chime: 'Gõ khánh',
    undo: 'Bớt một câu',
    beadLabel: (phrase, count) => `${phrase}. Chạm để đếm một câu. Đã đếm ${count} câu.`,
    settingsLink: 'Cài đặt niệm Phật',
    todayLine: (n) => `Hôm nay: ${n} câu`,
    goalLine: (n, goal) => `${n} trên ${goal} câu`,
    rounds: (rounds, rest) => `${rounds} tràng lẻ ${rest}`,
    elapsed: (time) => `Đã niệm ${time}`,
    remaining: (time) => `Còn lại ${time}`,
    goalReached: (time) => `Đã đủ. Đã niệm ${time}`,
    pause: 'Tạm nghỉ',
    resume: 'Niệm tiếp',
    end: 'Kết thúc',
    done: 'Hoàn tất',
    summary: (n) => `Thời này niệm được ${n} câu.`,
    countTitle: 'Cách đếm',
    countStyles: {
      touch: { label: 'Chạm để đếm', note: 'Mỗi câu chạm vòng tròn một lần.' },
      handWoodfish: { label: 'Gõ mõ để đếm', note: 'Chạm vòng tròn là gõ mõ, app đếm theo tiếng mõ.' },
      autoWoodfish: { label: 'App gõ mõ và đếm', note: 'Niệm theo nhịp mõ, không cần chạm.' },
      voice: { label: 'App nghe tiếng niệm', note: 'Dùng micro. Đang thử nghiệm, có thể đếm chưa đúng.' },
    },
    beatsTitle: 'Mấy tiếng mõ thì tính một câu?',
    beats: (n) => `${n} tiếng`,
    voiceNotes: [
      'Máy chỉ đo độ to của tiếng qua micro, ngay trên máy này. Không ghi âm, không gửi đi đâu.',
      'Xin niệm ra tiếng ở nơi yên tĩnh, nghỉ một chút giữa các câu. Thiếu thì chạm vòng tròn, dư thì bấm “Bớt một câu”. Nếu mở mõ hoặc ghi âm, xin đeo tai nghe.',
    ],
    sensitivityTitle: 'Độ nhạy của micro',
    sensitivities: { low: 'Thấp', medium: 'Vừa', high: 'Cao' },
    tempoUnknown: 'Chưa đo nhịp: mỗi hơi niệm tính một câu.',
    tempoKnown: (sec) => `Nhịp của quý vị: mỗi câu khoảng ${sec} giây.`,
    tempoMeasure: 'Đo nhịp niệm của tôi',
    tempoForget: 'Bỏ nhịp đã đo',
    tempoGuide: (phrase, n) =>
      `Xin niệm ra tiếng đúng ${n} câu “${phrase}” theo nhịp quen thuộc, rồi bấm “Niệm xong”.`,
    tempoDone: 'Niệm xong',
    tempoFailed: 'Chưa nghe rõ. Xin thử lại, niệm to hơn một chút.',
    stopTitle: 'Khi đủ giờ hoặc đủ số câu',
    stopModes: {
      auto: 'App đánh chuông và kết thúc',
      self: 'App chỉ đánh chuông, tôi tự dừng',
    },
    phraseTitle: 'Câu niệm',

    timerTitle: 'Hẹn giờ',
    timerNone: 'Tự dừng',
    timerCustom: 'Tự nhập',
    timerCustomLabel: 'Số phút',
    minutes: (n) => `${n} phút`,
    recordingTitle: 'Ghi âm niệm Phật',
    recordingNone: 'Không phát',
    recordingFailed: 'Không phát được file ghi âm này.',
  },

  schedule: {
    title: 'Thời khóa',
    names: { morning: 'Thời khóa sáng', evening: 'Thời khóa tối' },
    begin: 'Bắt đầu',
    doneToday: 'Hôm nay đã thực hành.',
    settingsLink: 'Cài đặt thời khóa',
    goalTitle: 'Niệm Phật bao lâu',
    goalMinutesText: (n) => `Niệm Phật ${n} phút`,
    goalCountText: (n) => `Niệm Phật ${n} câu`,
    goalFreeText: 'Niệm Phật, tự dừng khi muốn',
    goalByMinutes: 'Theo số phút',
    goalByCount: 'Theo số câu',
    goalFree: 'Tự dừng khi muốn',
    goalMinutes: 'Số phút',
    goalCount: 'Số câu',
    progress: (name, step, total) => `${name} – bước ${step} trên ${total}`,
    next: 'Tiếp',
    exit: 'Thoát thời khóa',
    finish: 'Hoàn mãn',
    thapNiemProgress: (done, total) => `Hôm nay: ${done} trên ${total} lần`,
  },

  reminder: {
    text: {
      morning: 'Đã đến giờ thời khóa sáng.',
      evening: 'Đã đến giờ thời khóa tối.',
    },
    open: 'Vào thời khóa',
    later: 'Để sau',
  },

  lessons: { title: 'Học' },
  calendar: { title: 'Lịch' },

  settings: {
    title: 'Cài đặt',
    done: 'Xong',
    menu: {
      practice: {
        label: 'Niệm Phật', title: 'Cài đặt niệm Phật',
        note: 'Câu niệm, cách đếm, mõ, khánh, hẹn giờ',
      },
      schedule: { label: 'Thời khóa và giờ nhắc' },
      display: { label: 'Chữ và màu nền' },
      data: { label: 'Dữ liệu của tôi', note: 'Sao lưu, khôi phục, xóa' },
    },
    fontTitle: 'Cỡ chữ',
    fontSample: 'Chữ sẽ to như dòng này.',
    fontSmaller: 'Nhỏ hơn',
    fontLarger: 'To hơn',
    themeTitle: 'Màu nền',
    themes: { light: 'Sáng', dark: 'Tối', auto: 'Theo máy' },
    themeHint: 'Nền tối dịu mắt khi niệm Phật ban đêm.',
    woodfishTitle: 'Mõ và khánh',
    woodfishModeTitle: 'Tiếng mõ',
    woodfishModes: { auto: 'App gõ mõ giữ nhịp', hand: 'Hiện nút để tự gõ mõ', off: 'Không dùng mõ' },
    chimeLabel: 'Hiện nút để tự gõ khánh',
    woodfishValue: (n) => `${n} tiếng mỗi phút`,
    woodfishSlower: 'Chậm hơn',
    woodfishFaster: 'Nhanh hơn',
    vibrateTitle: 'Rung',
    vibrateLabel: 'Rung nhẹ mỗi khi đếm',
    vibrateHint: 'Điện thoại iPhone thường không hỗ trợ rung.',
    reminderTitle: 'Giờ nhắc thời khóa',
    reminderMorning: 'Nhắc thời khóa sáng',
    reminderEvening: 'Nhắc thời khóa tối',
    reminderTime: 'Giờ',
    reminderNote:
      'App chỉ nhắc được khi đang mở hoặc còn chạy ngầm. Nếu đã đóng app, xin dùng thêm báo thức của điện thoại.',
    reminderAsk: 'Cho phép hiện thông báo',
    reminderStatus: {
      unsupported: 'Máy này không hỗ trợ thông báo. App vẫn nhắc trên màn hình khi đang mở.',
      default: 'Chưa bật thông báo. App vẫn nhắc trên màn hình khi đang mở.',
      granted: 'Đã cho phép thông báo.',
      denied:
        'Thông báo đang bị chặn trong cài đặt trình duyệt. App vẫn nhắc trên màn hình khi đang mở.',
    },
    dataTitle: 'Dữ liệu của tôi',
    dataIntro:
      'Dữ liệu chỉ nằm trên máy này. Thỉnh thoảng nên sao lưu ra file để phòng khi đổi máy hoặc mất máy.',
    sessionCount: (n) => `Đang lưu: ${n} thời niệm.`,
    backup: 'Sao lưu ra file',
    restore: 'Khôi phục từ file',
    erase: 'Xóa toàn bộ dữ liệu',
    backupDone: 'Đã tạo file sao lưu.',
    backupFilename: (date) => `niem-phat-duong-sao-luu-${date}.json`,
    restoreDone: (added, skipped) =>
      `Đã khôi phục. Thêm ${added} thời niệm.` +
      (skipped > 0 ? ` Bỏ qua ${skipped} mục bị hỏng.` : ''),
    restoreErrors: {
      'bad-json': 'File này không đọc được. Xin chọn đúng file sao lưu.',
      'not-backup': 'Đây không phải file sao lưu của Niệm Phật Đường.',
      'too-new': 'File sao lưu này từ bản app mới hơn. Xin cập nhật app rồi thử lại.',
    },
    eraseConfirmTitle: 'Xóa toàn bộ dữ liệu?',
    eraseConfirmBody:
      'Mọi thời niệm và cài đặt trên máy này sẽ bị xóa, không lấy lại được. Nếu cần, xin sao lưu ra file trước.',
    eraseConfirmYes: 'Xóa',
    eraseDone: 'Đã xóa dữ liệu.',
    moreTitle: 'Thông tin',
    about: 'Giới thiệu',
    privacy: 'Chính sách riêng tư',
    version: (v) => `Phiên bản ${v}`,
  },

  about: {
    title: 'Giới thiệu',
    purposeTitle: 'Mục đích',
    purpose: [
      'Niệm Phật Đường là app tu học Pháp môn Tịnh độ dành cho người Việt, theo giáo huấn của Pháp sư Tịnh Không.',
      'App dành cho người mới tu học, người lớn tuổi, và người thật lòng muốn tu nhưng không có điều kiện đến đạo tràng.',
    ],
    principlesTitle: 'Nguyên tắc',
    principles: [
      'Miễn phí hoàn toàn. Không quảng cáo, không bán hàng, không quyên góp.',
      'Không xếp hạng, không huy hiệu, không so sánh số câu niệm giữa người với người.',
      'Không thu thập dữ liệu cá nhân. Mọi dữ liệu chỉ lưu trên máy của quý vị, không cần đăng nhập hay tài khoản.',
      'Không chê bai pháp môn khác hay tôn giáo khác.',
      'Giao diện trang nghiêm, chữ to, dễ thao tác.',
      'Dùng được khi không có mạng.',
    ],
    draftTitle: 'Về nội dung',
    draft:
      'Nội dung nào còn ghi nhãn “CẦN THẨM ĐỊNH” là bản nháp, chưa được đối chiếu với giảng ký. Xin chỉ dùng để tham khảo.',
  },

  privacy: {
    title: 'Chính sách riêng tư',
    items: [
      {
        heading: 'Không quảng cáo, không bán dữ liệu',
        body: 'App không có quảng cáo, không theo dõi người dùng, không bán và không chia sẻ dữ liệu cho bất kỳ ai.',
      },
      {
        heading: 'Dữ liệu nằm trên máy của quý vị',
        body: 'Số câu niệm, thời khóa và cài đặt chỉ lưu trong trình duyệt hoặc app trên máy này. Bản hiện tại không gửi dữ liệu ra ngoài.',
      },
      {
        heading: 'Không hỏi thông tin cá nhân',
        body: 'App không cần tài khoản và không hỏi tên, email hay số điện thoại. Lần đầu mở, app tự tạo một mã ngẫu nhiên để phân biệt máy này với máy khác. Mã này chỉ lưu trên máy, không cho biết quý vị là ai.',
      },
      {
        heading: 'Micro',
        body: 'Micro chỉ mở khi quý vị chọn “App nghe tiếng niệm” và đang niệm, hoặc đang đo nhịp niệm. App chỉ đo độ to của tiếng ngay trên máy, không ghi âm, không lưu và không gửi âm thanh đi đâu. Khi tạm nghỉ, kết thúc hoặc chuyển sang app khác, micro được tắt.',
      },
      {
        heading: 'Sao lưu và xóa',
        body: 'Quý vị có thể sao lưu dữ liệu ra file, hoặc xóa toàn bộ dữ liệu bất cứ lúc nào trong phần Cài đặt. File sao lưu do quý vị tự giữ. Xóa dữ liệu trình duyệt cũng sẽ làm mất dữ liệu của app.',
      },
      {
        heading: 'Khi mở app qua mạng',
        body: 'App được tải về từ một dịch vụ lưu trữ trang web (ví dụ GitHub Pages). Như với mọi trang web, dịch vụ ấy có thể thấy địa chỉ mạng (IP) của máy khi tải trang. Số câu niệm và cài đặt không được gửi lên đó.',
      },
      {
        heading: 'Đường link ra ngoài',
        body: 'Một số mục “Đọc thêm” mở trang web khác. Khi đó, trang ấy áp dụng chính sách riêng của họ.',
      },
      {
        heading: 'Khi có thay đổi',
        body: 'Nếu sau này app có thêm phần đồng bộ qua mạng, trang này sẽ được cập nhật và việc đồng bộ chỉ bật khi quý vị đồng ý.',
      },
    ],
  },
};
