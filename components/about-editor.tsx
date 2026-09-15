"use client";

/**
 * 关于页面编辑器组件（独立组件，用于动态导入）
 *
 * 功能：
 * - 使用 ByteMD 编辑器编辑关于页面内容
 * - 支持 Markdown 格式
 * - 左右分屏模式
 *
 * 设计说明：
 * - 这个组件只在用户点击"关于页面"设置分区时才需要
 * - 使用动态导入可以减少站点设置页的首屏体积
 * - ByteMD 编辑器体积较大（约 200+ kB），延迟加载可以提升首屏加载速度
 */
import { Editor } from "@bytemd/react";
import gfm from "@bytemd/plugin-gfm";
import "bytemd/dist/index.css";

const plugins = [gfm()];

interface AboutEditorProps {
  /** 编辑器内容 */
  value: string;
  /** 内容变化回调 */
  onChange: (value: string) => void;
}

export function AboutEditor({ value, onChange }: AboutEditorProps) {
  return (
    <div className="bytemd-wrapper">
      <Editor
        value={value}
        onChange={onChange}
        plugins={plugins}
        mode="split"
      />
    </div>
  );
}
