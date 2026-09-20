import { afterEach, describe, expect, it } from 'vitest';
import { BACKUP_VERSION, ENCRYPTED_MAGIC, decodeBackupContent, encodeBackupContent } from './codec';
import type { BackupData } from './codec';

const KEY_32 = Buffer.from('a'.repeat(32)).toString('base64');

function makeData(): BackupData {
  return {
    version: BACKUP_VERSION,
    createdAt: '2026-09-16T00:00:00.000Z',
    sensitiveFieldsEncrypted: true,
    tables: { posts: [{ id: '1', title: '你好' }] },
  };
}

afterEach(() => {
  delete process.env.ENCRYPTION_KEY;
});

describe('encodeBackupContent', () => {
  it('未配置密钥时明文存储（isEncrypted=false，无魔数）', () => {
    delete process.env.ENCRYPTION_KEY;
    const { content, isEncrypted } = encodeBackupContent(makeData());
    expect(isEncrypted).toBe(false);
    expect(content.startsWith(ENCRYPTED_MAGIC)).toBe(false);
    expect(JSON.parse(content).tables.posts[0].title).toBe('你好');
  });

  it('配置密钥时加密存储（isEncrypted=true，带魔数）', () => {
    process.env.ENCRYPTION_KEY = KEY_32;
    const { content, isEncrypted } = encodeBackupContent(makeData());
    expect(isEncrypted).toBe(true);
    expect(content.startsWith(ENCRYPTED_MAGIC)).toBe(true);
  });
});

describe('decodeBackupContent', () => {
  it('未加密内容原样返回', () => {
    const buf = Buffer.from('{"version":"1.0"}', 'utf-8');
    expect(decodeBackupContent(buf).toString()).toBe('{"version":"1.0"}');
  });

  it('加密内容往返还原为原始 JSON', () => {
    process.env.ENCRYPTION_KEY = KEY_32;
    const data = makeData();
    const { content } = encodeBackupContent(data);
    const decoded = decodeBackupContent(Buffer.from(content, 'utf-8')).toString('utf-8');
    expect(JSON.parse(decoded)).toEqual(data);
  });

  it('加密文件但密钥缺失时抛错', () => {
    process.env.ENCRYPTION_KEY = KEY_32;
    const { content } = encodeBackupContent(makeData());
    delete process.env.ENCRYPTION_KEY;
    expect(() => decodeBackupContent(Buffer.from(content, 'utf-8'))).toThrow('备份文件解密失败');
  });
});
