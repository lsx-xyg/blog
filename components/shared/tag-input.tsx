"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus } from "lucide-react";

type Tag = {
  id: string;
  name: string;
  slug: string;
};

type TagInputProps = {
  value: string[]; // 标签名称数组
  onChange: (tags: string[]) => void;
  placeholder?: string;
  allTags?: Tag[]; // 所有已有标签，用于下拉提示
};

/**
 * 标签输入组件
 * - 回车输入标签，自动添加
 * - 输入时下拉显示已有标签，可点击选择
 * - 已选标签显示为胶囊，可点击 X 删除
 * - 支持中文标签
 */
export function TagInput({ value, onChange, placeholder = "输入标签后回车添加", allTags = [] }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 过滤匹配的标签（不区分大小写，支持部分匹配）
  const filteredTags = allTags.filter(
    (tag) =>
      !value.includes(tag.name) &&
      (inputValue === "" || tag.name.toLowerCase().includes(inputValue.toLowerCase())),
  );

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 添加标签
  const addTag = (tagName: string) => {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setInputValue("");
      return;
    }
    onChange([...value, trimmed]);
    setInputValue("");
    setHighlightIndex(-1);
  };

  // 删除标签
  const removeTag = (tagName: string) => {
    onChange(value.filter((t) => t !== tagName));
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < filteredTags.length) {
        addTag(filteredTags[highlightIndex].name);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      // 输入框为空时按退格，删除最后一个标签
      removeTag(value[value.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setShowDropdown(true);
      setHighlightIndex((prev) => Math.min(prev + 1, filteredTags.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 标签显示区域 + 输入框 */}
      <div
        className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tagName) => (
          <span
            key={tagName}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary animate-fade-in-up"
          >
            {tagName}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tagName);
              }}
              className="ml-0.5 rounded-full hover:bg-primary/20 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowDropdown(true);
            setHighlightIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* 下拉提示 */}
      {showDropdown && filteredTags.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg animate-fade-in-up">
          {filteredTags.map((tag, index) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => addTag(tag.name)}
              onMouseEnter={() => setHighlightIndex(index)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                index === highlightIndex ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <span>{tag.name}</span>
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
