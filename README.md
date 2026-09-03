# DSH 插件开发助手

[![DSH Plugin](https://img.shields.io/badge/dsh-plugin-%234A90D9)](https://github.com/topics/dsh-plugin)

**对话式引导，从零开始创建、测试、发布 DSH 插件。**

## 安装

```powershell
dsh plugin --profile web add dsh-plugin-dev-assistant
# 或从 GitHub 安装
dsh plugin --profile web add github:CodeDice1024/dsh-plugin-dev-assistant
```

## 工具列表

| 工具 | 说明 |
|------|------|
| `dsh_plugin_scaffold` | 根据对话结果生成完整插件项目，包含所有核心文件 |
| `dsh_plugin_check` | 检查插件项目结构是否完整，给出改进建议 |
| `dsh_plugin_publish_guide` | 发布到 GitHub 和 npm 的完整步骤指南 |
| `dsh_plugin_learning_path` | 从零基础到独立发布的学习路径 |
| `dsh_plugin_dev_guide` | 8 个主题的开发指南 |

## 工作流程

1. 在对话中告诉我你想开发什么插件
2. 我会按结构化流程了解你的需求
3. 确认需求后生成完整项目代码
4. 帮你本地测试验证
5. 测试通过后再发布到 GitHub / npm

## 许可证

MIT