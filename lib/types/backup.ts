export const BackupTrigger = {
    MANUAL: "MANUAL",
    AUTO: "AUTO",
} as const;

export type BackupTrigger = (typeof BackupTrigger)[keyof typeof BackupTrigger];

export const BACKUP_TRIGGER_VALUES = Object.values(BackupTrigger) as BackupTrigger[];
