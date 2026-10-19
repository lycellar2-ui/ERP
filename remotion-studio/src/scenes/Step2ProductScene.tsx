import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { MouseCursor } from '../components/MouseCursor';
import { CalloutCard } from '../components/CalloutCard';

export const Step2ProductScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mouse trajectory: clicks "+" button to add second wine item
  const cursorX = interpolate(frame, [10, 50, 90, 140], [800, 750, 480, 520], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cursorY = interpolate(frame, [10, 50, 90, 140], [600, 140, 360, 360], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isClicked = (frame >= 50 && frame <= 60) || (frame >= 140 && frame <= 150);
  const showSecondItem = frame >= 65;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0F172A',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <CalloutCard
        stepNumber={2}
        title="Chọn Rượu Vang & Giải Quyết Giá Tự Động"
        description="Quy tắc định giá tự động ưu tiên: Giá Chiến Dịch > Bảng Giá Cố Định > Bảng Giá Kênh HORECA. Tồn kho thực tế được xác minh ngay tại dòng sản phẩm."
      />

      <div style={{ padding: '24px 32px', boxSizing: 'border-box' }}>
        {/* Section Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>
              Danh Sách Rượu Vang Đặt Hàng (2 dòng sản phẩm)
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748B' }}>
              Khách hàng: Khách sạn Daewoo Hà Nội · Áp dụng bảng giá Kênh HORECA
            </p>
          </div>
          <div
            style={{
              backgroundColor: '#0891B2',
              color: '#FFFFFF',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              boxShadow: isClicked && frame < 70 ? '0 0 0 3px rgba(8, 145, 178, 0.4)' : 'none',
              transition: 'all 0.1s ease',
            }}
          >
            + Thêm Sản Phẩm Mới
          </div>
        </div>

        {/* Product Table */}
        <div
          style={{
            backgroundColor: '#1E293B',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '3fr 1fr 1fr 1.5fr 1.5fr',
              padding: '12px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: 12,
              fontWeight: 600,
              color: '#94A3B8',
              letterSpacing: '0.04em',
            }}
          >
            <div>SẢN PHẨM / NIÊN VỤ</div>
            <div>QUY CÁCH</div>
            <div>SỐ LƯỢNG</div>
            <div>ĐƠN GIÁ ÁP DỤNG</div>
            <div style={{ textAlign: 'right' }}>THÀNH TIỀN</div>
          </div>

          {/* Row 1: Château Margaux */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '3fr 1fr 1fr 1.5fr 1.5fr',
              padding: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              alignItems: 'center',
              fontSize: 13,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: '#F8FAFC', fontSize: 14 }}>
                Château Margaux Premier Grand Cru Classé 2015
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                Mã: MARG-2015-750 · Pháp · Tồn kho: <span style={{ color: '#10B981', fontWeight: 600 }}>48 chai</span> (Kho Tổng)
              </div>
            </div>

            <div>
              <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)', padding: '4px 8px', borderRadius: 4, color: '#CBD5E1', fontSize: 12 }}>
                Thùng (6 chai)
              </span>
            </div>

            <div style={{ fontWeight: 600, color: '#F8FAFC' }}>
              2 Thùng (12 chai)
            </div>

            <div>
              <div style={{ fontWeight: 600, color: '#F8FAFC' }}>16,650,000 đ</div>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 10,
                  backgroundColor: 'rgba(8, 145, 178, 0.15)',
                  color: '#0891B2',
                  border: '1px solid rgba(8, 145, 178, 0.3)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  marginTop: 2,
                }}
              >
                Giá Kênh HORECA (-10%)
              </span>
            </div>

            <div style={{ textAlign: 'right', fontWeight: 700, color: '#F8FAFC', fontSize: 14 }}>
              199,800,000 đ
            </div>
          </div>

          {/* Row 2: Sassicaia 2019 (appears with spring animation) */}
          {showSecondItem && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '3fr 1fr 1fr 1.5fr 1.5fr',
                padding: '16px',
                alignItems: 'center',
                fontSize: 13,
                backgroundColor: 'rgba(8, 145, 178, 0.04)',
                opacity: interpolate(frame, [65, 75], [0, 1]),
                transform: `translateY(${interpolate(frame, [65, 75], [10, 0])}px)`,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: '#F8FAFC', fontSize: 14 }}>
                  Tenuta San Guido Sassicaia Bolgheri 2019
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                  Mã: SASS-2019-750 · Ý · Tồn kho: <span style={{ color: '#10B981', fontWeight: 600 }}>24 chai</span> (Kho Tổng)
                </div>
              </div>

              <div>
                <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)', padding: '4px 8px', borderRadius: 4, color: '#CBD5E1', fontSize: 12 }}>
                  Chai lẻ
                </span>
              </div>

              <div style={{ fontWeight: 600, color: '#F8FAFC' }}>
                6 Chai
              </div>

              <div>
                <div style={{ fontWeight: 600, color: '#F8FAFC' }}>6,840,000 đ</div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 10,
                    backgroundColor: 'rgba(180, 83, 9, 0.15)',
                    color: '#D97706',
                    border: '1px solid rgba(180, 83, 9, 0.3)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    marginTop: 2,
                  }}
                >
                  Chiết Khấu Bậc (-5%)
                </span>
              </div>

              <div style={{ textAlign: 'right', fontWeight: 700, color: '#F8FAFC', fontSize: 14 }}>
                41,040,000 đ
              </div>
            </div>
          )}
        </div>
      </div>

      <MouseCursor x={cursorX} y={cursorY} isClicked={isClicked} />
    </div>
  );
};
