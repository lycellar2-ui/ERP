import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterLeft = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 90 },
  });

  const enterRight = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const stepsOpacity = interpolate(frame, [22, 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#070B12',
        backgroundImage:
          'radial-gradient(circle at 18% 22%, rgba(8, 145, 178, 0.18) 0%, rgba(7, 11, 18, 0) 55%), radial-gradient(circle at 82% 75%, rgba(16, 185, 129, 0.12) 0%, rgba(7, 11, 18, 0) 55%)',
        display: 'grid',
        gridTemplateColumns: '1.05fr 1.15fr',
        alignItems: 'center',
        padding: '0 96px',
        gap: 64,
        boxSizing: 'border-box',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left Column: Brand & Editorial Headline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          opacity: enterLeft,
          transform: `translateY(${(1 - enterLeft) * 24}px)`,
          zIndex: 10,
        }}
      >
        {/* Official LY's Cellars Logo */}
        <Img
          src={staticFile('logo-white.png')}
          style={{
            height: 54,
            width: 'auto',
            objectFit: 'contain',
            marginBottom: 28,
          }}
        />

        {/* Module Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(8, 145, 178, 0.14)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 6,
            padding: '6px 14px',
            color: '#38BDF8',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          <span>PHÂN HỆ BÁN HÀNG & PHÂN PHỐI · SLS</span>
        </div>

        {/* Main Title */}
        <h1
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: '#F8FAFC',
            margin: '0 0 18px 0',
            lineHeight: '62px',
            letterSpacing: '-0.025em',
          }}
        >
          Hướng Dẫn Lên Đơn
          <br />
          <span style={{ color: '#38BDF8' }}>Bán Hàng (Sales Order)</span>
        </h1>

        <p
          style={{
            fontSize: 17,
            lineHeight: '27px',
            color: '#94A3B8',
            margin: '0 0 34px 0',
            maxWidth: 580,
          }}
        >
          Quy trình chuẩn hóa 4 bước trên hệ thống Wine ERP: từ kiểm tra hạn mức tín dụng khách hàng, tự động áp giá kênh HORECA đến đối chiếu tồn kho theo pháp nhân.
        </p>

        {/* 4 Step Summary Pills */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            width: '100%',
            opacity: stepsOpacity,
          }}
        >
          {[
            { num: '01', text: 'Mở ngăn kéo Tạo Đơn Hàng' },
            { num: '02', text: 'Chọn KH & Kiểm tra công nợ' },
            { num: '03', text: 'Thêm rượu & Tự động tính giá' },
            { num: '04', text: 'Kiểm tra VAT & Xác nhận đơn' },
          ].map((item) => (
            <div
              key={item.num}
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.72)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#0891B2',
                  backgroundColor: 'rgba(8, 145, 178, 0.15)',
                  padding: '4px 8px',
                  borderRadius: 6,
                }}
              >
                {item.num}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: '#E2E8F0' }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Live UI Preview Window */}
      <div
        style={{
          position: 'relative',
          opacity: enterRight,
          transform: `translateX(${(1 - enterRight) * 40}px) scale(${0.94 + 0.06 * enterRight})`,
        }}
      >
        <div
          style={{
            borderRadius: 14,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(8, 145, 178, 0.2)',
            backgroundColor: '#0F172A',
          }}
        >
          <div
            style={{
              height: 30,
              backgroundColor: '#1E293B',
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              gap: 6,
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#F59E0B' }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8' }}>
              erp.lyscellars.vn/dashboard/sales
            </span>
          </div>
          <Img
            src={staticFile('step4b-order-summary.png')}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  );
};
