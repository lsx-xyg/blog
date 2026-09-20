'use client';

/**
 * 引导锚点拾取层：URL 带 ?guide-pick=1 时激活
 * - 全屏穿透遮罩（pointer-events: none），hover 高亮当前元素，点击生成选择器
 * - 选中后展示预览：复制选择器 / 复制 JSON（含 selectorMeta，可直接粘贴进引导步骤）
 * - 高亮框跟随滚动 / resize；Esc 取消
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { generateSelector, type GeneratedSelector } from '@/lib/guides/client';

type Picked = GeneratedSelector & {
  tag: string;
  text: string;
};

/**
 * 拾取目标提升：命中叶子元素（图标/文字/内联样式节点）时，
 * 向上找最近的「可识别/交互」祖先（button/a/input/select/textarea/label/summary，
 * 或含 id/aria-label/data-guide 的元素），避免生成 svg/span 这类不稳定选择器。
 */
function resolvePickTarget(el: Element): Element {
  const INTERACTIVE = ['button', 'a', 'input', 'select', 'textarea', 'label', 'summary'];
  const tag = el.tagName.toLowerCase();
  if (
    INTERACTIVE.includes(tag) ||
    el.id ||
    el.getAttribute('aria-label') ||
    el.getAttribute('data-guide')
  ) {
    return el;
  }
  let cur = el.parentElement;
  let depth = 0;
  while (cur && cur !== document.body && depth < 5) {
    const t = cur.tagName.toLowerCase();
    if (
      INTERACTIVE.includes(t) ||
      cur.id ||
      cur.getAttribute('aria-label') ||
      cur.getAttribute('data-guide')
    ) {
      return cur;
    }
    cur = cur.parentElement;
    depth++;
  }
  return el;
}

function Box({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <div
      className="pointer-events-none absolute rounded-md border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.15)] transition-[left,top,width,height] duration-75"
      style={{ left: x, top: y, width: w, height: h }}
    />
  );
}

export default function GuidePicker() {
  const [active, setActive] = useState(false);
  const [hoverEl, setHoverEl] = useState<Element | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [copied, setCopied] = useState<'sel' | 'json' | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [saveCreated, setSaveCreated] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  // 回填目标：?guide-pick=1&guide_id=xxx&step_id=yyy（步骤锚点）
  //           或 ?guide-pick=1&guide_id=xxx&cond_idx=N（触发条件 event_click）
  const backfill = useRef<{
    guideId: string;
    stepId?: string;
    conditionIndex?: number;
  } | null>(null);

  const exit = useCallback(() => {
    setActive(false);
    setPicked(null);
    setHoverEl(null);
    setBox(null);
    document.body.style.cursor = '';
  }, []);

  // 激活：URL 参数 guide-pick=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('guide-pick') === '1') {
      const guideId = params.get('guide_id');
      const stepId = params.get('step_id');
      const condIdx = params.get('cond_idx');
      if (guideId && stepId) {
        backfill.current = { guideId, stepId };
      } else if (guideId && condIdx !== null) {
        backfill.current = { guideId, conditionIndex: Number(condIdx) };
      }
      setActive(true);
      document.body.style.cursor = 'crosshair';
    }
    return () => {
      document.body.style.cursor = '';
    };
  }, []);

  // Esc 取消
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, exit]);

  // hover 高亮：mousemove 找目标元素（穿透遮罩）
  useEffect(() => {
    if (!active || picked) return;
    const onMove = (e: MouseEvent) => {
      const raw = document.elementFromPoint(e.clientX, e.clientY);
      if (!raw || raw === overlayRef.current || overlayRef.current?.contains(raw)) return;
      const el = resolvePickTarget(raw);
      setHoverEl(el);
      const r = el.getBoundingClientRect();
      setBox({ x: r.x, y: r.y, w: r.width, h: r.height });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [active, picked]);

  // 点击选中：捕获阶段拦截，阻止页面元素自身行为（如链接跳转）
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      if (picked) return;
      e.preventDefault();
      e.stopPropagation();
      const raw = document.elementFromPoint(e.clientX, e.clientY);
      if (!raw || raw === overlayRef.current || overlayRef.current?.contains(raw)) return;
      const el = resolvePickTarget(raw);
      const g = generateSelector(el);
      if (!g) return;
      setPicked({
        ...g,
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30),
      });
      setCopied(null);
      setSaveCreated(false);
      // 就地保存：回填到引导步骤 或 触发条件（event_click）
      const target = backfill.current;
      if (target) {
        setSaveState('saving');
        const isTrigger = target.stepId === undefined && target.conditionIndex !== undefined;
        const url = isTrigger
          ? `/api/admin/guides/${target.guideId}/trigger-selector`
          : `/api/admin/guides/${target.guideId}/step-selector`;
        const payload = isTrigger
          ? { conditionIndex: target.conditionIndex, value: g.selector }
          : {
              stepId: target.stepId,
              selector: g.selector,
              selectorMeta: { source: g.source, generatedAt: new Date().toISOString() },
            };
        fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || '保存失败');
            setSaveState('saved');
            // 草稿阶段步骤未持久化 → 后端自动创建占位步骤，返回 created
            if (data.created) setSaveCreated(true);
          })
          .catch((err: unknown) => {
            console.error('回填选择器失败：', err);
            setSaveState('error');
            setSaveError(err instanceof Error ? err.message : '保存失败');
          });
      }
    };
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, [active, picked]);

  // 高亮框跟随滚动 / resize
  useEffect(() => {
    if (!active || !hoverEl || picked) return;
    const update = () => {
      const r = hoverEl.getBoundingClientRect();
      setBox({ x: r.x, y: r.y, w: r.width, h: r.height });
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [active, hoverEl, picked]);

  if (!active) return null;

  const copy = async (text: string, kind: 'sel' | 'json') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[10000]"
      style={{ pointerEvents: 'none' }}
      aria-hidden
    >
      {/* hover 高亮 */}
      {box && !picked && <Box {...box} />}

      {/* 顶部提示 */}
      {!picked && (
        <div className="pointer-events-none fixed top-4 left-1/2 z-[10001] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          {backfill.current
            ? backfill.current.stepId === undefined && backfill.current.conditionIndex !== undefined
              ? '点击目标元素，将保存为「用户点击该元素触发」条件 · Esc 取消'
              : '点击目标元素，选择器将自动保存回引导步骤 · Esc 取消'
            : '点击元素生成引导锚点选择器 · Esc 取消'}
        </div>
      )}

      {/* 选中预览 */}
      {picked && (
        <div
          className="pointer-events-auto fixed bottom-6 left-1/2 z-[10001] w-[min(92vw,560px)] -translate-x-1/2 rounded-xl border border-border bg-card p-4 shadow-2xl"
          role="dialog"
          aria-label="选择器预览"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                已选择 <span className="font-mono text-primary">&lt;{picked.tag}&gt;</span>
                {picked.text ? (
                  <span className="ml-1 text-muted-foreground">「{picked.text}」</span>
                ) : null}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {picked.selector}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                来源：
                <span className="font-medium">
                  {picked.source === 'id'
                    ? '唯一 id'
                    : picked.source === 'semantic'
                      ? '语义属性'
                      : picked.source === 'class'
                        ? '类名组合'
                        : '类路径兜底'}
                </span>
                <span className="mx-1">·</span>
                已校验页面唯一
              </p>
              {backfill.current && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs">
                  {saveState === 'saving' && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                      保存到引导中…
                    </span>
                  )}
                  {saveState === 'saved' && (
                    <span className="text-green-600 dark:text-green-400">
                      {backfill.current?.stepId === undefined &&
                      backfill.current?.conditionIndex !== undefined
                        ? '已保存 ✓（触发条件已更新，返回配置页刷新即可看到）'
                        : saveCreated
                          ? '已保存 ✓（该步骤在草稿中尚未存在，已自动创建，返回配置页补全标题/内容即可发布）'
                          : '已保存到引导步骤 ✓ 返回配置页刷新即可看到'}
                    </span>
                  )}
                  {saveState === 'error' && (
                    <span className="text-red-600 dark:text-red-400">
                      保存失败：{saveError}（可用下方按钮复制后手动粘贴）
                    </span>
                  )}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={exit}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="完成"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copy(picked.selector, 'sel')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
            >
              {copied === 'sel' ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              复制选择器
            </button>
            <button
              type="button"
              onClick={() =>
                void copy(
                  JSON.stringify(
                    {
                      selector: picked.selector,
                      selectorMeta: {
                        source: picked.source,
                        generatedAt: new Date().toISOString(),
                      },
                    },
                    null,
                    2,
                  ),
                  'json',
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
            >
              {copied === 'json' ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              复制 JSON（粘贴进引导步骤）
            </button>
            <button
              type="button"
              onClick={() => {
                setPicked(null);
                setHoverEl(null);
                setBox(null);
              }}
              className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              继续拾取
            </button>
          </div>

          {!backfill.current && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              使用：在引导配置页对应步骤的「target」留空不填（或填 data-guide 锚点），把上面 JSON 的
              selector / selectorMeta 填入步骤字段即可。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

import { Check, Copy, X } from 'lucide-react';
