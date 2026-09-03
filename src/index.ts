/**
 * dsh-plugin-dev-assistant - DSH 插件开发助手
 *
 * 注册 5 个工具，引导用户从零开始创建、测试、发布 DSH 插件
 * - dsh_plugin_scaffold: 根据用户意图生成完整插件项目
 * - dsh_plugin_check: 检查插件项目结构完整性
 * - dsh_plugin_publish_guide: 发布到 GitHub / npm 的完整指南
 * - dsh_plugin_learning_path: 从零基础到独立发布的学习路径
 * - dsh_plugin_dev_guide: 开发主题的详细指南
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type Tool } from '@deepseek-ai/dsh-tools'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ============================================================
// 插件元数据
// ============================================================

export const name = 'dsh-plugin-dev-assistant'

export function apply(ctx: Context) {
  ctx.logger.info('dsh-plugin-dev-assistant 已加载')

  // ============================================================
  // 工具 1：生成插件项目脚手架
  // ============================================================

  ctx.tools.register(defineTool({
    name: 'dsh_plugin_scaffold',
    description: '根据用户意图生成完整的 DSH 插件项目。调用此工具时，我已经在对话中问清楚用户想要什么插件，然后生成对应的项目目录和所有文件。',
    parameters: {
      plugin_name: { type: 'string', required: true, description: '插件名称，如 dsh-weather-alert' },
      plugin_type: {
        type: 'string',
        required: true,
        description: '插件类型',
        enum: ['tool', 'event', 'web-ui', 'skill', 'combo'],
      },
      description: { type: 'string', required: true, description: '插件功能描述' },
      features: { type: 'string', description: '用户想要的功能要点，逗号分隔' },
      target_dir: { type: 'string', required: true, description: '生成目录，如 D:\\deepseek\\plugin\\插件名' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          created: { type: 'boolean' },
          files: { type: 'array' },
          message: { type: 'string' },
          plugin_name: { type: 'string' },
        },
      },
      render(args: Record<string, unknown>, value: Record<string, unknown>) {
        const lines: string[] = ['# 插件脚手架生成结果', '']
        lines.push('状态：' + (value.created ? '✅ 成功' : '❌ 失败'))
        lines.push('')
        lines.push(String(value.message ?? ''))

        if (value.files && Array.isArray(value.files) && value.files.length > 0) {
          lines.push('', '## 生成的文件')
          for (const f of value.files) {
            lines.push('- ' + String(f))
          }
        }

        lines.push('', '---', '')
        lines.push('## 下一步')
        lines.push('1. 检查 src/index.ts，修改代码实现你的业务逻辑')
        lines.push('2. 在 DSH 根目录运行本地测试：')
        lines.push('   ```powershell')
        lines.push(`   pnpm dsh web --patch ./scratch-plugin/${String(value.plugin_name ?? 'my-plugin')}/cordis.yml`)
        lines.push('   ```')
        lines.push('3. 确认功能正常后，再考虑发布到 GitHub / npm')

        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute(args) {
      const pluginName = String(args.plugin_name ?? '')
      const pluginType = String(args.plugin_type ?? 'tool')
      const description = String(args.description ?? '')
      const features = String(args.features ?? '')
      const targetDir = resolve(String(args.target_dir ?? ''))

      // 创建目录结构
      const dirs = ['src', 'skills', 'ui']
      for (const d of dirs) {
        mkdirSync(join(targetDir, d), { recursive: true })
      }

      // 生成 package.json
      const pkgJson = {
        name: pluginName,
        version: '0.1.0',
        description,
        type: 'module',
        main: 'src/index.ts',
        files: ['src', 'skills', 'ui', 'cordis.patch.yml'],
        dsh: { bundle: { patch: './cordis.patch.yml' } },
        peerDependencies: {
          '@deepseek-ai/cordis': '*',
          '@deepseek-ai/dsh-tools': '*',
        },
        keywords: ['dsh-plugin', pluginName],
      }
      writeFileSync(join(targetDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8')

      // 生成 cordis.patch.yml
      const patchYml = `- insert:\n  - id: ${pluginName}\n    name: ${pluginName}\n`
      writeFileSync(join(targetDir, 'cordis.patch.yml'), patchYml, 'utf-8')

      // 生成 cordis.yml（本地开发用）
      const devYml = `- insert:\n  - id: ${pluginName}\n    name: 'file:///${join(targetDir, 'src/index.ts').replace(/\\/g, '/')}'\n`
      writeFileSync(join(targetDir, 'cordis.yml'), devYml, 'utf-8')

      // 生成 .gitignore
      writeFileSync(join(targetDir, '.gitignore'), 'node_modules/\ndist/\n*.tgz\n', 'utf-8')

      // 根据类型生成不同模板
      const code = generatePluginCode(pluginName, pluginType, description, features)
      writeFileSync(join(targetDir, 'src/index.ts'), code, 'utf-8')

      // 生成 README.md
      const readme = `# ${pluginName}\n\n${description}\n\n## 安装\n\n\`\`\`powershell\ndsh plugin --profile web add ${pluginName}\n\`\`\`\n\n## 使用\n\n正在开发中...\n`
      writeFileSync(join(targetDir, 'README.md'), readme, 'utf-8')

      const generatedFiles = [
        'package.json',
        'src/index.ts',
        'cordis.patch.yml',
        'cordis.yml',
        '.gitignore',
        'README.md',
      ]

      // 按类型补充额外文件
      if (pluginType === 'web-ui' || pluginType === 'combo') {
        writeFileSync(join(targetDir, 'ui/index.html'), generateHtml(), 'utf-8')
        generatedFiles.push('ui/index.html')
      }
      if (pluginType === 'skill' || pluginType === 'combo') {
        const skillMd = `# ${pluginName} 领域知识\n\n## 概述\n\n${description}\n\n## 使用指南\n\n正在开发中...\n`
        writeFileSync(join(targetDir, 'skills/guide.md'), skillMd, 'utf-8')
        generatedFiles.push('skills/guide.md')
      }

      return {
        created: true,
        files: generatedFiles,
        message: `插件项目已生成到：${targetDir}\n\n包含 ${generatedFiles.length} 个文件，请检查 src/index.ts 中的业务逻辑，按需修改。`,
        plugin_name: pluginName,
      }
    },
  } as Tool))

  // ============================================================
  // 工具 2：检查插件项目结构
  // ============================================================

  ctx.tools.register(defineTool({
    name: 'dsh_plugin_check',
    description: '检查 DSH 插件项目结构是否完整，验证 package.json、cordis.patch.yml 等关键文件',
    parameters: {
      project_path: { type: 'string', required: true, description: '插件项目目录路径' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          valid: { type: 'boolean' },
          checks: { type: 'array' },
          suggestions: { type: 'array' },
        },
      },
      render(args: Record<string, unknown>, value: Record<string, unknown>) {
        const lines: string[] = ['# 插件结构检查报告', '']
        lines.push('整体状态：' + (value.valid ? '✅ 通过' : '❌ 有问题'))

        if (value.checks && Array.isArray(value.checks)) {
          for (const c of value.checks) {
            const item = c as Record<string, unknown>
            lines.push('- ' + (item.passed ? '✅' : '❌') + ' ' + String(item.name ?? ''))
          }
        }

        if (value.suggestions && Array.isArray(value.suggestions) && value.suggestions.length > 0) {
          lines.push('', '## 改进建议')
          for (const s of value.suggestions) {
            lines.push('- ' + String(s))
          }
        }

        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute(args) {
      const projectPath = resolve(String(args.project_path ?? ''))
      const checks: Array<{ name: string; passed: boolean }> = []
      const suggestions: string[] = []

      // 检查必须文件
      const requiredFiles = [
        { name: 'package.json 存在', path: 'package.json' },
        { name: 'package.json 包含 name 字段', path: 'package.json', checkName: true },
        { name: 'cordis.patch.yml 存在', path: 'cordis.patch.yml' },
        { name: 'src/index.ts 存在', path: 'src/index.ts' },
      ]

      for (const f of requiredFiles) {
        const fullPath = join(projectPath, f.path)
        const exists = existsSync(fullPath)

        if (f.path === 'package.json' && f.checkName) {
          if (exists) {
            try {
              const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'))
              checks.push({ name: 'package.json 包含 name 字段', passed: !!pkg.name })
              if (!pkg.name) suggestions.push('package.json 缺少 name 字段')
            } catch {
              checks.push({ name: 'package.json 格式正确', passed: false })
              suggestions.push('package.json 格式错误，请检查 JSON 语法')
            }
          } else {
            checks.push({ name: 'package.json 包含 name 字段', passed: false })
          }
        } else {
          checks.push({ name: f.name, passed: exists })
          if (!exists) suggestions.push(`缺少文件：${f.path}`)
        }
      }

      // 检查 package.json 中的 peerDependencies
      const pkgPath = join(projectPath, 'package.json')
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
          if (!pkg.peerDependencies) {
            suggestions.push('package.json 缺少 peerDependencies 字段')
          } else {
            if (!pkg.peerDependencies['@deepseek-ai/cordis']) {
              suggestions.push('peerDependencies 缺少 @deepseek-ai/cordis')
            }
            if (!pkg.peerDependencies['@deepseek-ai/dsh-tools']) {
              suggestions.push('peerDependencies 缺少 @deepseek-ai/dsh-tools')
            }
          }
          if (!pkg.files || !Array.isArray(pkg.files)) {
            suggestions.push('package.json 缺少 files 字段（发布时只会包含 files 里的文件）')
          }
          if (!pkg.dsh?.bundle?.patch) {
            suggestions.push('package.json 缺少 dsh.bundle.patch 配置')
          }
        } catch {
          // 忽略
        }
      }

      // 检查 cordis.patch.yml
      const patchPath = join(projectPath, 'cordis.patch.yml')
      if (existsSync(patchPath)) {
        const content = readFileSync(patchPath, 'utf-8')
        if (!content.includes('insert:')) {
          suggestions.push('cordis.patch.yml 格式可能不正确，需要包含 insert 指令')
        }
      }

      // 检查 README
      if (!existsSync(join(projectPath, 'README.md'))) {
        suggestions.push('建议添加 README.md 说明文档')
      }

      const valid = checks.every(c => c.passed)
      return { valid, checks, suggestions }
    },
  } as Tool))

  // ============================================================
  // 工具 3：发布指南
  // ============================================================

  ctx.tools.register(defineTool({
    name: 'dsh_plugin_publish_guide',
    description: '获取 DSH 插件发布的完整步骤指南：GitHub 仓库创建、npm 发布、dsh-plugin 标签设置',
    parameters: {
      target: {
        type: 'string',
        description: '发布目标：github / npm',
        enum: ['github', 'npm'],
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: { guide: { type: 'string' } },
      },
      render(args: Record<string, unknown>, value: Record<string, unknown>) {
        return [{ type: 'text', text: String(value.guide ?? '') }]
      },
    },
    async execute(args) {
      const target = String(args.target ?? '')
      let guide = '# DSH 插件发布指南\n\n'

      guide += '## 发布前检查清单\n\n'
      guide += '请先用 `dsh_plugin_check` 工具检查项目结构，确认没有问题后再发布。\n\n'

      guide += '---\n\n## 1. 发布到 GitHub\n\n'
      guide += '```powershell\n'
      guide += '# 初始化 Git 仓库\n'
      guide += 'cd 你的插件目录\n'
      guide += 'git init\n'
      guide += 'git add .\n'
      guide += 'git commit -m "feat: initial release"\n\n'
      guide += '# 创建 GitHub 仓库并推送\n'
      guide += 'gh repo create 你的仓库名 --public --source . --push\n\n'
      guide += '# 打上 dsh-plugin 标签（重要！别人才能搜到）\n'
      guide += 'gh repo edit --add-topic dsh-plugin\n'
      guide += '```\n\n'
      guide += '> 💡 `dsh-plugin` 标签是必须的！DSH 社区通过这个标签发现插件。\n\n'

      if (!target || target !== 'github') {
        guide += '---\n\n## 2. 发布到 npm\n\n'
        guide += '```powershell\n'
        guide += '# 登录 npm\n'
        guide += 'npm login\n\n'
        guide += '# 发布\n'
        guide += 'npm publish --access public\n'
        guide += '```\n\n'
        guide += '> 💡 如果 npm 账号开启了 2FA，需要生成 Automation Token 来发布。\n\n'
      }

      guide += '---\n\n## 3. 别人安装你的插件\n\n'
      guide += '```powershell\n'
      guide += '# 从 GitHub 安装\n'
      guide += 'dsh plugin --profile web add github:你的用户名/仓库名\n\n'
      guide += '# 从 npm 安装\n'
      guide += 'dsh plugin --profile web add 你的npm包名\n'
      guide += '```\n\n'

      guide += '---\n\n## 4. 发布后维护\n\n'
      guide += '- 更新版本：改 package.json 中的 version，重新 `npm publish`\n'
      guide += '- 更新 GitHub：`git add . && git commit -m "..." && git push`\n'
      guide += '- 打标签：`git tag v0.1.1 && git push --tags`\n'

      return { guide }
    },
  } as Tool))

  // ============================================================
  // 工具 4：学习路径
  // ============================================================

  ctx.tools.register(defineTool({
    name: 'dsh_plugin_learning_path',
    description: '获取 DSH 插件开发的完整学习路径，从零基础到独立发布',
    parameters: {
      experience: {
        type: 'string',
        description: '经验水平：beginner（零基础）/ intermediate（有基础）/ advanced（进阶）',
        enum: ['beginner', 'intermediate', 'advanced'],
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: { path: { type: 'string' } },
      },
      render(args: Record<string, unknown>, value: Record<string, unknown>) {
        return [{ type: 'text', text: String(value.path ?? '') }]
      },
    },
    async execute(args) {
      const level = String(args.experience ?? 'beginner')

      const paths: Record<string, string> = {
        beginner: `# 🎯 零基础学习路径（约 2-3 小时）

## 阶段 1：理解插件是什么（15 分钟）
一个 DSH 插件 = 一个目录，里面有几个文件：
- package.json — 插件身份证
- src/index.ts — 插件代码
- cordis.patch.yml — 告诉 DSH 怎么加载

## 阶段 2：Hello World（30 分钟）
1. 创建项目目录
2. 编写最简插件代码
3. 用 pnpm dsh web --patch 测试加载
4. 看到日志输出 "插件已加载"

## 阶段 3：工具插件（45 分钟）
工具 = 对话中可以调用的功能
- 用 defineTool 注册工具
- 理解 parameters 和 output
- 编写 execute 实现业务逻辑
- 测试：在对话中调用工具

## 阶段 4：高级功能（45 分钟）
- 事件监听：监听消息发送、工具执行等事件
- 技能注入：给 AI 注入专业知识
- Web UI：提供网页界面

## 阶段 5：打包发布（30 分钟）
- 创建 package.json + cordis.patch.yml
- 发布到 GitHub（打 dsh-plugin 标签）
- 发布到 npm
- 别人一行命令安装`,

        intermediate: `# 🚀 有基础学习路径（1-2 小时）

## 阶段 1：快速回顾
- 插件核心导出：name / inject / Config / apply
- 工具注册 DSL
- 事件系统

## 阶段 2：进阶技巧
- 三段式插件设计
- 可选服务 vs 硬依赖（ctx.get vs inject）
- 插件配置 Config Schema

## 阶段 3：Web UI 集成
- webServer 路由注册
- tapIndex 注入
- 前后端数据交互

## 阶段 4：发布最佳实践
- 包体积优化（files 字段）
- README 规范
- 版本管理策略`,

        advanced: `# 🔥 进阶学习路径

- 动态 Cordis 插件（运行时创建/修改）
- Host-Client 双向通信
- Slot 系统注册
- 主题定制
- 动态模型工具注册
- AgentPresets 预设系统`,
      }

      return { path: paths[level] || paths['beginner'] }
    },
  } as Tool))

  // ============================================================
  // 工具 5：开发指南
  // ============================================================

  ctx.tools.register(defineTool({
    name: 'dsh_plugin_dev_guide',
    description: '获取特定主题的 DSH 插件开发详细指南。主题：init/develop/test/publish/config/event/skill/schema',
    parameters: {
      topic: {
        type: 'string',
        required: true,
        description: '指南主题',
        enum: ['init', 'develop', 'test', 'publish', 'config', 'event', 'skill', 'schema'],
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: { guide: { type: 'string' } },
      },
      render(args: Record<string, unknown>, value: Record<string, unknown>) {
        return [{ type: 'text', text: String(value.guide ?? '') }]
      },
    },
    async execute(args) {
      const topic = String(args.topic ?? '')

      const guides: Record<string, string> = {
        init: `# 初始化 DSH 插件项目

## 前提条件
- Node.js >= 22.19
- pnpm >= 10
- Git

## 环境准备
\`\`\`powershell
npm install -g pnpm
\`\`\`

## 创建插件目录
\`\`\`powershell
mkdir -p scratch-plugin/my-plugin/src
\`\`\`

## 创建最简插件
\`\`\`typescript
import type { Context } from "@deepseek-ai/cordis"

export const name = "my-plugin"

export function apply(ctx: Context) {
  ctx.logger.info("我的插件已加载！")
}
\`\`\`

## 创建挂载配置（cordis.yml）
\`\`\`yaml
- insert:
  - id: my-plugin
    name: "./src/index.ts"
\`\`\`

## 测试加载
\`\`\`powershell
pnpm dsh web --patch ./scratch-plugin/my-plugin/cordis.yml
\`\`\``,

        develop: `# 编写 DSH 插件代码

## 核心导出
- name：插件名称（必须）
- inject：依赖的服务列表（可选）
- Config：插件配置 Schema（可选）
- apply(ctx, config)：插件主体（必须）

## 注册工具
- 使用 defineTool 定义工具
- parameters 定义模型参数
- output.schema 必须加 additionalProperties: true
- render 函数将结果转为模型可见文本
- execute 实现业务逻辑

## 常见错误
1. ❌ output schema 缺少 additionalProperties: true
2. ❌ 用 inject 获取可选服务（应该用 ctx.get）
3. ❌ waterfall 事件忘记调用 next()
4. ❌ 使用 default export 而不是命名导出`,

        test: `# 测试 DSH 插件

## 1. 手动测试
\`\`\`powershell
pnpm dsh web --patch ./cordis.yml
\`\`\`

## 2. 配置树验证
\`\`\`powershell
pnpm dsh --profile web --dump-config --patch ./cordis.yml
\`\`\`

## 3. 本地安装测试
\`\`\`powershell
dsh plugin --profile web add ./scratch-plugin/my-plugin
\`\`\``,

        publish: `# 打包发布 DSH 插件

## 1. 创建 package.json
- name: dsh-插件名
- type: module
- main: src/index.ts
- dsh.bundle.patch: ./cordis.patch.yml
- peerDependencies: 声明运行时依赖

## 2. 创建 cordis.patch.yml
注意：name 用 npm 包名，不是相对路径！

## 3. 发布到 GitHub
- gh repo create --public
- gh repo edit --add-topic dsh-plugin

## 4. 发布到 npm
- npm login
- npm publish --access public

## 5. 安装验证
\`\`\`powershell
dsh plugin --profile web add 你的npm包名
\`\`\``,

        config: `# DSH 插件配置详解

## cordis.yml 语法
- insert: 插入新插件
- id: 唯一标识
- name: 插件路径或包名
- disabled: 禁用插件
- config: 插件配置

## 本地开发 vs 发布
- 本地：cordis.yml + 相对路径
- 发布：cordis.patch.yml + npm 包名`,

        event: `# DSH 事件系统

## 事件类型
- emit：只读观察，不能修改数据
- waterfall：可修改或拦截，必须调 next()
- serial：串行执行

## 常用事件
- tools/pre-execute：工具执行前拦截
- tools/execute：包裹工具执行
- tools/result：只读观察结果

## 关键规则
- Waterfall 必须调 next()
- emit 不能修改数据`,

        skill: `# 技能注入

## 创建 Skill 文件
用 Markdown 写领域知识

## 注册方式
\`\`\`typescript
const skills = ctx.get("skills")
if (skills) {
  skills.register({
    name: "my-guide",
    description: "描述",
    content: readFileSync(...),
    source: "runtime",
    provider: "my-plugin",
  })
}
\`\`\`
注意：用 ctx.get 而不是 inject`,

        schema: `# Schema 规范

## 致命陷阱
object 类型必须加 additionalProperties: true

## 正确写法
\`\`\`typescript
output: {
  schema: {
    type: "object",
    additionalProperties: true,
    properties: { ... }
  }
}
\`\`\`

## 常见错误
1. 缺少 additionalProperties: true
2. 使用 default export
3. inject 声明可选服务
4. waterfall 忘记 next()`,
      }

      return { guide: guides[topic] || '未知主题，可用主题：init / develop / test / publish / config / event / skill / schema' }
    },
  } as Tool))
}

// ============================================================
// 辅助函数：生成不同类型插件的代码模板
// ============================================================

function generatePluginCode(
  name: string,
  type: string,
  description: string,
  _features: string,
): string {
  const lines: string[] = [
    '/**',
    ` * ${name} - ${description}`,
    ' */',
    '',
    "import type { Context } from '@deepseek-ai/cordis'",
    "import { defineTool } from '@deepseek-ai/dsh-tools'",
    '',
    'export const name = ' + JSON.stringify(name),
    '',
    'export function apply(ctx: Context) {',
    '  ctx.logger.info(`${name} 已加载`)',
    '',
  ]

  if (type === 'tool' || type === 'combo') {
    lines.push('  // 注册工具')
    lines.push('  ctx.tools.register(defineTool({')
    lines.push('    name: ' + JSON.stringify(name.replace(/^dsh-?/, '').replace(/-/g, '_') + '_query'))
    lines.push('    description: ' + JSON.stringify(description))
    lines.push('    parameters: {')
    lines.push('      input: { type: "string", required: true, description: "输入参数" },')
    lines.push('    },')
    lines.push('    output: {')
    lines.push('      schema: {')
    lines.push('        type: "object",')
    lines.push('        additionalProperties: true,')
    lines.push('        properties: { result: { type: "string" } },')
    lines.push('      },')
    lines.push('      render(args, value) {')
    lines.push('        return [{ type: "text", text: String(value.result ?? "") }]')
    lines.push('      },')
    lines.push('    },')
    lines.push('    async execute(args) {')
    lines.push('      // TODO: 实现你的业务逻辑')
    lines.push('      return { result: `你输入了：${args.input}` }')
    lines.push('    },')
    lines.push('  }))')
    lines.push('')
  }

  if (type === 'event') {
    lines.push('  // 监听事件')
    lines.push('  ctx.on("message/before-send", (payload) => {')
    lines.push('    ctx.logger.info("消息事件触发")')
    lines.push('  })')
    lines.push('')
  }

  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

function generateHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>插件仪表盘</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #58a6ff; margin-bottom: 20px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .card h2 { color: #f0f6fc; font-size: 16px; margin-bottom: 8px; }
    .card p { color: #8b949e; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔧 插件仪表盘</h1>
    <div class="card">
      <h2>状态</h2>
      <p>插件已加载，正在开发中...</p>
    </div>
  </div>
</body>
</html>`
}