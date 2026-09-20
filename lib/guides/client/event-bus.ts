'use client';

import { useEffect, useRef } from 'react';
import { GUIDE_TRIGGER_EVENT } from '../shared/anchor-registry';

/**
 * guide:trigger 类型化事件总线（行为触发契约）
 *
 * 派发方只调 emitGuideTrigger（字段/枚举有编译期约束，杜绝 "click" vs "event_click" 类静默错误）；
 * 监听方只吃 GuideTriggerPayload（类型安全解包）。
 */

export const GUIDE_TRIGGER_EVENT_NAME = 'guide:trigger';

/** 行为触发负载：event 固定 event_click，target = data-guide 锚点名或拾取选择器 */
export interface GuideTriggerPayload {
  /** 固定 event_click（GUIDE_TRIGGER_EVENT） */
  event: typeof GUIDE_TRIGGER_EVENT;
  /** data-guide 锚点名 或 拾取生成的 CSS 选择器（与 event_click 条件 value 同一标识） */
  target: string;
  /** 触发时所在后台相对路径（如 /cron） */
  page: string;
  /** force：强制重新触发（无视进度抑制），无密码敏感查看引导等场景使用 */
  force?: boolean;
}

/** 派发行为触发事件（派发方唯一入口） */
export function emitGuideTrigger(payload: GuideTriggerPayload): void {
  window.dispatchEvent(
    new CustomEvent<GuideTriggerPayload>(GUIDE_TRIGGER_EVENT_NAME, {
      detail: payload,
    }),
  );
}

/** 监听行为触发事件（监听方唯一入口，类型安全解包；handler 变化不会重挂监听） */
export function useGuideTrigger(handler: (payload: GuideTriggerPayload) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const on = (e: Event) => {
      const detail = (e as CustomEvent<GuideTriggerPayload>).detail;
      if (detail && typeof detail.event === 'string' && typeof detail.target === 'string') {
        handlerRef.current(detail);
      }
    };
    window.addEventListener(GUIDE_TRIGGER_EVENT_NAME, on);
    return () => window.removeEventListener(GUIDE_TRIGGER_EVENT_NAME, on);
  }, []);
}
