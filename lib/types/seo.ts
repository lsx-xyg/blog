/** IndexNow 相关类型定义 */

/** IndexNow API 请求体（https://indexnow.org/documentation） */
export type IndexNowPayload = {
  /** 站点主机名（不带协议与路径） */
  host: string;
  /** 站点密钥（与 /{key}.txt 文件内容一致） */
  key: string;
  /** 本次提交的 URL 列表 */
  urlList: string[];
  /** 密钥文件完整 URL（可选；缺省时引擎假定 https://{host}/{key}.txt） */
  keyLocation?: string;
};

/** IndexNow 提交结果（旁路语义：ok=false 不代表业务失败） */
export type IndexNowResult = {
  /** 本次提交是否被引擎接收（200/202） */
  ok: boolean;
  /** 最后一次请求的 HTTP 状态码（网络错误时为 null） */
  status: number | null;
  /** 人类可读的结果说明 */
  message: string;
  /** 成功提交的 URL 条数 */
  submitted: number;
  /** 提交端点（调试用） */
  endpoint?: string;
};
