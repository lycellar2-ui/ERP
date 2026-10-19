import React from 'react';

interface StepIndicatorProps {
  currentStep: number;
}

const STEPS = [
  { step: 1, title: 'Mở Tạo Đơn Hàng' },
  { step: 2, title: 'Chọn Khách Hàng & Tín Dụng' },
  { step: 3, title: 'Thêm Rượu Vang & Giá Kênh' },
  { step: 4, title: 'Kiểm Tra VAT & Hoàn Tất Đơn' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  return (
    <div
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 999,
        padding: '8px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        zIndex: 60,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
      }}
    >
      {STEPS.map((s, idx) => {
        const isActive = s.step === currentStep;
        const isDone = s.step < currentStep;

        return (
          <div
            key={s.step}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              opacity: isActive ? 1 : isDone ? 0.82 : 0.42,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: isActive
                  ? '#0891B2'
                  : isDone
                  ? '#059669'
                  : 'rgba(255, 255, 255, 0.1)',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isActive ? '0 0 12px rgba(8, 145, 178, 0.6)' : 'none',
              }}
            >
              {isDone ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                s.step
              )}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#F8FAFC' : '#94A3B8',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
              }}
            >
              {s.title}
            </span>

            {idx < STEPS.length - 1 && (
              <div
                style={{
                  width: 22,
                  height: 1.5,
                  backgroundColor: isDone ? 'rgba(16, 185, 129, 0.45)' : 'rgba(255, 255, 255, 0.12)',
                  marginLeft: 6,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
