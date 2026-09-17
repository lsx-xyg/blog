"use client";

/**
 * 上传图片弹窗（C12：manage-media 拆分）。
 * 纯展示：类型单选切换 + 文件选择/暂存列表。状态与编排在 useMediaUpload hook。
 */
import { useRef } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { AdminModal } from "@/components/admin/modal";
import { MediaType, MEDIA_TYPE_LABELS } from "@/lib/types/media";
import type { UploadTarget } from "@/lib/media/upload";

export function UploadDialog({
  open,
  uploading,
  uploadType,
  onUploadTypeChange,
  uploadFiles,
  onPick,
  onRemove,
  onClose,
  onUpload,
}: {
  open: boolean;
  uploading: boolean;
  uploadType: UploadTarget;
  onUploadTypeChange: (t: UploadTarget) => void;
  uploadFiles: File[];
  onPick: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
  onUpload: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <AdminModal
      open={open}
      title="上传图片"
      onClose={onClose}
      maxWidth="md"
      closeOnBackdrop={!uploading}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onUpload}
            disabled={uploading || uploadFiles.length === 0}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {uploading ? `上传中（${uploadFiles.length} 张）…` : `开始上传（${uploadFiles.length} 张）`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 上传类型选择（单选切换） */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">上传到</label>
          <div className="grid grid-cols-2 gap-2">
            {([MediaType.ARTICLE, MediaType.GALLERY] as const).map((t) => {
                const value: UploadTarget = t;
                const active = uploadType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onUploadTypeChange(value)}
                    className={`rounded-lg border px-3 py-2.5 text-sm transition-all ${
                      active
                        ? "border-primary bg-primary/5 font-medium text-primary"
                        : "border-input hover:bg-accent"
                    }`}
                  >
                    {MEDIA_TYPE_LABELS[value as MediaType]}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {value === MediaType.ARTICLE ? "用作文章配图" : "加入相册"}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* 选择文件 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">选择图片</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            点击选择图片（可多选）
          </button>
          {uploadFiles.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {uploadFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-xs">
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate flex-1">{file.name}</span>
                  <span className="shrink-0 text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    disabled={uploading}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                    aria-label="移除"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminModal>
  );
}
