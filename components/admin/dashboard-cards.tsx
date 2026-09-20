'use client';

/**
 * 管理首页统计卡片：拖拽排序（dnd-kit，把手方案）
 * - 拖拽只从「拖拽把手」发起，卡片主体是纯展示区 → 点击/事件路径与拖拽完全分离
 * - 只有把手上 touch-action: none，卡片主体滚动不受影响
 * - 顺序持久化到后端 settings（跨设备、跨会话生效）
 */
import { useState } from 'react';
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
  Eye,
  Tag,
  Image as ImageIcon,
  Link2,
  Clock,
  TrendingUp,
  FileEdit,
  GripVertical,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

export type DashboardStats = {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  scheduledPosts: number;
  totalViews: number;
  totalTags: number;
  totalMedia: number;
  totalFriendLinks: number;
};

export type CardDef = {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
  iconClass: string;
  valueClass?: string;
  format?: (n: number) => string;
};

/** 默认顺序：未自定义时兜底 */
export const DEFAULT_CARD_ORDER = [
  'totalPosts',
  'publishedPosts',
  'draftPosts',
  'scheduledPosts',
  'totalViews',
  'totalTags',
  'totalMedia',
  'totalFriendLinks',
] as const;

function makeDefs(stats: DashboardStats): Record<string, CardDef> {
  return {
    totalPosts: {
      key: 'totalPosts',
      label: '文章总数',
      value: stats.totalPosts,
      icon: FileText,
      iconClass: 'bg-primary/10 text-primary',
    },
    publishedPosts: {
      key: 'publishedPosts',
      label: '已发布',
      value: stats.publishedPosts,
      icon: TrendingUp,
      iconClass: 'bg-green-500/10 text-green-600 dark:text-green-400',
      valueClass: 'text-green-600 dark:text-green-400',
    },
    draftPosts: {
      key: 'draftPosts',
      label: '草稿',
      value: stats.draftPosts,
      icon: FileEdit,
      iconClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
      valueClass: 'text-yellow-600 dark:text-yellow-400',
    },
    scheduledPosts: {
      key: 'scheduledPosts',
      label: '定时发布',
      value: stats.scheduledPosts,
      icon: Clock,
      iconClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      valueClass: 'text-blue-600 dark:text-blue-400',
    },
    totalViews: {
      key: 'totalViews',
      label: '总访问量',
      value: stats.totalViews,
      icon: Eye,
      iconClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      format: (n) => n.toLocaleString(),
    },
    totalTags: {
      key: 'totalTags',
      label: '标签总数',
      value: stats.totalTags,
      icon: Tag,
      iconClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    },
    totalMedia: {
      key: 'totalMedia',
      label: '媒体总数',
      value: stats.totalMedia,
      icon: ImageIcon,
      iconClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    },
    totalFriendLinks: {
      key: 'totalFriendLinks',
      label: '友链总数',
      value: stats.totalFriendLinks,
      icon: Link2,
      iconClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    },
  };
}

function SortableCard({ def }: { def: CardDef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: def.key,
  });

  const Icon = def.icon;

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`transition-all hover:shadow-md ${
        isDragging ? 'z-50 scale-[1.03] shadow-xl ring-2 ring-primary/40' : ''
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{def.label}</p>
            <p className={`mt-1 text-2xl font-bold ${def.valueClass ?? ''}`}>
              {def.format ? def.format(def.value) : def.value}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <div className={`rounded-lg p-2 ${def.iconClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            {/* 拖拽把手：唯一拖拽入口，touch-none 只作用于此，卡片主体滚动不受影响 */}
            <button
              type="button"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              aria-label={`拖拽排序：${def.label}`}
              title="拖拽排序"
              className="cursor-grab touch-none rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardCards({
  stats,
  initialOrder,
}: {
  stats: DashboardStats;
  initialOrder: string[] | null;
}) {
  const { showToast } = useToast();
  const [order, setOrder] = useState<string[]>(initialOrder ?? [...DEFAULT_CARD_ORDER]);
  const [saving, setSaving] = useState(false);
  const defs = makeDefs(stats);

  const sensors = useSensors(
    // 鼠标：移动 6px 即启动，不影响点击
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // 触摸：长按 250ms 且位移 ≤5px 才启动（滚动不会误判为拖拽）
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const persistOrder = async (next: string[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/dashboard/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next, scope: 'cards' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '保存失败');
      }
      showToast('卡片顺序已保存', 'success');
    } catch (e) {
      console.error('保存卡片顺序失败：', e);
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
            {order.map((key) => {
              const def = defs[key];
              return def ? <SortableCard key={key} def={def} /> : null;
            })}
          </div>
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
