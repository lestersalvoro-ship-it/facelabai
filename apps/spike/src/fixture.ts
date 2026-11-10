import { ffmpeg } from './media.ts';
import { Run } from './run.ts';

/**
 * A render test with synthetic media: colour gradients, test tones and evenly spaced caption timings.
 * It exists to test the compositor, the export and the checks without spending money.
 * It is not AI output and every frame is stamped to say so.
 */
export function makeFixture(aspect: '9:16' | '16:9' | '1:1' = '9:16'): Run {
  const lines = ['This is a render test.', 'Every picture here is a colour gradient.', 'Every voice is a test tone.', 'Nothing in this file came from an AI model.'];
  const cameras = ['push_in', 'pan_right', 'static', 'pull_out'] as const;
  const size = { '9:16': '1080x1920', '16:9': '1920x1080', '1:1': '1080x1080' }[aspect];
  const run = Run.create({
    id: `fixture-${aspect.replace(':', 'x')}`, createdAt: new Date().toISOString(), kind: 'fixture',
    brief: { idea: 'render test', category: 'test', durationSec: 12, aspect, language: 'en', style: 'none', mode: 'hybrid', tier: 'draft' },
    storyboard: {
      title: 'Render test', audience: 'developers', hook: lines[0]!, styleBlock: 'none', characters: [], musicMood: 'none',
      metadata: { title: 'Render test', description: 'Synthetic media', hashtags: [] },
      scenes: lines.map((narration, i) => ({ narration, subject: 'gradient', action: 'none', framing: 'wide', camera: cameras[i]!, lighting: 'none', characters: [], motionPrompt: 'none', keyBeat: i === 0 })),
    },
  });
  run.m.scenes = lines.map((text, i) => {
    const sec = 2.4 + i * 0.3, n = String(i + 1).padStart(2, '0');
    ffmpeg(['-f', 'lavfi', '-i', `sine=frequency=${220 + i * 110}:duration=${sec}`, '-c:a', 'libmp3lame', '-b:a', '128k', run.asset(`scene-${n}-voice.mp3`)]);
    ffmpeg(['-f', 'lavfi', '-i', `gradients=s=${size}:seed=${i + 3}:d=1`, '-frames:v', '1', run.asset(`scene-${n}-keyframe.png`)]);
    const per = (sec - 0.2) / text.length;
    const state = {
      index: i, errors: [], voiceFile: `scene-${n}-voice.mp3`, voiceSec: sec, keyframeFile: `scene-${n}-keyframe.png`, motion: 'still' as const,
      alignment: { characters: [...text], starts: [...text].map((_, k) => 0.1 + k * per), ends: [...text].map((_, k) => 0.1 + (k + 1) * per) },
    };
    if (i !== 1) return state;
    // One scene uses a moving clip so the video path is exercised too.
    ffmpeg(['-f', 'lavfi', '-i', `testsrc2=s=${size}:r=30:d=3`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', run.asset(`scene-${n}-clip.mp4`)]);
    return { ...state, clipFile: `scene-${n}-clip.mp4`, motion: 'ai_video' as const };
  });
  run.save();
  return run;
}
