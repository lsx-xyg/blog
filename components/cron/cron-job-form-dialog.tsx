"use client";

/**
 * 定时任务创建/编辑表单弹窗（C11：manage-cron-jobs 拆分）。
 * 纯展示组件：表单状态由 useCronForm hook 持有，本组件只做渲染与回填。
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { REQUEST_METHODS, TIMEZONES } from "@/lib/cron/form";
import type { FormState } from "@/lib/cron/form";

export function CronJobFormDialog({
  form,
  setForm,
  editingJobId,
  saving,
  showAdvanced,
  setShowAdvanced,
  onClose,
  onSave,
}: {
  form: FormState;
  setForm: (next: FormState) => void;
  editingJobId: number | null;
  saving: boolean;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  // 通知设置折叠展开（组件内自持 UI 状态）
  const [showNotification, setShowNotification] = useState(false);
  return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingJobId ? "编辑定时任务" : "创建定时任务"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 基本信息 */}
              <div>
                <label className="mb-1 block text-sm font-medium">任务标题</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="例如：博客定时发布扫描"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  请求 URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                  placeholder="https://example.com/api/cron/publish-scheduled"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">请求方法</label>
                  <select
                    value={form.requestMethod}
                    onChange={(e) => setForm({ ...form, requestMethod: parseInt(e.target.value, 10) })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    {REQUEST_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">超时时间（秒）</label>
                  <input
                    type="number"
                    value={form.requestTimeout}
                    onChange={(e) => setForm({ ...form, requestTimeout: parseInt(e.target.value, 10) || -1 })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    placeholder="-1 表示使用默认"
                  />
                </div>
              </div>


              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  启用任务
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.saveResponses}
                    onChange={(e) => setForm({ ...form, saveResponses: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  保存响应
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.redirectSuccess}
                    onChange={(e) => setForm({ ...form, redirectSuccess: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  3xx 视为成功
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                开启「保存响应」后，执行历史中将保存并展示本次请求的响应头和响应体，便于排查问题。
                注意：响应内容可能包含敏感信息（如 API Key），请勿外泄。
              </p>

              {/* 调度配置 */}
              <div className="rounded-lg border border-border p-4">
                <h3 className="mb-3 font-medium">调度配置</h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">时区</label>
                    <select
                      value={form.schedule.timezone}
                      onChange={(e) =>
                        setForm({ ...form, schedule: { ...form.schedule, timezone: e.target.value } })
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">分钟 (0-59, -1=每分)</label>
                      <input
                        type="text"
                        value={form.schedule.minutes}
                        onChange={(e) =>
                          setForm({ ...form, schedule: { ...form.schedule, minutes: e.target.value } })
                        }
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                        placeholder="-1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">小时 (0-23, -1=每时)</label>
                      <input
                        type="text"
                        value={form.schedule.hours}
                        onChange={(e) =>
                          setForm({ ...form, schedule: { ...form.schedule, hours: e.target.value } })
                        }
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                        placeholder="-1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">日 (1-31, -1=每天)</label>
                      <input
                        type="text"
                        value={form.schedule.mdays}
                        onChange={(e) =>
                          setForm({ ...form, schedule: { ...form.schedule, mdays: e.target.value } })
                        }
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                        placeholder="-1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">月 (1-12, -1=每月)</label>
                      <input
                        type="text"
                        value={form.schedule.months}
                        onChange={(e) =>
                          setForm({ ...form, schedule: { ...form.schedule, months: e.target.value } })
                        }
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                        placeholder="-1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">周几 (0-6, -1=每天)</label>
                      <input
                        type="text"
                        value={form.schedule.wdays}
                        onChange={(e) =>
                          setForm({ ...form, schedule: { ...form.schedule, wdays: e.target.value } })
                        }
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                        placeholder="-1"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    多个值用逗号分隔，例如：0,15,30,45 表示每 15 分钟执行一次
                  </p>
                </div>
              </div>

              {/* 通知设置 */}
              <div className="rounded-lg border border-border p-4">
                <button
                  type="button"
                  onClick={() => setShowNotification(!showNotification)}
                  className="flex w-full items-center justify-between text-left font-medium"
                >
                  <span>通知设置</span>
                  {showNotification ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showNotification && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.notification.onFailure}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              notification: { ...form.notification, onFailure: e.target.checked },
                            })
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        失败时通知
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.notification.onSuccess}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              notification: { ...form.notification, onSuccess: e.target.checked },
                            })
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        成功后通知
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.notification.onDisable}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              notification: { ...form.notification, onDisable: e.target.checked },
                            })
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        自动禁用时通知
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.notification.onSslCertExpiry}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              notification: { ...form.notification, onSslCertExpiry: e.target.checked },
                            })
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        SSL 证书即将过期时通知
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          失败多少次后通知（最小 1）
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={form.notification.onFailureCount}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              notification: {
                                ...form.notification,
                                onFailureCount: parseInt(e.target.value, 10) || 1,
                              },
                            })
                          }
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          disabled={!form.notification.onFailure}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          SSL 过期提前通知（秒，默认 604800 = 7 天）
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={form.notification.onSslCertExpirySeconds}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              notification: {
                                ...form.notification,
                                onSslCertExpirySeconds: parseInt(e.target.value, 10) || 0,
                              },
                            })
                          }
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          disabled={!form.notification.onSslCertExpiry}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      通知通过 cron-job.org 发送到账号绑定的邮箱/渠道。失败多次通知需先开启「失败时通知」。
                    </p>
                  </div>
                )}
              </div>

              {/* 高级配置（请求头和请求体） */}
              <div className="rounded-lg border border-border p-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex w-full items-center justify-between text-left font-medium"
                >
                  <span>高级配置（请求头 / 请求体）</span>
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium">请求头</label>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({ ...form, headers: [...form.headers, { key: "", value: "" }] })
                          }
                          className="text-xs text-primary hover:underline"
                        >
                          + 添加请求头
                        </button>
                      </div>
                      <div className="space-y-2">
                        {form.headers.map((header, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={header.key}
                              onChange={(e) => {
                                const newHeaders = [...form.headers];
                                newHeaders[index].key = e.target.value;
                                setForm({ ...form, headers: newHeaders });
                              }}
                              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
                              placeholder="Header Name"
                            />
                            <input
                              type="text"
                              value={header.value}
                              onChange={(e) => {
                                const newHeaders = [...form.headers];
                                newHeaders[index].value = e.target.value;
                                setForm({ ...form, headers: newHeaders });
                              }}
                              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
                              placeholder="Header Value"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newHeaders = form.headers.filter((_, i) => i !== index);
                                setForm({ ...form, headers: newHeaders });
                              }}
                              className="rounded p-1 text-muted-foreground hover:text-red-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">请求体</label>
                      <textarea
                        value={form.body}
                        onChange={(e) => setForm({ ...form, body: e.target.value })}
                        className="h-24 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
                        placeholder='{"key": "value"}'
                      />
                    </div>

                    {/* HTTP 基本认证 */}
                    <div className="rounded-lg border border-border p-3">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={form.auth.enable}
                          onChange={(e) =>
                            setForm({ ...form, auth: { ...form.auth, enable: e.target.checked } })
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        HTTP 基本认证
                      </label>
                      {form.auth.enable && (
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">用户名</label>
                            <input
                              type="text"
                              value={form.auth.user}
                              onChange={(e) =>
                                setForm({ ...form, auth: { ...form.auth, user: e.target.value } })
                              }
                              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                              placeholder="Basic Auth 用户名"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">密码</label>
                            <input
                              type="password"
                              value={form.auth.password}
                              onChange={(e) =>
                                setForm({ ...form, auth: { ...form.auth, password: e.target.value } })
                              }
                              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                              placeholder="Basic Auth 密码"
                            />
                          </div>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        启用后请求会携带 Authorization: Basic 头。密码仅保存于 cron-job.org，用于执行时认证。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 表单底部按钮 */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition hover:bg-accent"
              >
                取消
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "保存中..." : editingJobId ? "保存修改" : "创建任务"}
              </button>
            </div>
          </div>
        </div>
  );
}
