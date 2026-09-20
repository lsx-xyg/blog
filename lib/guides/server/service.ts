/**
 * 引导配置服务层（C9：guides 路由薄壳化）。
 *
 * 路由层只做「鉴权 + 解析参数 + 调 service + 响应」：
 * - guides/route.ts       → parseGuideInput / listGuides / createGuide
 * - guides/[id]/route.ts  → parseGuidePatch / updateGuide / deleteGuideById
 * - guides/progress/route.ts → parseProgressInput / getProgress / upsertProgress / deleteProgress
 *
 * 校验/归一化是纯函数（可单测），db 封装集中 upsert/唯一性分支逻辑。
 */
import { desc, eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { guiders, userGuideProgress } from '@/db/schema';
import {
  GuideStatus,
  GuideProgressStatus,
  GUIDE_PROGRESS_STATUS_VALUES,
  isValidTargetCondition,
} from '@/lib/types/guides';
import type { GuideStep, GuideTargetCondition } from '@/lib/types/guides';

/* ---------------- 纯校验 / 归一化 ---------------- */

export type GuideInput = {
  guideKey: string;
  title: string;
  page: string;
  steps: GuideStep[];
  status: GuideStatus;
  targetCondition: GuideTargetCondition | null;
  priority: number;
};

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** steps 每项结构校验（id/target/title/content 字符串） */
export function isValidStepList(steps: unknown): steps is GuideStep[] {
  if (!Array.isArray(steps)) return false;
  return steps.every(
    (s) =>
      typeof s.id === 'string' &&
      typeof s.target === 'string' &&
      typeof s.title === 'string' &&
      typeof s.content === 'string',
  );
}

/** 发布状态必须有至少一个步骤（创建与更新共用） */
export function validatePublishedSteps(steps: GuideStep[] | null | undefined): boolean {
  return !(steps === undefined || steps === null) && steps.length > 0;
}

/** 创建引导输入校验 + 归一化（POST /api/admin/guides） */
export function parseGuideInput(body: Record<string, unknown>): ParseResult<GuideInput> {
  const { guideKey, title, page, steps, status, targetCondition, priority } = body;

  if (typeof guideKey !== 'string' || !guideKey.trim()) {
    return { ok: false, error: 'guideKey 必填' };
  }
  if (typeof title !== 'string' || !title.trim()) {
    return { ok: false, error: 'title 必填' };
  }
  if (typeof page !== 'string' || !page.trim()) {
    return { ok: false, error: 'page 必填' };
  }
  if (!isValidStepList(steps)) {
    return { ok: false, error: 'steps 每项需包含 id/target/title/content 字符串字段' };
  }
  if (status === GuideStatus.PUBLISHED && !validatePublishedSteps(steps)) {
    return { ok: false, error: '发布（published）引导必须包含至少一个步骤' };
  }

  const normalizedStatus = Object.values(GuideStatus).includes(status as GuideStatus)
    ? (status as GuideStatus)
    : GuideStatus.DRAFT;
  const normalizedPriority =
    typeof priority === 'number' && Number.isFinite(priority) ? Math.trunc(priority) : 0;
  const normalizedTargetCondition =
    targetCondition !== undefined && targetCondition !== null ? targetCondition : null;
  if (normalizedTargetCondition !== null && !isValidTargetCondition(normalizedTargetCondition)) {
    return { ok: false, error: 'targetCondition 结构非法（需 {logic, conditions[]}）' };
  }

  return {
    ok: true,
    data: {
      guideKey: guideKey.trim(),
      title: title.trim(),
      page: page.trim(),
      steps: steps as GuideStep[],
      status: normalizedStatus,
      targetCondition: normalizedTargetCondition as GuideTargetCondition | null,
      priority: normalizedPriority,
    },
  };
}

export type GuidePatch = {
  guideKey?: string;
  title?: string;
  page?: string;
  steps?: GuideStep[];
  status?: GuideStatus;
  targetCondition?: GuideTargetCondition | null;
  priority?: number;
};

/** 更新引导输入校验（仅校验传入字段；唯一性/存在性检查在 updateGuide 内做） */
export function parseGuidePatch(body: Record<string, unknown>): ParseResult<GuidePatch> {
  const patch: GuidePatch = {};

  if (body.guideKey !== undefined) {
    if (typeof body.guideKey !== 'string' || !body.guideKey.trim()) {
      return { ok: false, error: 'guideKey 必填' };
    }
    patch.guideKey = body.guideKey.trim();
  }
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return { ok: false, error: 'title 必填' };
    }
    patch.title = body.title.trim();
  }
  if (body.page !== undefined) {
    if (typeof body.page !== 'string' || !body.page.trim()) {
      return { ok: false, error: 'page 必填' };
    }
    patch.page = body.page.trim();
  }
  if (body.steps !== undefined) {
    if (!isValidStepList(body.steps)) {
      return { ok: false, error: 'steps 每项需包含 id/target/title/content 字符串字段' };
    }
    patch.steps = body.steps as GuideStep[];
  }
  if (body.status !== undefined) {
    if (!Object.values(GuideStatus).includes(body.status as GuideStatus)) {
      return { ok: false, error: 'status 非法' };
    }
    patch.status = body.status as GuideStatus;
  }
  if (body.priority !== undefined) {
    if (typeof body.priority !== 'number' || !Number.isFinite(body.priority)) {
      return { ok: false, error: 'priority 非法' };
    }
    patch.priority = Math.trunc(body.priority);
  }
  if (body.targetCondition !== undefined) {
    const tc = body.targetCondition !== null ? body.targetCondition : null;
    if (tc !== null && !isValidTargetCondition(tc)) {
      return { ok: false, error: 'targetCondition 结构非法（需 {logic, conditions[]}）' };
    }
    patch.targetCondition = tc as GuideTargetCondition | null;
  }

  return { ok: true, data: patch };
}

/** 进度上报输入校验 + 归一化（POST /api/admin/guides/progress） */
export function parseProgressInput(
  body: Record<string, unknown>,
): ParseResult<{ guideKey: string; status?: GuideProgressStatus; currentStep?: number }> {
  const { guideKey, status, currentStep } = body;
  if (typeof guideKey !== 'string' || !guideKey.trim()) {
    return { ok: false, error: 'guideKey 必填' };
  }
  const normalizedStatus =
    status !== undefined && GUIDE_PROGRESS_STATUS_VALUES.includes(status as GuideProgressStatus)
      ? (status as GuideProgressStatus)
      : undefined;
  const normalizedCurrentStep =
    typeof currentStep === 'number' && Number.isFinite(currentStep)
      ? Math.trunc(Math.max(0, currentStep))
      : undefined;

  if (!normalizedStatus && normalizedCurrentStep === undefined) {
    return { ok: false, error: 'status 或 currentStep 至少提供一个' };
  }
  return {
    ok: true,
    data: {
      guideKey: guideKey.trim(),
      status: normalizedStatus,
      currentStep: normalizedCurrentStep,
    },
  };
}

/* ---------------- db 封装 ---------------- */

/** 引导列表（管理界面全量；运行时按 status 过滤），priority 降序 + 创建时间降序 */
export async function listGuides(status?: GuideStatus) {
  if (status) {
    return db
      .select()
      .from(guiders)
      .where(eq(guiders.status, status))
      .orderBy(desc(guiders.priority), desc(guiders.createdAt));
  }
  return db.select().from(guiders).orderBy(desc(guiders.priority), desc(guiders.createdAt));
}

/** 按 id 取引导（含 steps，供更新时的发布校验） */
export async function getGuideById(id: string) {
  const [row] = await db
    .select({ id: guiders.id, steps: guiders.steps })
    .from(guiders)
    .where(eq(guiders.id, id));
  return row ?? null;
}

/** 写操作统一返回：创建/更新（error 分支供路由层直接映射状态码） */
export type GuideWriteResult = { error: string } | { guide: typeof guiders.$inferSelect };

/** 删除操作返回 */
export type GuideDeleteResult = { error: string } | { success: true };

/** guideKey 唯一性检查（excludeId 用于更新时排除自身） */
export async function guideKeyExists(key: string, excludeId?: string) {
  const rows = await db.select({ id: guiders.id }).from(guiders).where(eq(guiders.guideKey, key));
  if (excludeId) return rows.length > 0 && rows[0].id !== excludeId;
  return rows.length > 0;
}

/** 创建引导（内部做唯一键冲突检查） */
export async function createGuide(data: GuideInput): Promise<GuideWriteResult> {
  if (await guideKeyExists(data.guideKey)) {
    return { error: 'guideKey 已存在（改版请使用新版本号，如 _v2）' } as const;
  }
  const [created] = await db
    .insert(guiders)
    .values({
      guideKey: data.guideKey,
      title: data.title,
      page: data.page,
      steps: data.steps,
      status: data.status,
      targetCondition: data.targetCondition,
      priority: data.priority,
    })
    .returning();
  return { guide: created } as const;
}

/** 更新引导（存在性 + 唯一性 + 发布必须有步骤校验） */
export async function updateGuide(id: string, patch: GuidePatch): Promise<GuideWriteResult> {
  const existing = await getGuideById(id);
  if (!existing) {
    return { error: '引导不存在' } as const;
  }
  if (patch.guideKey && (await guideKeyExists(patch.guideKey, id))) {
    return { error: 'guideKey 已存在（改版请使用新版本号，如 _v2）' } as const;
  }
  // 发布校验：最终步骤（本次提交 ∪ 已存步骤）不能为空
  if (patch.status === GuideStatus.PUBLISHED) {
    const finalSteps = patch.steps ?? (existing.steps as GuideStep[] | null) ?? [];
    if (!validatePublishedSteps(finalSteps)) {
      return { error: '发布（published）引导必须包含至少一个步骤' } as const;
    }
  }
  const [updated] = await db
    .update(guiders)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(guiders.id, id))
    .returning();
  return { guide: updated } as const;
}

/** 删除引导（进度记录保留，仅删除配置） */
export async function deleteGuideById(id: string): Promise<GuideDeleteResult> {
  const existing = await getGuideById(id);
  if (!existing) {
    return { error: '引导不存在' } as const;
  }
  await db.delete(guiders).where(eq(guiders.id, id));
  return { success: true } as const;
}

/** 当前用户全部引导进度 */
export async function getProgress(userId: string) {
  return db.select().from(userGuideProgress).where(eq(userGuideProgress.userId, userId));
}

/** guideKey 必须存在于 guiders 表（防止脏数据） */
export async function guideExistsByKey(guideKey: string) {
  const rows = await db
    .select({ id: guiders.id })
    .from(guiders)
    .where(eq(guiders.guideKey, guideKey));
  return rows.length > 0;
}

/** 进度 upsert：无记录创建（NOT_STARTED 兜底），有记录合并 status/currentStep/时间戳 */
export async function upsertProgress(
  userId: string,
  guideKey: string,
  input: { status?: GuideProgressStatus; currentStep?: number },
) {
  const { status, currentStep } = input;
  const [existing] = await db
    .select()
    .from(userGuideProgress)
    .where(and(eq(userGuideProgress.userId, userId), eq(userGuideProgress.guideKey, guideKey)));

  const now = new Date();

  if (!existing) {
    const effectiveStatus = status ?? GuideProgressStatus.NOT_STARTED;
    const [created] = await db
      .insert(userGuideProgress)
      .values({
        userId,
        guideKey,
        status: effectiveStatus,
        currentStep: currentStep ?? 0,
        startedAt: effectiveStatus === GuideProgressStatus.IN_PROGRESS ? now : null,
        completedAt: effectiveStatus === GuideProgressStatus.COMPLETED ? now : null,
      })
      .returning();
    return { created: true, row: created };
  }

  const patch: {
    status?: GuideProgressStatus;
    currentStep?: number;
    startedAt?: Date | null;
    completedAt?: Date | null;
    updatedAt: Date;
  } = { updatedAt: now };

  if (status !== undefined) {
    patch.status = status;
    if (status === GuideProgressStatus.IN_PROGRESS && !existing.startedAt) {
      patch.startedAt = now;
    }
    if (status === GuideProgressStatus.COMPLETED && !existing.completedAt) {
      patch.completedAt = now;
    }
  }
  if (currentStep !== undefined) {
    patch.currentStep = currentStep;
  }

  const [updated] = await db
    .update(userGuideProgress)
    .set(patch)
    .where(eq(userGuideProgress.id, existing.id))
    .returning();
  return { created: false, row: updated };
}

/** 重置进度：删除当前用户指定引导的进度记录（重新触发） */
export async function deleteProgress(userId: string, guideKey: string) {
  const deleted = await db
    .delete(userGuideProgress)
    .where(and(eq(userGuideProgress.userId, userId), eq(userGuideProgress.guideKey, guideKey)))
    .returning({ id: userGuideProgress.id });
  return deleted.length;
}
