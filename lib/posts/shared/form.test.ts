import { describe, it, expect } from 'vitest';
import { emptyForm, buildPostPayload, validatePostForm } from '@/lib/posts/shared';
import { PostStatus } from '@/lib/types/posts';

describe('validatePostForm', () => {
  it('标题必填', () => {
    expect(validatePostForm(emptyForm)).toBe('标题必填');
    expect(validatePostForm({ ...emptyForm, title: '  ' })).toBe('标题必填');
  });

  it('标题有值通过', () => {
    expect(validatePostForm({ ...emptyForm, title: '你好' })).toBeNull();
  });
});

describe('buildPostPayload', () => {
  it('scheduledAt 空串 → null', () => {
    const payload = buildPostPayload(emptyForm, true);
    expect(payload.scheduledAt).toBeNull();
  });

  it('新建：内容留空也传 content', () => {
    const payload = buildPostPayload(emptyForm, true);
    expect('content' in payload).toBe(true);
  });

  it('编辑：内容留空 → 不传 content（服务端保持原值）', () => {
    const payload = buildPostPayload(emptyForm, false);
    expect('content' in payload).toBe(false);
  });

  it('编辑：有内容 → 传 content', () => {
    const payload = buildPostPayload({ ...emptyForm, content: '# hi' }, false);
    expect(payload.content).toBe('# hi');
  });

  it('状态/标签原样透传', () => {
    const payload = buildPostPayload(
      { ...emptyForm, status: PostStatus.PUBLISHED, tags: ['a', 'b'] },
      true,
    );
    expect(payload.status).toBe(PostStatus.PUBLISHED);
    expect(payload.tags).toEqual(['a', 'b']);
  });
});
