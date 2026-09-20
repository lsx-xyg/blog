'use client';

/**
 * 管理首页快捷入口：拖拽排序（dnd-kit，把手方案）
 * - 拖拽只从「拖拽把手」发起；Link 主体是纯点击区域 → 拖拽结束的 click 冒泡到把手即被
 *   stopPropagation 拦截，绝不触发跳转；正常点击 Link 跳转不受影响
 * - 只有把手上 touch-action: none，卡片主体滚动不受影响
 * - 顺序持久化到后端 settings（跨设备、跨会话生效）
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  rectIntersection,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FileText,
  Image as ImageIcon,
  Tag,
  Link2,
  Settings,
  Timer,
  DatabaseBackup,
  UserRound,
  Route,
  GripVertical,
  type LucideIcon,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export type QuickLinkDef = {
  key: string;
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  iconClass: string;
};

/** 默认顺序：未自定义时兜底 */
export const DEFAULT_QUICK_ORDER = [
  'posts',
  'media',
  'tags',
  'friendLinks',
  'settings',
  'cron',
  'backup',
  'account',
  'guides',
] as const;

function makeDefs(adminPath: string): Record<string, QuickLinkDef> {
  const link = (p: string) => `/${adminPath}${p}`;
  return {
    posts: {
      key: 'posts',
      title: '文章管理',
      desc: '创建 / 编辑 / 发布',
      href: link('/posts'),
      icon: FileText,
      iconClass: 'bg-primary/10 text-primary',
    },
    media: {
      key: 'media',
      title: '媒体库',
      desc: '图片管理 / 清理',
      href: link('/media'),
      icon: ImageIcon,
      iconClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    },
    tags: {
      key: 'tags',
      title: '标签管理',
      desc: '查看 / 删除 / 统计',
      href: link('/tags'),
      icon: Tag,
      iconClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    },
    friendLinks: {
      key: 'friendLinks',
      title: '友链管理',
      desc: '添加 / 编辑 / 删除',
      href: link('/friend-links'),
      icon: Link2,
      iconClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    },
    settings: {
      key: 'settings',
      title: '站点设置',
      desc: '站名 / SEO / 存储 / 评论',
      href: link('/settings'),
      icon: Settings,
      iconClass: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    },
    cron: {
      key: 'cron',
      title: '定时任务',
      desc: '启动 / 停止 / 手动触发',
      href: link('/cron'),
      icon: Timer,
      iconClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    backup: {
      key: 'backup',
      title: '备份管理',
      desc: '创建 / 下载 / 恢复',
      href: link('/backup'),
      icon: DatabaseBackup,
      iconClass: 'bg-green-500/10 text-green-600 dark:text-green-400',
    },
    account: {
      key: 'account',
      title: '账号设置',
      desc: '修改密码 / 关联 GitHub',
      href: link('/account'),
      icon: UserRound,
      iconClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
    guides: {
      key: 'guides',
      title: '引导管理',
      desc: '新手引导配置',
      href: link('/guides'),
      icon: Route,
      iconClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    },
  };
}

function SortableLink({ def, _adminPath }: { def: QuickLinkDef; _adminPath: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: def.key,
  });

  const Icon = def.icon;

  return (
    <Link
      ref={setNodeRef}
      href={def.href}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-fg-faint hover:shadow-sm ${
        isDragging ? 'z-50 scale-[1.03] shadow-xl ring-2 ring-primary/40' : ''
      }`}
    >
      <div className={`rounded-lg p-2 ${def.iconClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{def.title}</p>
        <p className="truncate text-xs text-muted-foreground">{def.desc}</p>
      </div>
      {/* 拖拽把手：唯一拖拽入口；stopPropagation 拦截拖拽结束的补发 click，Link 不会跳转 */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label={`拖拽排序：${def.title}`}
        title="拖拽排序"
        className="cursor-grab touch-none shrink-0 rounded-md p-1.5 text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </Link>
  );
}

export default function QuickLinks({
  adminPath,
  initialOrder,
}: {
  adminPath: string;
  initialOrder: string[] | null;
}) {
  const { showToast } = useToast();
  const [order, setOrder] = useState<string[]>(initialOrder ?? [...DEFAULT_QUICK_ORDER]);
  const [saving, setSaving] = useState(false);
  const defs = makeDefs(adminPath);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const persistOrder = async (next: string[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/dashboard/order?scope=quick', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next, scope: 'quick' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '保存失败');
      }
      showToast('快捷入口顺序已保存', 'success');
    } catch (e) {
      console.error('保存快捷入口顺序失败：', e);
      showToast('保存顺序失败，刷新后将恢复默认', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    void persistOrder(next);
  };

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {order.map((key) => {
              const def = defs[key];
              return def ? <SortableLink key={key} def={def} _adminPath={adminPath} /> : null;
            })}
          </nav>
        </SortableContext>
      </DndContext>
      <p className="mt-2 text-xs text-muted-foreground">
        {saving ? (
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
            保存中…
          </span>
        ) : (
          '拖拽卡片右侧 ⠿ 手柄调整顺序 · 移动端长按手柄 · 顺序跨设备保存'
        )}
      </p>
    </div>
  );
}
