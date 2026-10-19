import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 80 },
  });

  const cardsOpacity = interpolate(frame, [20, 42], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#05080F',
        backgroundImage:
          'radial-gradient(circle at 50% 35%, rgba(14, 165, 233, 0.14) 0%, rgba(136, 19, 55, 0.18) 45%, rgba(5, 8, 15, 1) 80%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
        padding: '0 80px',
        boxSizing: 'border-box',
      }}
    >
      {/* Official Brand Logo */}
      <Img
        src={staticFile('logo-white.png')}
        style={{
          height: 54,
          width: 'auto',
          objectFit: 'contain',
          marginBottom: 24,
          opacity: titleProgress,
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'rgba(16, 185, 129, 0.14)',
          border: '1px solid rgba(16, 185, 129, 0.38)',
          borderRadius: 999,
          padding: '7px 18px',
          color: '#34D399',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 18,
          opacity: titleProgress,
        }}
      >
        <span>HOÀN TẤT QUY TRÌNH LÊN ĐƠN BÁN HÀNG</span>
      </div>

      <h2
        style={{
          fontSize: 44,
          fontWeight: 800,
          color: '#F8FAFC',
          margin: '0 0 14px 0',
          textAlign: 'center',
          letterSpacing: '-0.02em',
          opacity: titleProgress,
          transform: `translateY(${interpolate(titleProgress, [0, 1], [16, 0])}px)`,
        }}
      >
        3 Nguyên Tắc Cốt Lõi Khi Lên Đơn Hàng (SO)
      </h2>

      <p
        style={{
          fontSize: 16,
          color: '#94A3B8',
          margin: '0 0 44px 0',
          textAlign: 'center',
          maxWidth: 720,
          lineHeight: '26px',
        }}
      >
        Đảm bảo tính chính xác tuyệt đối từ khâu kiểm soát công nợ khách hàng đến định giá theo kênh phân phối và điều phối xuất kho chuẩn rượu vang.
      </p>

      {/* 3 Golden rules */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 24,
          maxWidth: 1280,
          width: '100%',
          opacity: cardsOpacity,
          transform: `translateY(${interpolate(frame, [20, 42], [20, 0], { extrapolateRight: 'clamp' })}px)`,
        }}
      >
        {[
          {
            num: '01',
            tag: 'FINANCE & AR CONTROL',
            title: 'Kiểm Soát Hạn Mức Tín Dụng',
            desc: 'Hệ thống tự động đối chiếu Hạn mức tín dụng và Công nợ AR hiện tại; chặn xuất hàng khi khách hàng đang vượt hạn mức cho phép.',
          },
          {
            num: '02',
            tag: 'CHANNEL PRICING',
            title: 'Định Giá Chuẩn Theo Kênh',
            desc: 'Đơn giá bán được tự động áp theo Kênh phân phối (HORECA / Đại lý / VIP) kèm kiểm tra tồn kho khả dụng theo thời gian thực.',
          },
          {
            num: '03',
            tag: 'APPROVAL & WMS SYNC',
            title: 'Phê Duyệt & Giữ Chỗ Kho',
            desc: 'Đơn hàng chiết khấu cao tự động chuyển sang quy trình duyệt; ngay khi xác nhận, tồn kho được giữ chỗ để chuẩn bị Lệnh xuất kho.',
          },
        ].map((item, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: 'rgba(15, 25, 38, 0.88)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderTop: '3px solid #0EA5E9',
              borderRadius: 14,
              padding: '28px 26px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#38BDF8',
                  fontFamily: 'monospace',
                }}
              >
                {item.num}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: '#94A3B8',
                  letterSpacing: '0.08em',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  padding: '4px 10px',
                  borderRadius: 6,
                }}
              >
                {item.tag}
              </span>
            </div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 700,
                color: '#F8FAFC',
                marginBottom: 10,
              }}
            >
              {item.title}
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: '22px',
                color: '#94A3B8',
              }}
            >
              {item.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
