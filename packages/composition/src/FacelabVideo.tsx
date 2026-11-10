import { AbsoluteFill, Audio, Img, OffthreadVideo, Series, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionChunk, CompScene, CompositionProps } from '@facelab/contracts';

export const sceneFrames = (s: CompScene, fps: number) => Math.max(1, Math.round(s.durationSec * fps));
export const totalFrames = (p: CompositionProps) => p.scenes.reduce((n, s) => n + sceneFrames(s, p.fps), 0);

/** Camera moves for still images. Each returns scale and x/y shift in percent at progress t (0 to 1). */
const MOVES: Record<CompScene['camera'], (t: number) => { scale: number; x: number; y: number }> = {
  push_in: (t) => ({ scale: 1.06 + 0.12 * t, x: 0, y: 0 }),
  pull_out: (t) => ({ scale: 1.18 - 0.12 * t, x: 0, y: 0 }),
  pan_left: (t) => ({ scale: 1.16, x: 4 - 8 * t, y: 0 }),
  pan_right: (t) => ({ scale: 1.16, x: -4 + 8 * t, y: 0 }),
  tilt_up: (t) => ({ scale: 1.16, x: 0, y: 4 - 8 * t }),
  tilt_down: (t) => ({ scale: 1.16, x: 0, y: -4 + 8 * t }),
  static: (t) => ({ scale: 1.03 + 0.02 * t, x: 0, y: 0 }),
};

const Visual = ({ scene, frames }: { scene: CompScene; frames: number }) => {
  const frame = useCurrentFrame();
  const cover = { width: '100%', height: '100%', objectFit: 'cover' as const };
  if (scene.clip) {
    // Fit the clip to the narration length, within a range that still looks natural.
    const rate = scene.clipSec ? Math.min(1.5, Math.max(0.5, scene.clipSec / scene.durationSec)) : 1;
    return <OffthreadVideo src={staticFile(scene.clip)} muted playbackRate={rate} style={cover} />;
  }
  if (!scene.image) return <AbsoluteFill style={{ background: '#111' }} />;
  const t = interpolate(frame, [0, frames], [0, 1], { extrapolateRight: 'clamp' });
  const eased = t * t * (3 - 2 * t);
  const m = MOVES[scene.camera](eased);
  return <Img src={staticFile(scene.image)} style={{ ...cover, transform: `scale(${m.scale}) translate(${m.x}%, ${m.y}%)` }} />;
};

const Captions = ({ chunks }: { chunks: CaptionChunk[] }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const now = frame / fps;
  const chunk = chunks.find((c) => now >= c.start && now < c.end + 0.12);
  if (!chunk) return null;
  const size = Math.round(width * (height > width ? 0.068 : 0.04));
  const pop = interpolate(now - chunk.start, [0, 0.1], [0.92, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * (height > width ? 0.22 : 0.1) }}>
      <div style={{
        transform: `scale(${pop})`, maxWidth: '84%', textAlign: 'center', fontFamily: 'Inter, "Helvetica Neue", Arial, sans-serif',
        fontWeight: 800, fontSize: size, lineHeight: 1.15, letterSpacing: '-0.01em', textTransform: 'uppercase',
        color: '#fff', WebkitTextStroke: `${Math.max(2, size * 0.09)}px #000`, paintOrder: 'stroke fill',
        textShadow: '0 6px 24px rgba(0,0,0,0.55)',
      }}>
        {chunk.words.map((w, i) => (
          <span key={i} style={{ color: now >= w.start && now < w.end + 0.05 ? '#FFD84D' : '#fff' }}>{w.text}{i < chunk.words.length - 1 ? ' ' : ''}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Scene = ({ scene, frames }: { scene: CompScene; frames: number }) => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ opacity: fade, overflow: 'hidden' }}><Visual scene={scene} frames={frames} /></AbsoluteFill>
      {scene.voice ? <Audio src={staticFile(scene.voice)} /> : null}
      <Captions chunks={scene.captions} />
    </AbsoluteFill>
  );
};

export const FacelabVideo = (props: CompositionProps) => {
  const total = totalFrames(props);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Series>
        {props.scenes.map((s, i) => {
          const frames = sceneFrames(s, props.fps);
          return <Series.Sequence key={i} durationInFrames={frames}><Scene scene={s} frames={frames} /></Series.Sequence>;
        })}
      </Series>
      {props.music ? (
        <Audio src={staticFile(props.music.src)} loop
          volume={(f) => props.music!.volume * interpolate(f, [0, 15, total - 30, total], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      ) : null}
      {props.watermark ? (
        <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 48 }}>
          <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 30, color: '#fff', background: 'rgba(200,0,0,0.85)', padding: '8px 18px' }}>{props.watermark}</div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
