'use client';

/**
 * 媒体上传状态机 hook（C12：manage-media 上传流程收口）。
 *
 * 收口：上传弹窗开关、目标类型、暂存文件、批量上传编排。
 * 上传执行 / 目标校验在 lib/media/client/index.ts（纯函数 + 共享 API 调用）。
 * 上传完成通过 onUploaded 通知父组件刷新列表。
 */
import { useState } from 'react';
import { uploadMediaFiles, UPLOAD_TARGET_OPTIONS, type UploadTarget } from '@/lib/media/client';
import { MediaType } from '@/lib/types/media';

export function useMediaUpload({ onUploaded }: { onUploaded?: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<UploadTarget>(MediaType.ARTICLE);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  /** 打开上传弹窗（重置目标为文章图片） */
  const openUpload = () => {
    setUploadType(MediaType.ARTICLE);
    setUploadFiles([]);
    setUploadOpen(true);
  };

  /** 选择文件后暂存（弹窗内确认再上传） */
  const pickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const removePickedFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const closeUpload = () => {
    if (uploading) return;
    setUploadOpen(false);
    setUploadFiles([]);
  };

  /** 批量上传：逐文件执行，汇总成功/失败提示 */
  const handleFileUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    try {
      const { success, failed, firstError } = await uploadMediaFiles(uploadFiles, uploadType);
      if (failed > 0) {
        window.alert(
          failed === uploadFiles.length
            ? `上传失败：${firstError || '全部失败'}`
            : `部分成功（${success} 张），${failed} 张失败：${firstError || '未知原因'}`,
        );
      }
      onUploaded?.();
      setUploadFiles([]);
      setUploadOpen(false);
    } catch (e) {
      console.error('上传失败：', e);
      window.alert('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  return {
    uploading,
    uploadType,
    setUploadType,
    uploadOpen,
    uploadFiles,
    openUpload,
    closeUpload,
    pickFiles,
    removePickedFile,
    handleFileUpload,
    uploadTargetOptions: UPLOAD_TARGET_OPTIONS,
  };
}
