import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { headers } from 'next/headers';
import { isAdminUser } from '@/lib/shared';
import { deleteTag, getTagById, getTagByName, updateTag } from '@/lib/tags/server';

/**
 * 标签管理 API
 * PATCH /api/admin/tags/[id] - 更新标签名称 { name }
 * DELETE /api/admin/tags/[id] - 删除标签（关联的文章/图片标签由外键 CASCADE 清理）
 */

/** 更新标签 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: '标签名称不能为空' }, { status: 400 });
    }

    const tag = await getTagById(id);
    if (!tag) {
      return NextResponse.json({ error: '标签不存在' }, { status: 404 });
    }

    const existing = await getTagByName(name);
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: '同名标签已存在' }, { status: 409 });
    }

    const updated = await updateTag(id, name);
    return NextResponse.json({ tag: updated });
  } catch (error) {
    console.error('更新标签失败：', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const tag = await getTagById(id);
    if (!tag) {
      return NextResponse.json({ error: '标签不存在' }, { status: 404 });
    }

    await deleteTag(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除标签失败：', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
