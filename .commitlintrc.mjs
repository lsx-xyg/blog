/** @type {import('czg').UserConfig} */
const commitlintConfig =  {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert']
    ],
    'subject-case': [0]
  },
  prompt: {
    useEmoji: true
    // 其他 cz-git 配置...
  }
};

export default commitlintConfig;