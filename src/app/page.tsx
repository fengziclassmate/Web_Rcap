import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  FlaskConical,
  Footprints,
  GalleryVerticalEnd,
  LibraryBig,
  NotebookPen,
  PanelsTopLeft,
  Send,
  Sparkles,
} from "lucide-react";

const navItems = [
  { href: "#garden", label: "Garden" },
  { href: "#research", label: "Research" },
  { href: "#moments", label: "Moments" },
  { href: "/workbench", label: "Workbench" },
];

const portalCards = [
  {
    title: "Research",
    subtitle: "课题 / 方法 / 论文",
    description: "研究问题、项目进度、投稿记录和组会反馈。",
    icon: FlaskConical,
    href: "#research",
  },
  {
    title: "Notes",
    subtitle: "文献 / 摘录 / 想法",
    description: "阅读笔记、可引用材料、方法借鉴和未完成的问题。",
    icon: LibraryBig,
    href: "#research",
  },
  {
    title: "Moments",
    subtitle: "生活 / 心情 / 观察",
    description: "散步、照片、读书、城市和科研之外的日常切片。",
    icon: GalleryVerticalEnd,
    href: "#moments",
  },
  {
    title: "Workbench",
    subtitle: "日程 / 任务 / 节律",
    description: "登录后进入完整的日程安排和科研生活工作台。",
    icon: PanelsTopLeft,
    href: "/workbench",
  },
];

const researchPins = [
  { label: "Research Archive", text: "课题、论文、投稿、组会记录被串成同一条线索。", icon: FileText },
  { label: "Reading Shelf", text: "每篇文献都可以关联项目、论文段落、摘录和方法笔记。", icon: BookOpenCheck },
  { label: "Schedule Rhythm", text: "周视图保留深度科研、写作、会议、运动和恢复时间。", icon: CalendarDays },
  { label: "Task Map", text: "把研究目标拆成下一步行动，而不是只留下模糊计划。", icon: ClipboardList },
];

const momentNotes = [
  "今天的散步路线和一个突然出现的研究问题",
  "读到一段有用的方法描述，先贴进文献架",
  "组会后的三条行动项，以及一点疲惫",
  "咖啡、天气、论文修订和晚上看的电影",
];

export default function Home() {
  return (
    <main className="garden-shell min-h-screen overflow-hidden text-slate-950">
      <header className="garden-header">
        <Link href="/" className="site-badge" aria-label="研究手札首页">
          <span className="site-sigil">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold leading-none">研究手札</span>
            <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-500">open notebook</span>
          </span>
        </Link>

        <nav className="garden-nav" aria-label="主页导航">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="garden-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="garden-hero" id="garden">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="kicker-dot" />
            Research garden / daily notebook
          </div>
          <h1>Welcome to my Research Garden.</h1>
          <p className="hero-lede">
            一个科研人员的个人空间：这里放研究问题、文献笔记、论文进展和日程节律，也保存散步、阅读、照片、心情和一些还没成形的想法。
          </p>
          <div className="hero-actions">
            <Link href="/workbench" className="primary-ticket">
              <PanelsTopLeft className="h-4 w-4" aria-hidden />
              进入我的工作台
            </Link>
            <a href="#research" className="secondary-ticket">
              <ArrowRight className="h-4 w-4" aria-hidden />
              翻开研究档案
            </a>
          </div>
        </div>

        <div className="hero-scrapbook" aria-label="研究花园插画">
          <span className="paper-tape paper-tape-left" />
          <span className="paper-tape paper-tape-right" />
          <Image
            src="/research-garden-hero.png"
            alt="研究手札、文献卡片和日常便签组成的桌面插画"
            width={1400}
            height={980}
            priority
            className="hero-art"
          />
          <div className="sticker sticker-lab">Lab log</div>
          <div className="sticker sticker-life">Daily</div>
          <div className="sticker sticker-paper">PDF notes</div>
        </div>
      </section>

      <section className="portal-strip" aria-label="站点入口">
        {portalCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="portal-card">
              <div className="portal-card-top">
                <span className="portal-icon">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="portal-subtitle">{card.subtitle}</span>
              </div>
              <h2>{card.title}</h2>
              <p>{card.description}</p>
            </Link>
          );
        })}
      </section>

      <section className="research-section" id="research">
        <div className="section-heading">
          <p>Research desk</p>
          <h2>科研内容不做成机构官网，而像一叠可以继续翻的档案卡。</h2>
        </div>
        <div className="pin-grid">
          {researchPins.map((pin) => {
            const Icon = pin.icon;
            return (
              <article key={pin.label} className="pin-card">
                <span className="pin-clip" />
                <Icon className="h-5 w-5 text-teal-800" aria-hidden />
                <h3>{pin.label}</h3>
                <p>{pin.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="moments-section" id="moments">
        <div className="moments-board">
          <div className="section-heading">
            <p>Daily fragments</p>
            <h2>日常不是另一个系统，它会和研究一起留下纹理。</h2>
          </div>
          <div className="moment-list">
            {momentNotes.map((note, index) => (
              <div key={note} className="moment-row">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{note}</p>
              </div>
            ))}
          </div>
        </div>
        <Link href="/workbench" className="workbench-ticket">
          <span className="ticket-label">private entrance</span>
          <span className="ticket-title">
            <PanelsTopLeft className="h-5 w-5" aria-hidden />
            个人科研与生活工作台
          </span>
          <span className="ticket-meta">
            日程、任务、科研项目、文献阅读、投稿记录、动态日志都在这里继续维护。
          </span>
        </Link>
      </section>

      <footer className="garden-footer">
        <span>Research notes</span>
        <span>Daily fragments</span>
        <span>Schedule rhythm</span>
        <span>
          <Footprints className="h-4 w-4" aria-hidden />
          Field marks
        </span>
      </footer>
    </main>
  );
}
