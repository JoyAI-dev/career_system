# HeroUI 迁移 Master 执行文档

> **文档版本**: v1.0
> **生成日期**: 2026-03-14
> **项目**: career_system (学生职业探索平台)
> **迁移方向**: Shadcn UI (base-nova / @base-ui/react) → HeroUI v2
> **执行原则**: 分阶段、可验证、零回归

---

## 目录

1. [背景与目标](#1-背景与目标)
2. [当前架构分析](#2-当前架构分析)
3. [目标架构设计](#3-目标架构设计)
4. [组件映射总表](#4-组件映射总表)
5. [风险登记表](#5-风险登记表)
6. [跨模块关注点](#6-跨模块关注点)
7. [阶段划分与执行计划](#7-阶段划分与执行计划)
   - [Phase 0: 基础设施准备](#phase-0-基础设施准备)
   - [Phase 1: 认证模块](#phase-1-认证模块-epic-1)
   - [Phase 2: 偏好设置模块](#phase-2-偏好设置模块-epic-2)
   - [Phase 3: 问卷模块](#phase-3-问卷模块-epic-3)
   - [Phase 4: 仪表板模块](#phase-4-仪表板模块-epic-4)
   - [Phase 5: 活动模块](#phase-5-活动模块-epic-5)
   - [Phase 6: 认知报告模块](#phase-6-认知报告模块-epic-6)
   - [Phase 7: 个人资料与通知模块](#phase-7-个人资料与通知模块-epic-7)
   - [Phase 8: 聊天模块](#phase-8-聊天模块-epic-8)
   - [Phase 9: 管理员模块](#phase-9-管理员模块-epic-9)
   - [Phase 10: 清理与优化](#phase-10-清理与优化)
8. [验证策略](#8-验证策略)
9. [回滚方案](#9-回滚方案)
10. [附录](#10-附录)

---

## 1. 背景与目标

### 1.1 背景

career_system 当前使用 **Shadcn UI (base-nova 风格)**，基于 `@base-ui/react` 原语构建。该方案存在以下痛点：

- **视觉效果一般**：Shadcn 本质是无样式原语 + 手动 Tailwind 类，视觉效果依赖开发者的 CSS 功力
- **组件交互单薄**：缺少内建的动画、过渡效果，交互体验不够现代
- **维护成本高**：22 个 UI 组件完全由项目自维护，每个组件的 CSS 类长度惊人（部分超过 500 字符）
- **可拓展性受限**：添加新组件需要从零配置，缺少主题系统

### 1.2 目标

迁移到 **HeroUI v2**（原 NextUI），实现：

| 目标 | 描述 |
|------|------|
| **视觉升级** | 利用 HeroUI 内建的现代设计系统，提升整体 UI 质感 |
| **动画增强** | 通过 framer-motion 获得丝滑的过渡动画 |
| **开发效率** | 减少手写 CSS，使用 HeroUI 内建 variant/size 系统 |
| **主题一致性** | 统一的设计 token 系统，支持 Light/Dark 模式 |
| **零功能回归** | 所有现有功能必须 100% 保留，通过浏览器验证 |

### 1.3 技术兼容性确认

| 依赖 | 当前版本 | HeroUI 要求 | 状态 |
|------|---------|------------|------|
| React | 19.2.3 | ≥18 | ✅ 兼容 |
| Next.js | 16.1.6 | ≥13 (App Router) | ✅ 兼容 |
| TailwindCSS | 4.x | v4 支持 | ✅ 兼容 |
| next-themes | 0.4.6 | 内建支持 | ✅ 兼容 |
| TypeScript | 5.x | 完整类型支持 | ✅ 兼容 |

---

## 2. 当前架构分析

### 2.1 技术栈概览

```
Next.js 16.1.6 (App Router / RSC)
├── React 19.2.3
├── TailwindCSS 4.x (无 tailwind.config.ts，使用 @theme inline)
├── Shadcn UI (base-nova 风格)
│   ├── @base-ui/react ^1.2.0 (底层原语)
│   ├── class-variance-authority ^0.7.1 (变体系统)
│   └── tw-animate-css ^1.4.0 (动画)
├── next-intl ^4.8.3 (i18n: zh/en/fr)
├── next-themes ^0.4.6 (暗色模式)
├── Recharts ^3.8.0 (图表)
├── FullCalendar ^6.1.20 (日历)
├── @uiw/react-md-editor ^4.0.11 (Markdown 编辑器)
├── sonner ^2.0.7 (Toast 通知)
├── cmdk ^1.1.1 (命令面板)
├── vaul ^1.1.2 (Drawer 抽屉)
└── lucide-react ^0.577.0 (图标)
```

### 2.2 UI 组件清单 (22 个)

| # | 组件文件 | 基于 | 被引用模块 | 迁移难度 |
|---|---------|------|----------|---------|
| 1 | `button.tsx` | @base-ui/react/button + CVA | 全局 (60+ 处) | 中 |
| 2 | `card.tsx` | 原生 HTML | 全局 (20+ 处) | 低 |
| 3 | `dialog.tsx` | @base-ui/react/dialog | 8+ 业务组件 | 高 |
| 4 | `dropdown-menu.tsx` | @base-ui/react/menu | Header, NotificationBell | 高 |
| 5 | `input.tsx` | 原生 HTML | Auth, Profile, Admin 表单 | 低 |
| 6 | `label.tsx` | @base-ui/react/label | 表单页面 | 低 |
| 7 | `select.tsx` | @base-ui/react/select | Profile, Admin, 活动 | 高 |
| 8 | `tabs.tsx` | @base-ui/react/tabs + CVA | Dashboard, DimensionNav, Admin | 高 |
| 9 | `table.tsx` | 原生 HTML | Admin 列表页 (8+ 处) | 中 |
| 10 | `textarea.tsx` | 原生 HTML | Chat @mention, 评论 | 中 |
| 11 | `tooltip.tsx` | @base-ui/react/tooltip | TooltipProvider 全局包装 | 中 |
| 12 | `avatar.tsx` | 原生 HTML | Header, Chat, 用户列表 | 低 |
| 13 | `badge.tsx` | CVA | 标签, 状态显示 | 低 |
| 14 | `separator.tsx` | 原生 HTML | Layout 分隔 | 低 |
| 15 | `scroll-area.tsx` | @base-ui/react/scroll-area | Chat, Admin 列表 | 中 |
| 16 | `switch.tsx` | @base-ui/react/switch | Admin 设置 | 低 |
| 17 | `popover.tsx` | @base-ui/react/popover | Calendar 事件详情 | 中 |
| 18 | `sheet.tsx` | @base-ui/react/dialog (侧面板) | Header 移动端菜单 | 高 |
| 19 | `drawer.tsx` | vaul | StudentNetworkDrawer | 高 |
| 20 | `command.tsx` | cmdk | 命令面板 (若有使用) | 中 |
| 21 | `sonner.tsx` | sonner | 全局 Toast | 低 |
| 22 | `input-group.tsx` | 原生 HTML | 搜索框组合 | 低 |

### 2.3 业务组件清单 (40 个)

```
src/components/
├── ActivityCard.tsx              # 活动卡片
├── ActivityCardsRow.tsx          # 活动卡片行
├── ActivityDetailDialog.tsx      # 活动详情弹窗 (~830行，最复杂)
├── ActivityGuideView.tsx         # 活动引导视图
├── ActivityJourneyFlow.tsx       # 活动旅程流程
├── ActivityStepper.tsx           # 活动步进器
├── ActivityTracker.tsx           # 活动追踪器
├── AnnouncementPopup.tsx         # 公告弹窗 (⚠️ 使用 eventDetails.cancel)
├── AnswerComments.tsx            # 答题评论
├── Calendar.tsx                  # 日历组件 (FullCalendar)
├── CognitiveRadarChart.tsx       # 认知雷达图 (Recharts)
├── CompetitionPanel.tsx          # 竞赛面板
├── DimensionNav.tsx              # 维度导航 (⚠️ 垂直 Tabs + IntersectionObserver)
├── FloatingReportButton.tsx      # 浮动报告按钮
├── Header.tsx                    # 顶部导航栏 (Sheet + DropdownMenu)
├── LandingCalendar.tsx           # 首页日历
├── LanguageSwitcher.tsx          # 语言切换器
├── MarkdownEditor.tsx            # Markdown 编辑器
├── MiniToolbar.tsx               # 迷你工具栏
├── NotificationBell.tsx          # 通知铃铛 (⚠️ 自定义 DropdownMenu 内容)
├── PairingPanel.tsx              # 配对面板
├── QuestionReflections.tsx       # 问题反思
├── SecondaryNavBar.tsx           # 二级导航栏
├── SectionProgress.tsx           # 章节进度
├── SessionProvider.tsx           # 会话提供者
├── Sidebar.tsx                   # 侧边栏 (Admin)
├── VirtualGroupInfo.tsx          # 虚拟小组信息
├── admin/
│   ├── SchedulingConfigEditor.tsx  # 排课配置编辑器
│   ├── StandbyManager.tsx          # 待机管理器
│   └── VirtualGroupAdmin.tsx       # 虚拟小组管理
├── chat/
│   ├── ChatMessage.tsx           # 聊天消息
│   ├── ChatPopup.tsx             # 聊天弹窗
│   ├── ChatProvider.tsx          # 聊天上下文 (WebSocket)
│   ├── ChatSidePanel.tsx         # 聊天侧面板
│   ├── ContactList.tsx           # 联系人列表
│   ├── ExternalLinkWarning.tsx   # 外链警告
│   ├── FloatingChatButton.tsx    # 浮动聊天按钮
│   ├── MessageArea.tsx           # 消息区域
│   ├── MessageInput.tsx          # 消息输入 (⚠️ @mention 系统)
│   └── StudentNetworkDrawer.tsx  # 学生网络抽屉 (⚠️ vaul Drawer)
```

### 2.4 页面清单 (36 个路由)

| 路由组 | 页面 | 复杂度 |
|--------|------|--------|
| `(auth)` | `/login`, `/register` | 低 |
| `(preferences)` | `/preferences` | 中 |
| `(questionnaire)` | `/questionnaire` | 高 |
| `(main)` | `/dashboard` | 高 |
| `(main)` | `/activities` | 高 |
| `(main)` | `/calendar` | 中 |
| `(main)` | `/cognitive-report`, `/cognitive-report/[snapshotId]` | 中 |
| `(main)` | `/notifications` | 低 |
| `(main)` | `/profile` | 中 |
| `(main)` | `/questionnaire-update` | 高 |
| `admin` | `/admin` (仪表板) | 中 |
| `admin` | `/admin/users`, `/admin/users/[id]` | 中 |
| `admin` | `/admin/questionnaire`, `/admin/questionnaire/[questionId]/options` | 高 |
| `admin` | `/admin/activities`, `/admin/activities/new`, `/admin/activities/[id]/edit` | 高 |
| `admin` | `/admin/activity-types` | 中 |
| `admin` | `/admin/tags` | 低 |
| `admin` | `/admin/grades` | 低 |
| `admin` | `/admin/announcements` | 中 |
| `admin` | `/admin/recruitment` | 中 |
| `admin` | `/admin/preferences` | 中 |
| `admin` | `/admin/settings` | 低 |
| `admin` | `/admin/communities` | 中 |
| `admin` | `/admin/chat-stats` | 低 |
| 根 | `/` (Landing) | 低 |

### 2.5 CSS 设计系统

**文件**: `src/app/globals.css`

**结构**:
```css
@import "tailwindcss";      /* TailwindCSS v4 核心 */
@import "tw-animate-css";    /* 动画库 → 需替换为 framer-motion */
@import "shadcn/tailwind.css"; /* Shadcn 基础样式 → 需移除 */

@theme inline {
  /* 50+ CSS 变量映射到 Tailwind 工具类 */
  --color-primary: var(--primary);
  --color-background: var(--background);
  /* ... */
}

:root { /* 亮色模式 - oklch 色彩空间 */ }
.dark { /* 暗色模式 - oklch 色彩空间 */ }
```

**关键特征**:
- 使用 **oklch 色彩空间**（非 hex/hsl）
- 50+ CSS 变量通过 `@theme inline` 桥接到 Tailwind
- 无 `tailwind.config.ts` 文件，配置内联在 CSS 中
- 自定义 FullCalendar 样式 (`.fc-event-projected`)

### 2.6 Provider 链

```
RootLayout (layout.tsx)
└── NextIntlClientProvider     ← i18n
    └── Toaster (sonner)       ← Toast 通知

MainLayout ((main)/layout.tsx)
└── SessionProvider            ← Auth 会话
    └── TooltipProvider        ← Tooltip 全局 (可移除)
        └── ChatProvider       ← WebSocket 聊天
            ├── Header
            ├── Sidebar (admin only)
            ├── SecondaryNavBar (student only)
            ├── {children}     ← 页面内容
            ├── FloatingChatButton
            ├── ChatPopup
            ├── StudentNetworkDrawer
            └── AnnouncementPopup (student only)
```

---

## 3. 目标架构设计

### 3.1 技术栈变更

```diff
  Next.js 16.1.6 (App Router / RSC)
  ├── React 19.2.3
  ├── TailwindCSS 4.x
- ├── Shadcn UI (base-nova)
- │   ├── @base-ui/react ^1.2.0
- │   ├── class-variance-authority ^0.7.1
- │   └── tw-animate-css ^1.4.0
+ ├── HeroUI v2
+ │   ├── @heroui/react (统一包)
+ │   └── framer-motion (动画引擎)
  ├── next-intl ^4.8.3
  ├── next-themes ^0.4.6
  ├── Recharts ^3.8.0
  ├── FullCalendar ^6.1.20
  ├── @uiw/react-md-editor ^4.0.11
  ├── sonner ^2.0.7 (保留)
  ├── cmdk ^1.1.1 (保留)
- ├── vaul ^1.1.2 (迁移完成后移除)
  └── lucide-react ^0.577.0 (保留)
```

### 3.2 依赖变更计划

**新增**:
```json
{
  "@heroui/react": "^2.8.10",
  "framer-motion": "^11.x"
}
```

**Phase 10 移除**（全部迁移完成后）:
```json
{
  "@base-ui/react": "^1.2.0",
  "class-variance-authority": "^0.7.1",
  "tw-animate-css": "^1.4.0",
  "shadcn": "^4.0.2",
  "vaul": "^1.1.2"
}
```

**保留**:
```json
{
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.5.0",
  "lucide-react": "^0.577.0",
  "sonner": "^2.0.7",
  "cmdk": "^1.1.1",
  "next-themes": "^0.4.6"
}
```

### 3.3 目标 Provider 链

```
RootLayout (layout.tsx)
└── NextIntlClientProvider     ← i18n (不变)
    └── HeroUIProvider          ← 🆕 HeroUI 主题 + framer-motion
        └── Toaster (sonner)   ← Toast (保留 sonner)

MainLayout ((main)/layout.tsx)
└── SessionProvider            ← Auth (不变)
    └── ChatProvider           ← WebSocket (不变)
        ├── Header
        ├── Sidebar (admin)
        ├── SecondaryNavBar (student)
        ├── {children}
        ├── FloatingChatButton
        ├── ChatPopup
        ├── StudentNetworkDrawer
        └── AnnouncementPopup

注: TooltipProvider 被移除，HeroUI Tooltip 不需要全局 Provider
```

---

## 4. 组件映射总表

### 4.1 直接替换 (16 个)

| Shadcn 组件 | HeroUI 组件 | API 差异 | 备注 |
|------------|------------|---------|------|
| `Button` | `Button` | `disabled`→`isDisabled`, `onClick`→`onPress`, 增加 `color`/`radius` | CVA variants → HeroUI `variant`/`color`/`size` 属性 |
| `Card` / `CardHeader` / `CardBody` / `CardFooter` | `Card` / `CardHeader` / `CardBody` / `CardFooter` | 几乎相同 | 最简单的迁移 |
| `Dialog` | `Modal` / `ModalContent` / `ModalHeader` / `ModalBody` / `ModalFooter` | `open`→`isOpen`, `onOpenChange`→`onOpenChange`, 移除 `render` prop | ⚠️ `DialogClose render={<Button/>}` 需重写 |
| `Input` | `Input` | 增加 `label`/`description`/`errorMessage` 内建属性 | 可移除单独的 Label 组件 |
| `Textarea` | `Textarea` | 类似 Input | ⚠️ @mention 系统需验证 ref 转发 |
| `Select` | `Select` / `SelectItem` | 声明式 → 声明式，`onValueChange`→`onSelectionChange`(返回 Set) | API 差异显著，需逐处修改 |
| `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | `Tabs` / `Tab` | `value`→`selectedKey`, `onValueChange`→`onSelectionChange` | ⚠️ 垂直 Tabs 需 `isVertical` 属性 |
| `Table` | `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableCell` / `TableColumn` | 原生 HTML → 声明式（列定义方式不同） | ⚠️ API 完全不同，需重写列定义 |
| `Tooltip` | `Tooltip` | 更简洁的 API | 移除全局 TooltipProvider |
| `Avatar` | `Avatar` | `src`/`name`/`fallback` 属性映射 | 简单映射 |
| `Badge` | `Chip` | `variant`→`variant`+`color` | 语义相同，命名不同 |
| `Switch` | `Switch` | `checked`→`isSelected`, `onCheckedChange`→`onValueChange` | 简单映射 |
| `Separator` | `Divider` | 几乎相同 | 简单替换 |
| `Popover` | `Popover` / `PopoverTrigger` / `PopoverContent` | 类似 | 几乎相同 API |
| `DropdownMenu` | `Dropdown` / `DropdownTrigger` / `DropdownMenu` / `DropdownItem` | 组件拆分方式不同 | 需调整嵌套结构 |
| `ScrollArea` | `ScrollShadow` | 不同概念（虚拟滚动 vs 阴影指示） | 功能类似但实现不同 |

### 4.2 需特殊处理 (4 个)

| Shadcn 组件 | 处理方案 | 风险等级 |
|------------|---------|---------|
| `Sheet` (侧面板) | 使用 HeroUI `Modal` + `placement="right"` 或 `Drawer` | 高 |
| `Drawer` (vaul) | 使用 HeroUI `Modal` + `placement="bottom"` 或继续保留 vaul | 高 |
| `Label` | 移除，使用 HeroUI Input/Textarea 内建 `label` 属性 | 低 |
| `Command` (cmdk) | 保留 cmdk，它是独立库不依赖 Shadcn | 低 |

### 4.3 保留不变 (2 个)

| 组件 | 原因 |
|------|------|
| `sonner.tsx` | 独立库，仅是对 sonner 的薄封装，不依赖 @base-ui/react |
| `input-group.tsx` | 纯原生 HTML 封装，不依赖任何 UI 库 |

---

## 5. 风险登记表

### 🔴 高风险

| # | 风险项 | 影响范围 | 描述 | 缓解方案 |
|---|--------|---------|------|---------|
| R1 | AnnouncementPopup `eventDetails.cancel()` | 公告弹窗关闭逻辑 | Base UI Dialog 的 `onOpenChange` 提供 `eventDetails.cancel()` 阻止关闭，HeroUI Modal 无此 API | 使用 `isDismissable={false}` + 受控 `isOpen` 状态手动实现 |
| R2 | DimensionNav 垂直 Tabs + 数值 value | 认知报告维度导航 | 当前 Tabs 使用数值 value (0, 1, 2...) + 垂直布局 + IntersectionObserver 联动 | HeroUI Tabs 支持 `isVertical`，但 `selectedKey` 需为字符串；需转换值类型 |
| R3 | Dialog `render` prop 模式 | DialogClose, DialogTrigger | Shadcn 的 `<DialogClose render={<Button/>}>` 模式在 HeroUI 中不存在 | 改用常规 Button + `onPress={() => onClose()}` 模式 |
| R4 | Table API 完全不同 | Admin 模块 8+ 个列表页 | Shadcn Table 是原生 HTML 封装 `<tr><td>`，HeroUI Table 是声明式 `<TableColumn>` + `renderCell` | 工作量大但不复杂，逐页面重写 |
| R5 | Sheet 组件无直接对应 | Header 移动端菜单 | HeroUI 没有 Sheet 组件概念 | 使用 `Drawer` 组件（HeroUI v2.8+ 已有） 或 Modal(placement) |
| R6 | Chat MessageInput @mention ref | 聊天 @提及系统 | `Textarea` 的 `ref.current.setSelectionRange()` 需 HeroUI 支持原生 ref 转发 | 迁移前先测试 HeroUI Textarea ref 行为，必要时保留原生 textarea |

### 🟡 中风险

| # | 风险项 | 影响范围 | 描述 | 缓解方案 |
|---|--------|---------|------|---------|
| R7 | CSS 变量体系切换 | 全局样式 | oklch 变量需映射到 HeroUI 的 token 系统 | Phase 0 建立双轨变量体系，渐进迁移 |
| R8 | Button 自定义 size | 全局 | `xs`, `icon-xs`, `icon-sm`, `icon-lg` 等自定义尺寸在 HeroUI 中不存在 | 通过 `className` 或 HeroUI 的 `tw()` 扩展 |
| R9 | NotificationBell 自定义 DropdownMenu | 通知铃铛 | 当前 DropdownMenu 内嵌自定义内容（标题+列表+链接），不是标准菜单项 | 改用 Popover + 自定义内容，或使用 Dropdown 的 `children` 自定义 |
| R10 | 动画系统切换 | 全局 | `tw-animate-css` (CSS 动画) → `framer-motion` (JS 动画) | HeroUI 内建 framer-motion，但自定义动画类如 `data-open:animate-in` 需替换 |
| R11 | Select 返回值类型 | 表单页面 | Shadcn Select 返回 `string`，HeroUI Select 返回 `Set<Key>` | 每处使用都需要适配值转换 |

### 🟢 低风险

| # | 风险项 | 影响范围 | 描述 |
|---|--------|---------|------|
| R12 | cn() 工具函数 | 全局 | 保留不变，HeroUI 与 cn() 兼容 |
| R13 | lucide-react 图标 | 全局 | 保留不变，HeroUI 不强制使用特定图标库 |
| R14 | Recharts/FullCalendar | 图表/日历 | 独立库，不受 UI 库迁移影响 |
| R15 | i18n (next-intl) | 全局 | HeroUI 组件支持自定义 label/text，与 i18n 兼容 |
| R16 | sonner Toast | 全局 | 独立库，迁移期间保留，未来可选择换成 HeroUI 通知 |

---

## 6. 跨模块关注点

### 6.1 全局 API 名称映射表

迁移时需要全局注意的 API 名称变更：

```
Shadcn / HTML                    →  HeroUI
─────────────────────────────────────────────
disabled                         →  isDisabled
required                         →  isRequired
checked                          →  isSelected
open / defaultOpen               →  isOpen / defaultOpen
onClick                          →  onPress
onChange (string)                 →  onValueChange / onSelectionChange
onOpenChange(boolean)            →  onOpenChange(boolean)
value (string)                   →  selectedKey / selectedKeys (string/Set)
className="..."                  →  className="..." (保持一致)
variant="destructive"            →  color="danger"
variant="outline"                →  variant="bordered"
variant="ghost"                  →  variant="light"
variant="secondary"              →  variant="flat"
size="sm" / "default" / "lg"     →  size="sm" / "md" / "lg"
render={<Component/>}            →  as={Component} 或子元素模式
```

### 6.2 Button Variant 映射

```
Shadcn                           →  HeroUI
─────────────────────────────────────────────
variant="default"                →  color="primary"
variant="outline"                →  variant="bordered"
variant="secondary"              →  variant="flat"
variant="ghost"                  →  variant="light"
variant="destructive"            →  color="danger"
variant="link"                   →  as={Link} + variant="light"
size="xs"                        →  size="sm" + className="h-6 text-xs"
size="sm"                        →  size="sm"
size="default"                   →  size="md"
size="lg"                        →  size="lg"
size="icon"                      →  isIconOnly
size="icon-xs"                   →  isIconOnly + size="sm" + className="h-6 w-6"
size="icon-sm"                   →  isIconOnly + size="sm"
size="icon-lg"                   →  isIconOnly + size="lg"
```

### 6.3 CSS 变量双轨策略

在 Phase 0 中建立的双轨体系，让 HeroUI 和现有 Shadcn 组件共存：

```css
/* globals.css — Phase 0 新增 HeroUI 主题层 */

/* 保留现有 Shadcn 变量 (Phase 10 移除) */
:root {
  --background: oklch(0.98 0.005 230);
  --primary: oklch(0.55 0.15 230);
  /* ... 保持不变 ... */
}

/* 新增: HeroUI 主题变量映射 */
:root {
  /* HeroUI 使用 hsl，需建立映射 */
  /* 或者使用 HeroUI 的 createTheme 在 JS 中配置 */
}
```

**推荐方案**: 使用 HeroUI 的 `createTheme()` API 在 `tailwind.config` 或 Provider 中配置主题色，而非手写 CSS 变量。

### 6.4 i18n 集成模式

所有迁移后的 HeroUI 组件中的用户可见文本，必须继续使用 `useTranslations()`:

```tsx
// 迁移前 (Shadcn)
<Button variant="outline">{t('cancel')}</Button>

// 迁移后 (HeroUI) — 保持 i18n 不变
<Button variant="bordered">{t('cancel')}</Button>
```

HeroUI 组件的内建文本（如 Select 的 placeholder）也需要传入翻译后的字符串：
```tsx
<Select label={t('selectLanguage')} placeholder={t('pleaseSelect')}>
```

### 6.5 暗色模式集成

HeroUI 内建暗色模式支持，通过 `HeroUIProvider` 的 `theme` 属性与 `next-themes` 集成：

```tsx
// app/layout.tsx
import { HeroUIProvider } from '@heroui/react';
import { ThemeProvider } from 'next-themes';

<ThemeProvider attribute="class" defaultTheme="light">
  <HeroUIProvider>
    {children}
  </HeroUIProvider>
</ThemeProvider>
```

---

## 7. 阶段划分与执行计划

> **核心原则**: 每个 Phase 完成后必须通过 **浏览器手动验证**，确认所有功能正常后才能进入下一个 Phase。

---

### Phase 0: 基础设施准备

**目标**: 安装 HeroUI，配置 Provider，建立共存环境，确保新旧组件可以并行运行

**预计工时**: 2-3 小时

#### 任务清单

| # | 任务 | 详细描述 |
|---|------|---------|
| 0.1 | 安装 HeroUI 依赖 | `npm install @heroui/react framer-motion` |
| 0.2 | 配置 TailwindCSS 插件 | 在 `globals.css` 中添加 HeroUI 的 Tailwind 插件配置 |
| 0.3 | 添加 HeroUIProvider | 在 `src/app/layout.tsx` 中插入 `HeroUIProvider`，位于 `NextIntlClientProvider` 内部 |
| 0.4 | 配置 HeroUI 主题 | 使用 `createTheme()` 建立与现有 oklch 色系一致的主题 |
| 0.5 | 验证共存 | 在一个测试页面同时使用 Shadcn Button 和 HeroUI Button，确认无冲突 |
| 0.6 | 建立迁移工具 | 创建 `src/lib/heroui-compat.ts` 工具文件（Button variant 映射等辅助函数） |

#### 关键代码变更

**`src/app/layout.tsx`** — 添加 HeroUIProvider:
```tsx
import { HeroUIProvider } from '@heroui/react';

export default async function RootLayout({ children }) {
  return (
    <html lang={locale}>
      <body className={...}>
        <NextIntlClientProvider messages={messages}>
          <HeroUIProvider>          {/* 🆕 */}
            {children}
            <Toaster position="top-right" richColors />
          </HeroUIProvider>         {/* 🆕 */}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**`src/app/globals.css`** — 添加 HeroUI 插件:
```css
@import "tailwindcss";
@import "tw-animate-css";       /* 暂时保留 */
@import "shadcn/tailwind.css";  /* 暂时保留 */

/* 🆕 HeroUI Tailwind 插件 */
@plugin "@heroui/react";
```

#### 验证检查点 ✅

- [ ] 安装完成后 `npm run build` 无报错
- [ ] 打开任意页面，现有功能正常
- [ ] 浏览器控制台无 HeroUI 相关报错
- [ ] 暗色模式切换正常

---

### Phase 1: 认证模块 (Epic 1)

**目标**: 迁移登录页 (`/login`) 和注册页 (`/register`)

**预计工时**: 2-3 小时
**难度**: ⭐⭐ 低
**原因**: 认证页面是独立的路由组 `(auth)`，不影响主应用，是最安全的起步点

#### 涉及文件

| 文件 | 主要组件 | 行数 | 修改内容 |
|------|---------|------|---------|
| `src/app/(auth)/login/page.tsx` | Card, Input, Button, Label | ~120 | 替换所有 UI 组件 |
| `src/app/(auth)/register/page.tsx` | Card, Input, Button, Label, Select | ~200 | 替换所有 UI 组件 |
| `src/app/(auth)/layout.tsx` | 布局容器 | ~20 | 可能需调整背景样式 |

#### 组件替换明细

| 当前 Shadcn | → HeroUI | 注意事项 |
|------------|---------|---------|
| `<Card>` | `<Card>` | 直接替换 import |
| `<CardHeader>` | `<CardHeader>` | 属性兼容 |
| `<CardContent>` | `<CardBody>` | 注意命名变化 |
| `<CardFooter>` | `<CardFooter>` | 属性兼容 |
| `<Input>` | `<Input>` | 增加 `label` 属性取代独立 `<Label>` |
| `<Label>` | 移除 | 使用 Input 的 `label` 属性 |
| `<Button>` | `<Button>` | `variant` 映射参见 6.2 节 |
| `<Select>` | `<Select>` | `onValueChange` → `onSelectionChange` |

#### 详细执行步骤

1. **修改 `/login` 页面**
   - 替换所有 import 语句 `from '@/components/ui/...'` → `from '@heroui/react'`
   - 将 `<Card>` 替换为 HeroUI Card（CardContent → CardBody）
   - 将 `<Label>` + `<Input>` 对替换为 HeroUI `<Input label="...">`
   - 将 `<Button variant="default">` 替换为 `<Button color="primary">`
   - 保持 `useTranslations()` 调用不变
   - 保持 Server Action (signIn) 调用不变

2. **修改 `/register` 页面**
   - 同上，额外处理 Select 组件
   - Shadcn Select: `<Select onValueChange={...}><SelectTrigger>...<SelectContent><SelectItem value="...">`
   - HeroUI Select: `<Select onSelectionChange={...}><SelectItem key="...">`
   - 注意值类型转换：`string` → `Set<Key>` → 取第一个值

3. **修改 `(auth)/layout.tsx`**
   - 如有背景渐变或 Card 阴影样式，调整为 HeroUI 风格

#### 验证检查点 ✅

- [ ] 登录页面正常显示（中/英/法三语）
- [ ] 输入框聚焦样式正常（HeroUI 的 focus ring）
- [ ] 密码字段可切换显示/隐藏
- [ ] 表单验证错误信息正常显示
- [ ] 登录功能正常（正确/错误凭据都测试）
- [ ] 注册页面正常显示
- [ ] 年级 Select 下拉正常工作
- [ ] 注册功能正常
- [ ] 暗色模式下两个页面显示正常
- [ ] 移动端响应式布局正常

---

### Phase 2: 偏好设置模块 (Epic 2)

**目标**: 迁移偏好设置页面 (`/preferences`)

**预计工时**: 2-3 小时
**难度**: ⭐⭐ 低-中

#### 涉及文件

| 文件 | 主要组件 | 修改内容 |
|------|---------|---------|
| `src/app/(preferences)/preferences/page.tsx` | Card, Button, 选项卡片 | 替换 UI 组件 |
| `src/app/(preferences)/layout.tsx` | 布局容器 | 可能调整样式 |

#### 执行步骤

1. 替换 Card、Button 组件（同 Phase 1 模式）
2. 偏好选项卡片可能使用自定义样式，需保持选中/未选中的视觉效果
3. 提交按钮的 loading 状态需使用 HeroUI Button 的 `isLoading` 属性

#### 验证检查点 ✅

- [ ] 偏好设置页面正常显示
- [ ] 点击偏好选项高亮正确
- [ ] 提交后跳转到问卷页面
- [ ] 三语显示正常

---

### Phase 3: 问卷模块 (Epic 3)

**目标**: 迁移问卷填写流程 (`/questionnaire`, `/questionnaire-update`)

**预计工时**: 6-8 小时
**难度**: ⭐⭐⭐⭐ 高
**原因**: `QuestionnaireFlow` 约 763 行，包含复杂的多步骤表单、进度条、`DimensionNav` 垂直 Tabs

#### 涉及文件

| 文件 | 行数 | 关键组件 | 复杂点 |
|------|------|---------|--------|
| `src/app/(questionnaire)/questionnaire/page.tsx` | ~100 | 数据加载 + QuestionnaireFlow | Server Component |
| `src/components/QuestionnaireFlow` (若存在) | ~763 | Tabs, Button, Card, 进度条 | 多步骤状态机 |
| `src/components/DimensionNav.tsx` | ~150 | Tabs (垂直), IntersectionObserver | ⚠️ R2 高风险 |
| `src/components/SectionProgress.tsx` | ~60 | 进度条 | 可用 HeroUI Progress |
| `src/components/QuestionReflections.tsx` | ~100 | Card, Textarea, Button | 反思文本输入 |

#### 高风险处理: DimensionNav

**当前实现**:
```tsx
<Tabs orientation="vertical" value={activeDimension} onValueChange={setActiveDimension}>
  <TabsList variant="line">
    {dimensions.map((dim, idx) => (
      <TabsTrigger value={idx}>{dim.name}</TabsTrigger>  // 数值 value
    ))}
  </TabsList>
</Tabs>
```

**HeroUI 迁移方案**:
```tsx
<Tabs
  isVertical
  selectedKey={String(activeDimension)}
  onSelectionChange={(key) => setActiveDimension(Number(key))}
  variant="underlined"
>
  {dimensions.map((dim, idx) => (
    <Tab key={String(idx)} title={dim.name}>
      {/* TabsContent 在 HeroUI 中是 Tab 的 children */}
    </Tab>
  ))}
</Tabs>
```

**关键变更**:
- `orientation="vertical"` → `isVertical`
- `value={number}` → `selectedKey={string}` (数值转字符串)
- `<TabsTrigger>` + `<TabsContent>` → 统一为 `<Tab>`
- IntersectionObserver 联动逻辑需验证仍然工作

#### 验证检查点 ✅

- [ ] 问卷页面加载正常
- [ ] 问题卡片显示正确（文字、选项）
- [ ] 选择答案后高亮正确
- [ ] 维度导航（垂直 Tabs）正常切换
- [ ] 滚动时维度导航自动跟随 (IntersectionObserver)
- [ ] 进度条实时更新
- [ ] 提交问卷后跳转正确
- [ ] 问卷更新页面 (`/questionnaire-update`) 功能正常
- [ ] 三语显示正常
- [ ] 移动端布局正常（维度导航可能需要水平滚动）

---

### Phase 4: 仪表板模块 (Epic 4)

**目标**: 迁移主仪表板 (`/dashboard`) 及共享布局组件

**预计工时**: 6-8 小时
**难度**: ⭐⭐⭐⭐ 高
**原因**: 涉及最复杂的布局组件 (Header, Sidebar, Sheet, DropdownMenu) 和 AnnouncementPopup

#### 涉及文件

| 文件 | 关键组件 | 复杂点 |
|------|---------|--------|
| `src/app/(main)/layout.tsx` | TooltipProvider 移除 | Provider 链调整 |
| `src/components/Header.tsx` | Sheet, DropdownMenu, Button, Avatar | ⚠️ Sheet → Drawer/Modal |
| `src/components/Sidebar.tsx` | Button, Separator | 主要是样式调整 |
| `src/components/SecondaryNavBar.tsx` | Button, 导航链接 | 样式调整 |
| `src/components/AnnouncementPopup.tsx` | Dialog + eventDetails.cancel() | ⚠️ R1 最高风险 |
| `src/components/NotificationBell.tsx` | DropdownMenu 自定义内容 | ⚠️ R9 |
| `src/components/LanguageSwitcher.tsx` | DropdownMenu | 标准菜单 |
| `src/app/(main)/dashboard/page.tsx` | Card, 统计数据 | 相对简单 |

#### 高风险处理: AnnouncementPopup

**当前实现** (使用 `eventDetails.cancel()`):
```tsx
<Dialog
  open={isOpen}
  onOpenChange={(open, eventDetails) => {
    if (!open && !canClose) {
      eventDetails.cancel();  // 阻止关闭！
      return;
    }
    setIsOpen(open);
  }}
>
```

**HeroUI 迁移方案**:
```tsx
<Modal
  isOpen={isOpen}
  isDismissable={canClose}      // 动态控制是否可关闭
  hideCloseButton={!canClose}   // 隐藏关闭按钮
  onOpenChange={(open) => {
    if (canClose) setIsOpen(open);
  }}
>
```

#### 高风险处理: Header Sheet (移动端菜单)

**当前实现**:
```tsx
<Sheet>
  <SheetTrigger>
    <Button variant="ghost" size="icon"><MenuIcon/></Button>
  </SheetTrigger>
  <SheetContent side="left">
    <Sidebar />
  </SheetContent>
</Sheet>
```

**HeroUI 迁移方案**:
```tsx
<>
  <Button isIconOnly variant="light" onPress={() => setMenuOpen(true)}>
    <MenuIcon />
  </Button>
  <Drawer isOpen={menuOpen} onOpenChange={setMenuOpen} placement="left">
    <DrawerContent>
      <Sidebar />
    </DrawerContent>
  </Drawer>
</>
```

#### 高风险处理: NotificationBell

**当前实现**: DropdownMenu 内嵌自定义 HTML（标题 + 通知列表 + "查看全部" 链接）

**HeroUI 迁移方案**: 改用 `Popover` 组件，内容完全自定义：
```tsx
<Popover>
  <PopoverTrigger>
    <Button isIconOnly variant="light">
      <BellIcon />
      {unread > 0 && <Badge .../>}
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <div className="...">
      {/* 自定义通知列表 */}
    </div>
  </PopoverContent>
</Popover>
```

#### 执行顺序

1. **先迁移 `(main)/layout.tsx`**: 移除 `TooltipProvider`
2. **迁移 `Sidebar.tsx`**: Button + Separator → Button + Divider
3. **迁移 `SecondaryNavBar.tsx`**: Button 样式调整
4. **迁移 `LanguageSwitcher.tsx`**: DropdownMenu → Dropdown
5. **迁移 `NotificationBell.tsx`**: DropdownMenu → Popover
6. **迁移 `Header.tsx`**: Sheet → Drawer, 组合以上组件
7. **迁移 `AnnouncementPopup.tsx`**: Dialog → Modal (R1 处理)
8. **迁移 `dashboard/page.tsx`**: Card 组件替换

#### 验证检查点 ✅

- [ ] Admin 布局正常（侧边栏 + 顶栏）
- [ ] Student 布局正常（全宽 + 二级导航）
- [ ] 移动端菜单（原 Sheet）正常打开/关闭
- [ ] 语言切换下拉正常
- [ ] 通知铃铛下拉正常显示通知列表
- [ ] 通知未读数角标正确显示
- [ ] 公告弹窗正常显示
- [ ] 公告倒计时期间无法关闭（R1 验证关键）
- [ ] 倒计时结束后可正常关闭
- [ ] 仪表板统计卡片正常显示
- [ ] 暗色模式全部组件正常
- [ ] 移动端响应式布局正常

---

### Phase 5: 活动模块 (Epic 5)

**目标**: 迁移活动列表 (`/activities`)、日历 (`/calendar`) 及活动详情弹窗

**预计工时**: 8-10 小时
**难度**: ⭐⭐⭐⭐⭐ 最高
**原因**: `ActivityDetailDialog` 约 830 行，是最复杂的单一组件，包含状态机、WebSocket 评论、排程表单

#### 涉及文件

| 文件 | 行数 | 关键组件 | 复杂点 |
|------|------|---------|--------|
| `src/app/(main)/activities/page.tsx` | ~150 | ActivityCardsRow, Dialog | 活动列表 |
| `src/components/ActivityCard.tsx` | ~120 | Card, Badge, Button, Avatar | 活动卡片 |
| `src/components/ActivityCardsRow.tsx` | ~80 | 卡片行布局 | 水平滚动 |
| `src/components/ActivityDetailDialog.tsx` | ~830 | Dialog, Tabs, Button, Input, Select, Badge, Avatar, Textarea | ⚠️ 最复杂组件 |
| `src/components/ActivityStepper.tsx` | ~100 | 步进器 (自定义) | 可用 HeroUI Steps |
| `src/components/ActivityGuideView.tsx` | ~80 | Card, Button | 引导视图 |
| `src/components/ActivityJourneyFlow.tsx` | ~120 | 旅程流程 (自定义) | 自定义组件 |
| `src/components/Calendar.tsx` | ~200 | FullCalendar, Popover | 日历 + 事件弹窗 |
| `src/components/LandingCalendar.tsx` | ~80 | 首页日历 | 精简版 |
| `src/components/CompetitionPanel.tsx` | ~100 | Card, Button, Badge | 竞赛面板 |
| `src/components/PairingPanel.tsx` | ~80 | Card, Button | 配对面板 |
| `src/components/AnswerComments.tsx` | ~150 | Textarea, Button, Avatar | WebSocket 评论 |

#### ActivityDetailDialog 迁移策略

由于此组件过于复杂（830行），建议**分层迁移**:

**第一层**: 替换外壳
```
Dialog → Modal
DialogContent → ModalContent
DialogHeader → ModalHeader
DialogFooter → ModalFooter
```

**第二层**: 替换内部 Tabs
```
Tabs + TabsList + TabsTrigger + TabsContent → Tabs + Tab
```

**第三层**: 替换表单元素
```
Input → HeroUI Input
Select → HeroUI Select
Textarea → HeroUI Textarea
```

**第四层**: 替换装饰元素
```
Badge → Chip
Avatar → Avatar
Button → Button (variant 映射)
```

#### 验证检查点 ✅

- [ ] 活动列表页面正常加载
- [ ] 活动卡片显示正确（图片、标题、标签、参与人数）
- [ ] 点击活动卡片打开详情弹窗
- [ ] 详情弹窗中各 Tab 切换正常
- [ ] 报名/取消报名功能正常
- [ ] 活动状态机正常（OPEN → FULL → SCHEDULED 等）
- [ ] 排程表单（管理员）正常提交
- [ ] WebSocket 评论实时显示
- [ ] 评论 @提及功能正常
- [ ] 日历页面正常显示
- [ ] 日历事件点击弹出 Popover 详情
- [ ] 竞赛面板正常显示
- [ ] 配对面板正常工作
- [ ] 三语显示正常
- [ ] 移动端布局正常

---

### Phase 6: 认知报告模块 (Epic 6)

**目标**: 迁移认知报告页面 (`/cognitive-report`, `/cognitive-report/[snapshotId]`)

**预计工时**: 4-5 小时
**难度**: ⭐⭐⭐ 中
**注意**: DimensionNav 已在 Phase 3 迁移，此处只需确保在报告上下文中正常工作

#### 涉及文件

| 文件 | 关键组件 | 复杂点 |
|------|---------|--------|
| `src/app/(main)/cognitive-report/page.tsx` | Card, Button, 报告列表 | Server Component |
| `src/app/(main)/cognitive-report/[snapshotId]/page.tsx` | CognitiveRadarChart, DimensionNav, Card | 动态路由 |
| `src/components/CognitiveRadarChart.tsx` | Recharts RadarChart | Recharts 不受影响 |
| `src/components/FloatingReportButton.tsx` | Button | 浮动按钮 |

#### 验证检查点 ✅

- [ ] 报告列表页面正常显示
- [ ] 雷达图正确渲染（Recharts）
- [ ] 维度导航与雷达图联动正常
- [ ] 报告详情页各分数正确显示
- [ ] 浮动报告按钮可见且可点击
- [ ] 三语显示正常

---

### Phase 7: 个人资料与通知模块 (Epic 7)

**目标**: 迁移个人资料 (`/profile`) 和通知列表 (`/notifications`)

**预计工时**: 3-4 小时
**难度**: ⭐⭐ 低-中

#### 涉及文件

| 文件 | 关键组件 | 复杂点 |
|------|---------|--------|
| `src/app/(main)/profile/page.tsx` | Card, Input, Select, Button, Avatar, Switch | 表单页面 |
| `src/app/(main)/notifications/page.tsx` | Card, Button, Badge | 列表页面 |

#### 验证检查点 ✅

- [ ] 个人资料页面正常显示
- [ ] 表单字段正确填充现有数据
- [ ] Select 下拉（年级等）正常
- [ ] 头像上传/显示正常
- [ ] 学生证件上传功能正常
- [ ] 保存修改功能正常
- [ ] 通知列表正常显示
- [ ] 通知已读/未读状态正确
- [ ] 标记全部已读功能正常
- [ ] 三语显示正常

---

### Phase 8: 聊天模块 (Epic 8)

**目标**: 迁移聊天系统（聊天弹窗、侧面板、联系人列表、消息输入）

**预计工时**: 6-8 小时
**难度**: ⭐⭐⭐⭐ 高
**原因**: WebSocket 实时通信、@mention 系统的 ref 风险、StudentNetworkDrawer 使用 vaul

#### 涉及文件

| 文件 | 关键组件 | 复杂点 |
|------|---------|--------|
| `src/components/chat/ChatPopup.tsx` | Card, Button, ScrollArea | 悬浮聊天窗口 |
| `src/components/chat/ChatSidePanel.tsx` | 侧面板 | 侧边滑出 |
| `src/components/chat/ContactList.tsx` | Avatar, Badge, ScrollArea, Input | 联系人搜索 |
| `src/components/chat/MessageArea.tsx` | ScrollArea, Avatar | 消息列表 |
| `src/components/chat/MessageInput.tsx` | Textarea, Button, Popover | ⚠️ @mention 系统 (R6) |
| `src/components/chat/ChatMessage.tsx` | Avatar, Badge | 单条消息 |
| `src/components/chat/FloatingChatButton.tsx` | Button | 浮动按钮 |
| `src/components/chat/StudentNetworkDrawer.tsx` | Drawer (vaul), Avatar, Button | ⚠️ vaul Drawer (R5) |
| `src/components/chat/ExternalLinkWarning.tsx` | Dialog, Button | 外链警告 |

#### 高风险处理: MessageInput @mention

**当前实现**:
```tsx
const textareaRef = useRef<HTMLTextAreaElement>(null);
// 插入 @mention 后设置光标位置
textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
```

**HeroUI 迁移方案**:
1. 先测试 HeroUI `<Textarea ref={textareaRef}>` 是否正确转发 ref 到原生 textarea
2. 如果支持 → 直接替换
3. 如果不支持 → 使用 `classNames` 属性给内部 textarea 添加样式，但保留原生 `<textarea>` 处理 ref

#### 高风险处理: StudentNetworkDrawer

**当前实现**: 使用 `vaul` 的 Drawer 组件（从底部滑出）

**HeroUI 迁移方案**:
```tsx
// 方案 A: 使用 HeroUI Drawer (推荐)
<Drawer isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom">
  <DrawerContent>
    {/* 学生网络内容 */}
  </DrawerContent>
</Drawer>

// 方案 B: 保留 vaul (如果 HeroUI Drawer 不满足需求)
// vaul 是独立库，与 HeroUI 无冲突
```

#### 验证检查点 ✅

- [ ] 浮动聊天按钮正常显示
- [ ] 点击打开聊天弹窗
- [ ] 联系人列表正常加载
- [ ] 搜索联系人功能正常
- [ ] 消息实时收发（WebSocket）
- [ ] @mention 输入后弹出用户列表
- [ ] 选择 @mention 用户后光标位置正确
- [ ] 消息滚动到底部功能正常
- [ ] 学生网络 Drawer 正常打开/关闭
- [ ] Drawer 内群组列表显示正确
- [ ] 外链警告弹窗正常

---

### Phase 9: 管理员模块 (Epic 9)

**目标**: 迁移管理员后台（14+ 页面）

**预计工时**: 10-14 小时
**难度**: ⭐⭐⭐⭐ 高
**原因**: 页面数量多，大量 Table + Dialog + 表单的 CRUD 模式

#### 涉及文件

由于管理员模块页面众多，按功能分组:

**用户管理**:
| 文件 | 关键组件 |
|------|---------|
| `src/app/admin/users/page.tsx` | Table, Button, Badge, Input(搜索) |
| `src/app/admin/users/[id]/page.tsx` | Card, Input, Select, Switch, Button |

**问卷管理** (最复杂):
| 文件 | 关键组件 |
|------|---------|
| `src/app/admin/questionnaire/page.tsx` | QuestionnaireManager (~900行), 3级折叠 CRUD |
| `src/app/admin/questionnaire/[questionId]/options/page.tsx` | Table, Dialog, Button, Input |

**活动管理**:
| 文件 | 关键组件 |
|------|---------|
| `src/app/admin/activities/page.tsx` | Table, Button, Badge |
| `src/app/admin/activities/new/page.tsx` | Input, Textarea, Select, Button |
| `src/app/admin/activities/[id]/edit/page.tsx` | 同 new |

**其他管理页面**:
| 文件 | 关键组件 |
|------|---------|
| `src/app/admin/activity-types/page.tsx` | Table, Dialog, Button, Switch |
| `src/app/admin/tags/page.tsx` | Table, Dialog, Button, Badge |
| `src/app/admin/grades/page.tsx` | Table, Dialog, Button |
| `src/app/admin/announcements/page.tsx` | Table, Dialog, Textarea, Switch |
| `src/app/admin/recruitment/page.tsx` | Table, Dialog, MarkdownEditor |
| `src/app/admin/preferences/page.tsx` | Table, Dialog, Button |
| `src/app/admin/settings/page.tsx` | Card, Switch, Input |
| `src/app/admin/communities/page.tsx` | Table, Dialog, Button |
| `src/app/admin/chat-stats/page.tsx` | Card, Table |
| `src/app/admin/page.tsx` | Card (统计仪表板) |

#### Table 迁移模式

管理员模块中 Table 出现最频繁（8+ 处），需建立统一的迁移模式:

**当前 Shadcn 模式**:
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map(item => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell><Badge>{item.status}</Badge></TableCell>
        <TableCell>
          <Button size="xs" onClick={...}>Edit</Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**HeroUI 迁移模式**:
```tsx
<Table aria-label="Items table">
  <TableHeader>
    <TableColumn>Name</TableColumn>
    <TableColumn>Status</TableColumn>
    <TableColumn>Actions</TableColumn>
  </TableHeader>
  <TableBody items={items}>
    {(item) => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell><Chip>{item.status}</Chip></TableCell>
        <TableCell>
          <Button size="sm" onPress={...}>Edit</Button>
        </TableCell>
      </TableRow>
    )}
  </TableBody>
</Table>
```

**关键差异**:
- `<TableHead>` → `<TableColumn>`
- `<Badge>` → `<Chip>`
- `items.map()` → `<TableBody items={items}>{(item) => ...}`
- `onClick` → `onPress`

#### QuestionnaireManager 迁移策略

这是管理员模块中最复杂的组件（~900行），包含 3 级折叠的 CRUD 树（话题 → 维度 → 问题）。

**建议策略**:
1. 先替换外层组件（Card, Button, Dialog）
2. 逐层处理折叠/展开逻辑（使用 HeroUI Accordion）
3. 最后处理内部表单（Input, Textarea, Select）

#### 验证检查点 ✅

- [ ] Admin 仪表板统计正常显示
- [ ] 用户列表正常加载（分页、搜索）
- [ ] 用户详情编辑正常
- [ ] 问卷管理 3 级树形结构正常
- [ ] 添加/编辑/删除话题、维度、问题正常
- [ ] 活动列表正常（创建、编辑、删除）
- [ ] 活动类型管理正常
- [ ] 标签管理正常
- [ ] 年级管理正常
- [ ] 公告管理正常
- [ ] 招聘信息管理正常（Markdown 编辑器）
- [ ] 偏好设置管理正常
- [ ] 系统设置正常
- [ ] 社区管理正常
- [ ] 聊天统计正常
- [ ] 所有 Dialog 弹窗打开/关闭正常
- [ ] 所有 Table 数据显示正确
- [ ] 所有表单提交成功
- [ ] 三语显示正常

---

### Phase 10: 清理与优化

**目标**: 移除所有 Shadcn 残留、优化打包体积、统一设计语言

**预计工时**: 3-4 小时

#### 任务清单

| # | 任务 | 详细描述 |
|---|------|---------|
| 10.1 | 删除 Shadcn UI 组件 | 删除 `src/components/ui/` 下已被 HeroUI 替换的组件文件 |
| 10.2 | 移除旧依赖 | `npm uninstall @base-ui/react class-variance-authority tw-animate-css shadcn vaul` |
| 10.3 | 清理 globals.css | 移除 `@import "shadcn/tailwind.css"` 和 `@import "tw-animate-css"` |
| 10.4 | 清理 components.json | 删除 Shadcn 配置文件 `components.json` |
| 10.5 | 全局搜索残留 | 搜索 `@base-ui/react`、`class-variance-authority`、`buttonVariants`、`tabsListVariants` 等残留引用 |
| 10.6 | CSS 变量优化 | 将 oklch 变量整理为 HeroUI 主题 token，移除冗余变量 |
| 10.7 | TypeScript 检查 | 运行 `npm run typecheck` 确保无类型错误 |
| 10.8 | Lint 检查 | 运行 `npm run lint` 确保代码规范 |
| 10.9 | 构建验证 | 运行 `npm run build` 确保生产构建成功 |
| 10.10 | 打包体积对比 | 对比迁移前后的构建产物大小 |

#### 保留的文件

以下文件不删除，因为它们不依赖 Shadcn:
- `src/components/ui/sonner.tsx` — sonner 封装，改为直接使用 sonner
- `src/components/ui/input-group.tsx` — 纯 HTML，检查是否仍需要
- `src/lib/utils.ts` — `cn()` 函数保留（HeroUI 兼容）

#### 验证检查点 ✅

- [ ] `npm run build` 成功
- [ ] `npm run typecheck` 无错误
- [ ] `npm run lint` 无错误
- [ ] 无 `@base-ui/react` 残留引用
- [ ] 无 `class-variance-authority` 残留引用
- [ ] 全部页面功能回归测试通过
- [ ] 暗色模式全站验证
- [ ] 移动端全站验证
- [ ] 打包体积合理

---

## 8. 验证策略

### 8.1 浏览器测试矩阵

每个 Phase 完成后，必须使用浏览器（agent-browser）进行以下测试:

| 测试维度 | 测试项 |
|---------|--------|
| **功能测试** | 所有交互功能正常（按钮点击、表单提交、弹窗开关、下拉选择） |
| **视觉测试** | 布局不错位、颜色一致、字体正确、间距合理 |
| **响应式测试** | 桌面端 (1920px)、平板端 (768px)、移动端 (375px) |
| **暗色模式** | Light/Dark 切换后所有组件正常 |
| **i18n 测试** | 中/英/法三语切换后显示正确 |
| **角色测试** | Admin 和 Student 两种角色视图分别测试 |

### 8.2 回归测试清单

每个 Phase 除了测试当前模块，还必须验证**之前所有已迁移模块**仍然正常:

```
Phase 1 → 测试: Auth
Phase 2 → 测试: Auth + Preferences
Phase 3 → 测试: Auth + Preferences + Questionnaire
Phase 4 → 测试: Auth + Preferences + Questionnaire + Dashboard
...以此类推
```

### 8.3 测试账号

| 角色 | 用户名 | 密码 | 用途 |
|------|--------|------|------|
| Admin | `admin` | (见 seed) | 测试管理员页面 |
| Student | (注册新用户) | - | 测试学生流程 |

### 8.4 可验证结果

每个 Phase 完成后需要提供:
1. **Screenshot 截图**: 关键页面的截图证据
2. **功能列表**: 标记每个功能的测试结果 (PASS/FAIL)
3. **控制台日志**: 确认无 JS 错误
4. **构建状态**: `npm run build` 成功的日志

---

## 9. 回滚方案

### 9.1 Git 分支策略

```
main (生产)
  └── feat/heroui-migration (迁移主分支)
       ├── feat/heroui-phase-0 (基础设施)
       ├── feat/heroui-phase-1 (认证)
       ├── feat/heroui-phase-2 (偏好)
       ├── feat/heroui-phase-3 (问卷)
       ├── ...
       └── feat/heroui-phase-10 (清理)
```

### 9.2 回滚策略

- **Phase 级回滚**: 如果某个 Phase 验证失败，回滚该 Phase 的分支
- **全局回滚**: 如果迁移整体不可行，回退到 `main` 分支
- **共存期**: Phase 0 到 Phase 9 期间，Shadcn 和 HeroUI 共存，任何时候可以停止迁移

### 9.3 共存保障

迁移期间的关键原则:
- 不删除任何 Shadcn 组件文件，直到 Phase 10
- 不移除任何旧依赖，直到 Phase 10
- 每个文件的迁移是原子操作（要么完全迁移，要么保持原样）

---

## 10. 附录

### 10.1 HeroUI 组件速查表

```typescript
// 安装
import {
  // 布局
  Card, CardHeader, CardBody, CardFooter, Divider, Spacer,
  // 输入
  Input, Textarea, Select, SelectItem, Switch, Checkbox,
  // 按钮
  Button, ButtonGroup,
  // 显示
  Avatar, AvatarGroup, Badge, Chip, Tooltip,
  // 反馈
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Popover, PopoverTrigger, PopoverContent,
  Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter,
  // 导航
  Tabs, Tab, Navbar, NavbarContent, NavbarItem,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
  // 数据
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  // 其他
  ScrollShadow, Progress, Skeleton, Spinner,
  // Provider
  HeroUIProvider,
} from '@heroui/react';
```

### 10.2 常见迁移代码片段

**Button 迁移**:
```tsx
// Before
<Button variant="outline" size="sm" disabled={loading} onClick={handleClick}>
  <SaveIcon data-icon="inline-start" />
  {t('save')}
</Button>

// After
<Button variant="bordered" size="sm" isDisabled={loading} onPress={handleClick} startContent={<SaveIcon />}>
  {t('save')}
</Button>
```

**Dialog → Modal 迁移**:
```tsx
// Before
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>{t('title')}</DialogTitle>
      <DialogDescription>{t('desc')}</DialogDescription>
    </DialogHeader>
    {/* 内容 */}
    <DialogFooter>
      <DialogClose render={<Button variant="outline" />}>{t('cancel')}</DialogClose>
      <Button onClick={handleSave}>{t('save')}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// After
<Modal isOpen={isOpen} onOpenChange={setIsOpen} size="lg">
  <ModalContent>
    {(onClose) => (
      <>
        <ModalHeader>
          <h3>{t('title')}</h3>
          <p className="text-sm text-default-500">{t('desc')}</p>
        </ModalHeader>
        <ModalBody>
          {/* 内容 */}
        </ModalBody>
        <ModalFooter>
          <Button variant="bordered" onPress={onClose}>{t('cancel')}</Button>
          <Button color="primary" onPress={handleSave}>{t('save')}</Button>
        </ModalFooter>
      </>
    )}
  </ModalContent>
</Modal>
```

**Select 迁移**:
```tsx
// Before
<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder={t('select')} />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="opt1">{t('option1')}</SelectItem>
    <SelectItem value="opt2">{t('option2')}</SelectItem>
  </SelectContent>
</Select>

// After
<Select
  label={t('label')}
  placeholder={t('select')}
  selectedKeys={value ? new Set([value]) : new Set()}
  onSelectionChange={(keys) => {
    const selected = Array.from(keys)[0] as string;
    setValue(selected);
  }}
>
  <SelectItem key="opt1">{t('option1')}</SelectItem>
  <SelectItem key="opt2">{t('option2')}</SelectItem>
</Select>
```

**Table 迁移**:
```tsx
// Before
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>{t('name')}</TableHead>
      <TableHead>{t('status')}</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map(item => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell><Badge variant="secondary">{item.status}</Badge></TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>

// After
<Table aria-label={t('tableLabel')}>
  <TableHeader>
    <TableColumn>{t('name')}</TableColumn>
    <TableColumn>{t('status')}</TableColumn>
  </TableHeader>
  <TableBody items={items}>
    {(item) => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell><Chip variant="flat">{item.status}</Chip></TableCell>
      </TableRow>
    )}
  </TableBody>
</Table>
```

### 10.3 工时总估

| Phase | 预计工时 | 难度 | 依赖 |
|-------|---------|------|------|
| Phase 0: 基础设施 | 2-3h | ⭐⭐ | 无 |
| Phase 1: 认证 | 2-3h | ⭐⭐ | Phase 0 |
| Phase 2: 偏好 | 2-3h | ⭐⭐ | Phase 0 |
| Phase 3: 问卷 | 6-8h | ⭐⭐⭐⭐ | Phase 0 |
| Phase 4: 仪表板 | 6-8h | ⭐⭐⭐⭐ | Phase 0 |
| Phase 5: 活动 | 8-10h | ⭐⭐⭐⭐⭐ | Phase 4 |
| Phase 6: 报告 | 4-5h | ⭐⭐⭐ | Phase 3, 4 |
| Phase 7: 资料/通知 | 3-4h | ⭐⭐ | Phase 4 |
| Phase 8: 聊天 | 6-8h | ⭐⭐⭐⭐ | Phase 4 |
| Phase 9: 管理员 | 10-14h | ⭐⭐⭐⭐ | Phase 4 |
| Phase 10: 清理 | 3-4h | ⭐⭐ | 全部完成 |
| **总计** | **52-70h** | | |

### 10.4 执行顺序依赖图

```
Phase 0 (基础设施)
  ├── Phase 1 (认证) ─────────────────────────┐
  ├── Phase 2 (偏好) ─────────────────────────┤
  ├── Phase 3 (问卷) ───────────┐             │
  │                              │             │
  └── Phase 4 (仪表板/布局) ────┤             │
       ├── Phase 5 (活动) ──────┤             │
       ├── Phase 6 (报告) ──────┤             │
       ├── Phase 7 (资料/通知) ─┤             │
       ├── Phase 8 (聊天) ──────┤             │
       └── Phase 9 (管理员) ────┤             │
                                 │             │
                                 └─── Phase 10 (清理) ──── 完成 🎉
```

**说明**:
- Phase 1, 2 可以与 Phase 3, 4 **并行执行**（独立路由组）
- Phase 5-9 依赖 Phase 4（共享布局组件）
- Phase 5-9 之间**可以并行执行**（各模块相对独立）
- Phase 10 必须等全部完成

---

> **文档结束**
> 本文档将作为 HeroUI 迁移的 Master 执行参考。
> 每个 Phase 开始前请确认上一 Phase 的验证检查点全部通过。
> 遇到高风险项（R1-R6）时请特别谨慎，优先验证解决方案的可行性。
