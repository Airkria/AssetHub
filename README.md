# AssetHub

NAS 资产库索引与管理中枢（自研）。面向游戏资产工作流，把「美术设定 / 资产库 / 工具 / 教程 / 输出」五个板块集中到一个软件里，用标签 + 元数据替代"一层层翻文件夹"。

## 功能特性

- **5 大工作流板块**：美术设定（灵感参考）、资产库（可用素材）、工具、教程、输出（版本回溯）
- **多库管理**：多个 NAS 路径独立索引、切换查看，连接状态实时显示
- **包体 ↔ 预览图自动匹配**：同名 / `_preview` 后缀 / 数字后缀（`_1` `_2`），支持多张预览
- **匹配规则可配置**：扫描范围（限制/排除）、扩展名分类、预览文件格式白名单
- **配置文件共享**：`public_xxx.json`（全局）/ `personal_xxx.json`（个人），团队一键同步规则
- **元数据标注**：标签（现有 + 自定义）、说明、官网链接，随使用逐步沉淀
- **文件操作**：应用内重命名（保留后缀）、删除、打开位置
- **缩略图调节**：滑块 + Ctrl+滚轮

## 技术栈

Tauri 2 + React 19 + TypeScript + Vite + Tailwind CSS 3.4 + shadcn/ui（前端），Rust（后端扫描/索引/命令）。

## 目录结构（模块化）

```
src/                    前端
├── api/                Tauri 命令封装
├── store/              状态层（LibraryContext）
├── hooks/              复用 Hook（缩略图大小等）
├── components/         ui/（shadcn 组件）+ layout/ + TagEditor
├── modules/            5 个板块 + Settings
└── lib/                工具函数（路径判断等）
src-tauri/src/          后端 Rust
├── models.rs           数据模型（Asset/Config/MatchRules）
├── config.rs           应用配置读写
├── matcher.rs          匹配规则（范围/分类/预览图）
├── scanner.rs          扫描 + 预览图关联
├── store.rs            索引持久化（预留 SQLite）
└── commands.rs         Tauri 命令层
```

## 快速开始

```bash
npm install
npm run tauri dev     # 桌面应用（需装 Rust）
npm run tauri build   # 打包发布
```

## 数据与缓存

| 数据 | 位置 |
|---|---|
| 索引（元数据） | `%APPDATA%\com.assethub.app\index_<库id>.json` |
| 应用配置 | `%APPDATA%\com.assethub.app\config.json` |
| 配置文件 | 用户自选路径（`public_xxx.json` / `personal_xxx.json`） |

- 缓存默认在 C 盘应用数据目录，设置里会提示建议迁到 SSD
- 索引按防膨胀设计：只存元数据；缩略图只存小图（256px 有损）+ LRU 上限，不缓存原图

## 版本历史

- **v1.3.0**（2026-10-08）：增量扫描——重扫保留未变文件的元数据（标签/说明/链接）
- **v1.2.0**（2026-10-08）：并行扫描（ignore WalkParallel，慢 NAS 上显著提速）
- **v1.1.0**（2026-10-08）：资产库 / 美术设定虚拟滚动（@tanstack/react-virtual，数万项流畅滚动）
- **v1.0.0**（2026-10-08）：8 大需求点全部落地（多库 / 匹配规则 / 配置文件系统 / 美术设定 / 资产库 / 工具板块）

## 路线图

- 拖拽到引擎 / 3D 预览 / IMG 解码 / 缩略图缓存
