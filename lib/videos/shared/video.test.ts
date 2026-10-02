import { describe, expect, it } from 'vitest';
import {
  getAspectRatio,
  isValidVideoMimeType,
  isValidVideoStatus,
  isValidVideoVisibility,
  defaultVideoTitle,
  formatDuration,
} from './video';

describe('getAspectRatio（瀑布流卡片比例）', () => {
  it('宽高齐全时返回原始比例', () => {
    expect(getAspectRatio(1920, 1080)).toBe('1920/1080');
    expect(getAspectRatio(1080, 1920)).toBe('1080/1920');
  });

  it('宽高缺失时统一回退 9/16（竖屏为主，默认 portrait）', () => {
    expect(getAspectRatio(null, null)).toBe('9/16');
    expect(getAspectRatio(undefined, undefined)).toBe('9/16');
    expect(getAspectRatio(0, 0)).toBe('9/16');
  });

  it('landscape 回退 16/9（显式指定）', () => {
    expect(getAspectRatio(null, null, 'landscape')).toBe('16/9');
  });

  it('只缺一边也忽略该边，回退 9/16', () => {
    expect(getAspectRatio(1920, null)).toBe('9/16');
    expect(getAspectRatio(null, 1920)).toBe('9/16');
    expect(getAspectRatio(1920, null, 'landscape')).toBe('16/9');
  });
});

describe('isValidVideoMimeType', () => {
  it('接受 mp4/webm', () => {
    expect(isValidVideoMimeType('video/mp4')).toBe(true);
    expect(isValidVideoMimeType('video/webm')).toBe(true);
  });

  it('拒绝其他类型', () => {
    expect(isValidVideoMimeType('image/jpeg')).toBe(false);
    expect(isValidVideoMimeType('video/avi')).toBe(false);
    expect(isValidVideoMimeType(null)).toBe(false);
    expect(isValidVideoMimeType(undefined)).toBe(false);
  });
});

describe('枚举校验', () => {
  it('video status 只认 DRAFT/PUBLISHED/ARCHIVED', () => {
    expect(isValidVideoStatus('PUBLISHED')).toBe(true);
    expect(isValidVideoStatus('DRAFT')).toBe(true);
    expect(isValidVideoStatus('ARCHIVED')).toBe(true);
    expect(isValidVideoStatus('published')).toBe(false);
    expect(isValidVideoStatus('DELETED')).toBe(false);
    expect(isValidVideoStatus(null)).toBe(false);
  });

  it('video visibility 只认 PUBLIC/PRIVATE', () => {
    expect(isValidVideoVisibility('PUBLIC')).toBe(true);
    expect(isValidVideoVisibility('PRIVATE')).toBe(true);
    expect(isValidVideoVisibility('public')).toBe(false);
    expect(isValidVideoVisibility('FRIENDS')).toBe(false);
  });
});

describe('defaultVideoTitle', () => {
  it('去掉扩展名', () => {
    expect(defaultVideoTitle('周末骑行.mp4')).toBe('周末骑行');
    expect(defaultVideoTitle('video.webm')).toBe('video');
  });

  it('空文件名兜底', () => {
    expect(defaultVideoTitle('.mp4')).toBe('未命名视频');
    expect(defaultVideoTitle('   ')).toBe('未命名视频');
  });
});

describe('formatDuration', () => {
  it('不足 1 小时 mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('超过 1 小时 h:mm:ss', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(7325)).toBe('2:02:05');
  });

  it('非法值兜底', () => {
    expect(formatDuration(null)).toBe('00:00');
    expect(formatDuration(undefined)).toBe('00:00');
    expect(formatDuration(-1)).toBe('00:00');
    expect(formatDuration(Number.NaN)).toBe('00:00');
  });
});
