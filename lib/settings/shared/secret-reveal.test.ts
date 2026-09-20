import { describe, it, expect } from 'vitest';
import { secretRevealReducer, SECRET_REVEAL_SECONDS } from '../shared/secret-reveal';

describe('secretRevealReducer', () => {
  it('reveal：设置明文并重置倒计时为 30 秒', () => {
    const s = secretRevealReducer(null, {
      type: 'reveal',
      key: 'cron.secret',
      value: 'abc123',
    });
    expect(s).toEqual({
      key: 'cron.secret',
      value: 'abc123',
      countdown: SECRET_REVEAL_SECONDS,
    });
  });

  it('tick：倒计时递减', () => {
    const s = secretRevealReducer(
      { key: 'cron.secret', value: 'abc', countdown: 30 },
      { type: 'tick' },
    );
    expect(s?.countdown).toBe(29);
    expect(s?.value).toBe('abc');
  });

  it('tick 到 1 → 归零自动隐藏', () => {
    const s = secretRevealReducer(
      { key: 'cron.secret', value: 'abc', countdown: 1 },
      { type: 'tick' },
    );
    expect(s).toBeNull();
  });

  it('tick 在空状态 → 保持 null', () => {
    expect(secretRevealReducer(null, { type: 'tick' })).toBeNull();
  });

  it('hide：手动隐藏', () => {
    const s = secretRevealReducer(
      { key: 'cron.secret', value: 'abc', countdown: 20 },
      { type: 'hide' },
    );
    expect(s).toBeNull();
  });

  it('再次 reveal 重置倒计时（连续查看两个密钥互不干扰）', () => {
    const a = secretRevealReducer(
      { key: 'cron.secret', value: 's1', countdown: 5 },
      { type: 'reveal', key: 'cron.jobApiKey', value: 's2' },
    );
    expect(a).toEqual({
      key: 'cron.jobApiKey',
      value: 's2',
      countdown: SECRET_REVEAL_SECONDS,
    });
  });
});
