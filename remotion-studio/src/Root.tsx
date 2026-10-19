import React from 'react';
import { Composition } from 'remotion';
import { OrderTutorial } from './OrderTutorial';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="OrderTutorial"
        component={OrderTutorial}
        durationInFrames={1290}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
