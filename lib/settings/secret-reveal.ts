/**
 * 敏感信息明文查看状态机（纯 reducer，可独立单测）
 *
 * 规则：查看明文 → 30 秒倒计时 → 到期自动隐藏；中途可手动隐藏。
 * 组件只负责「每秒 dispatch tick」，状态转换全部收口在此。
 */
export interface SecretRevealState {
  key: string;
  value: string;
  countdown: number;
}

export type SecretRevealAction =
  | { type: "reveal"; key: string; value: string }
  | { type: "tick" }
  | { type: "hide" };

/** 明文默认展示时长（秒），到期自动隐藏 */
export const SECRET_REVEAL_SECONDS = 30;

export function secretRevealReducer(
  state: SecretRevealState | null,
  action: SecretRevealAction
): SecretRevealState | null {
  switch (action.type) {
    case "reveal":
      return {
        key: action.key,
        value: action.value,
        countdown: SECRET_REVEAL_SECONDS,
      };
    case "tick":
      if (!state) return null;
      if (state.countdown <= 1) return null; // 归零 → 自动隐藏
      return { ...state, countdown: state.countdown - 1 };
    case "hide":
      return null;
    default:
      return state;
  }
}
