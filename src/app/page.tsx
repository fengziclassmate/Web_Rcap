import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  FlaskConical,
  GalleryVerticalEnd,
  LibraryBig,
  NotebookPen,
  PanelsTopLeft,
  Send,
  Sparkles,
  Waves,
} from "lucide-react";

const researchLanes = [
  {
    title: "研究档案",
    eyebrow: "Research Archive",
    description: "把课题、论文、投稿、组会和阶段性问题放在同一条研究链路里。",
    icon: FlaskConical,
    accent: "text-teal-700",
  },
  {
    title: "文献阅读",
    eyebrow: "Reading Notes",
    description: "不只存题录，也记录方法、摘录、可引用位置和对当前论文的用途。",
    icon: LibraryBig,
    accent: "text-sky-700",
  },
  {
    title: "日程节律",
    eyebrow: "Schedule Rhythm",
    description: "用周视图、任务看板和时间分析把科研、生活与恢复时间放到同一个视野。",
    icon: CalendarDays,
    accent: "text-amber-700",
  },
  {
    title: "日常切片",
    eyebrow: "Daily Fragments",
    description: "保留生活、情绪、健康、旅行、阅读和研究之外的观察。",
    icon: NotebookPen,
    accent: "text-rose-700",
  },
];

const currentThreads = [
  "正在推进的研究问题",
  "近期文献和方法笔记",
  "论文写作与投稿节奏",
  "组会反馈和下一步行动",
  "散步、阅读、照片和心情记录",
];

const workbenchModules = [
  { label: "个人日程", icon: CalendarDays },
  { label: "任务仪表盘", icon: ClipboardList },
  { label: "科研项目", icon: FlaskConical },
  { label: "文献阅读", icon: BookOpenCheck },
  { label: "投稿记录", icon: Send },
  { label: "动态日志", icon: GalleryVerticalEnd },
];

const noteStreams = [
  {
    date: "Research",
    title: "问题、方法和证据",
    body: "公开站用于沉淀已经成形的研究线索；工作台保存更细的过程材料、原始笔记和行动项。",
  },
  {
    date: "Life",
    title: "让日常留在系统里",
    body: "日常不是研究之外的噪音，它会影响节律、注意力、恢复和新的观察角度。",
  },
  {
    date: "Behind",
    title: "把工作流也公开为作品",
    body: "这个站点可以展示你如何管理文献、安排写作、复盘组会和连接生活记录。",
  },
];

export default function Home() {
  return (
    <main className="public-shell min-h-screen overflow-hidden text-stone-950">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="brand-mark flex size-10 shrink-0 items-center justify-center rounded-full">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-[0.16em] text-stone-900">
              研究手札
            </span>
            <span className="block truncate text-xs text-stone-500">Research notes and daily fragments</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex" aria-label="公开导航">
          <a href="#research" className="public-nav-link">
            研究
          </a>
          <a href="#daily" className="public-nav-link">
            日常
          </a>
          <a href="#workflow" className="public-nav-link">
            工作流
          </a>
        </nav>

        <Link
          href="/workbench"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-stone-950 px-4 text-sm font-medium text-white shadow-[0_18px_40px_rgba(28,25,23,0.18)] transition hover:bg-teal-950"
        >
          <PanelsTopLeft className="h-4 w-4" aria-hidden />
          工作台
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 pb-14 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.78fr)] lg:items-end lg:pt-14">
        <div className="max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-teal-800">Open research notebook</p>
          <h1 className="mt-6 max-w-4xl text-balance text-5xl font-semibold leading-[1.02] tracking-normal text-stone-950 sm:text-6xl lg:text-7xl">
            一个有生活纹理的科研数字花园。
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-stone-600">
            这里会放研究问题、文献笔记、论文进展和方法复盘，也保留散步、阅读、情绪、照片和日常观察。正式成果之外，过程本身也值得被整理。
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/workbench"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-teal-800 px-5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(15,118,110,0.22)] transition hover:bg-teal-900"
            >
              <PanelsTopLeft className="h-4 w-4" aria-hidden />
              进入私密工作台
            </Link>
            <a
              href="#workflow"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white/60 px-5 text-sm font-semibold text-stone-900 backdrop-blur transition hover:border-stone-400 hover:bg-white"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
              查看结构
            </a>
          </div>
        </div>

        <div className="research-board" aria-label="研究生活工作台预览">
          <div className="research-board-topline">
            <span>2026 / Research Desk</span>
            <span>Private + Public</span>
          </div>
          <div className="mt-6 grid gap-3">
            {currentThreads.map((item) => (
              <div key={item} className="thread-row">
                <span className="thread-pin" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="metric-tile">
              <span>Notes</span>
              <strong>∞</strong>
            </div>
            <div className="metric-tile">
              <span>Papers</span>
              <strong>PDF</strong>
            </div>
            <div className="metric-tile">
              <span>Life</span>
              <strong>Log</strong>
            </div>
          </div>
        </div>
      </section>

      <section id="research" className="relative z-10 border-y border-stone-200/70 bg-white/45 backdrop-blur-sm">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-5 py-10 sm:px-8 lg:grid-cols-4">
          {researchLanes.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="public-feature-card">
                <div className={`flex size-11 items-center justify-center rounded-full bg-white shadow-sm ${item.accent}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">{item.eyebrow}</p>
                <h2 className="mt-2 text-xl font-semibold text-stone-950">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">{item.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="workflow" className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-800">Workbench</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-normal text-stone-950">已有日程应用会成为站点的核心引擎。</h2>
          <p className="mt-5 text-base leading-7 text-stone-600">
            公开页面负责呈现精选内容和个人气质；登录后的工作台继续负责真实管理：安排时间、拆解任务、维护文献、跟进论文、记录组会与日常。
          </p>
        </div>

        <div className="module-strip">
          {workbenchModules.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="module-chip">
                <Icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section id="daily" className="relative z-10 bg-stone-950 text-stone-50">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="inline-flex size-12 items-center justify-center rounded-full bg-teal-300 text-teal-950">
              <Waves className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-6 text-4xl font-semibold tracking-normal">科研和日常放在同一本笔记里。</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-stone-300">
              生活记录不是附属栏目，而是研究者状态的一部分。公开站可以只展示你愿意分享的片段，私密工作台保存完整记录。
            </p>
          </div>

          <div className="grid gap-4">
            {noteStreams.map((item) => (
              <article key={item.title} className="daily-note-row">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-200">{item.date}</span>
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-300">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
