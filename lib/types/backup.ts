export const BackupTrigger = {
  MANUAL: 'MANUAL',
  AUTO: 'AUTO',
} as const;

export type BackupTrigger = (typeof BackupTrigger)[keyof typeof BackupTrigger];

export const BACKUP_TRIGGER_VALUES = Object.values(BackupTrigger) as BackupTrigger[];

/** 备份审计操作类型（全大写） */
export const BackupAuditAction = {
  CREATE: 'CREATE', // 创建备份
  DOWNLOAD: 'DOWNLOAD', // 下载备份
  DELETE: 'DELETE', // 删除备份
  RESTORE: 'RESTORE', // 恢复备份
} as const;

export type BackupAuditAction = (typeof BackupAuditAction)[keyof typeof BackupAuditAction];

export const BACKUP_AUDIT_ACTION_VALUES = Object.values(BackupAuditAction) as BackupAuditAction[];
