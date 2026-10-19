import React from 'react';
import { Sequence, useCurrentFrame } from 'remotion';
import { BrowserFrame } from '../components/BrowserFrame';
import { StepIndicator } from '../components/StepIndicator';
import { IntroScene } from '../scenes/IntroScene';
import { RealStep1ListScene } from '../scenes/RealStep1ListScene';
import { RealStep2CustomerScene } from '../scenes/RealStep2CustomerScene';
import { RealStep3ProductScene } from '../scenes/RealStep3ProductScene';
import { RealStep4ConfirmScene } from '../scenes/RealStep4ConfirmScene';
import { OutroScene } from '../scenes/OutroScene';

export const OrderTutorial: React.FC = () => {
  const frame = useCurrentFrame();

  // Durations (in frames at 30 fps) -> Total = 1290 frames (43 seconds)
  const INTRO_DURATION = 120; // 4.0s (0..120)
  const STEP1_DURATION = 150; // 5.0s (120..270)
  const STEP2_DURATION = 300; // 10.0s (270..570)
  const STEP3_DURATION = 345; // 11.5s (570..915)
  const STEP4_DURATION = 210; // 7.0s (915..1125)
  const OUTRO_DURATION = 165; // 5.5s (1125..1290)

  const step1Start = INTRO_DURATION;
  const step2Start = step1Start + STEP1_DURATION;
  const step3Start = step2Start + STEP2_DURATION;
  const step4Start = step3Start + STEP3_DURATION;
  const outroStart = step4Start + STEP4_DURATION;

  let currentStep = 1;
  if (frame >= step4Start) {
    currentStep = 4;
  } else if (frame >= step3Start) {
    currentStep = 3;
  } else if (frame >= step2Start) {
    currentStep = 2;
  } else if (frame >= step1Start) {
    currentStep = 1;
  }

  const isInsideBrowser = frame >= step1Start && frame < outroStart;

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        backgroundColor: '#05080F',
        backgroundImage:
          'radial-gradient(circle at 50% 0%, rgba(14, 165, 233, 0.14) 0%, rgba(136, 19, 55, 0.12) 45%, rgba(5, 8, 15, 1) 80%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Intro Scene */}
      <Sequence from={0} durationInFrames={INTRO_DURATION}>
        <IntroScene />
      </Sequence>

      {/* Interactive Real Screens (Steps 1 to 4) wrapped in exact 1600x940 BrowserFrame + external StepIndicator */}
      {isInsideBrowser && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            zIndex: 10,
          }}
        >
          <BrowserFrame>
            <Sequence from={step1Start} durationInFrames={STEP1_DURATION}>
              <RealStep1ListScene />
            </Sequence>

            <Sequence from={step2Start} durationInFrames={STEP2_DURATION}>
              <RealStep2CustomerScene />
            </Sequence>

            <Sequence from={step3Start} durationInFrames={STEP3_DURATION}>
              <RealStep3ProductScene />
            </Sequence>

            <Sequence from={step4Start} durationInFrames={STEP4_DURATION}>
              <RealStep4ConfirmScene />
            </Sequence>
          </BrowserFrame>

          {/* External Step Dock below BrowserFrame — never covers any part of the 1600x900 ERP viewport */}
          <StepIndicator currentStep={currentStep} />
        </div>
      )}

      {/* Outro Scene */}
      <Sequence from={outroStart} durationInFrames={OUTRO_DURATION}>
        <OutroScene />
      </Sequence>
    </div>
  );
};
