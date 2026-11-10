import { Composition } from 'remotion';
import type { CompositionProps } from '@facelab/contracts';
import { FacelabVideo, totalFrames } from './FacelabVideo.tsx';

const empty: CompositionProps = { fps: 30, width: 1080, height: 1920, scenes: [] };

export const Root = () => (
  <Composition
    id="FacelabVideo"
    component={FacelabVideo as never}
    defaultProps={empty as never}
    fps={30} width={1080} height={1920} durationInFrames={30}
    calculateMetadata={({ props }) => {
      const p = props as unknown as CompositionProps;
      return { fps: p.fps, width: p.width, height: p.height, durationInFrames: Math.max(1, totalFrames(p)) };
    }}
  />
);
