import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getLoginUrl } from "@/const";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  GraduationCap,
  HelpCircle,
  Layers,
  Menu,
  MessageSquare,
  Mic,
  Monitor,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link } from "wouter";
import "../landing.css";

type Icon = ComponentType<{ size?: number; className?: string }>;

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#roles", label: "Who it's for" },
  { href: "#faq", label: "FAQ" },
] as const;

const SECTION_IDS = ["home", "why", "features", "how", "roles", "faq"];

const trustPoints = [
  "Study with your course materials",
  "Web portal + mobile app",
  "Role-based, secure access",
] as const;

const features: Array<{ title: string; body: string; icon: Icon; tone: string; wide?: boolean }> = [
  {
    title: "Ask AI about your notes",
    body: "Ask questions about your course materials.",
    icon: MessageSquare,
    tone: "green",
    wide: true,
  },
  {
    title: "AI study coach",
    body: "Get study reminders and flashcards.",
    icon: Bot,
    tone: "violet",
  },
  {
    title: "Smart flashcards",
    body: "Review your notes with spaced repetition.",
    icon: Layers,
    tone: "pink",
  },
  {
    title: "Practice quizzes",
    body: "Test your understanding with course questions.",
    icon: CheckCircle2,
    tone: "amber",
  },
  {
    title: "Instant summaries",
    body: "Find the key points in your notes.",
    icon: FileText,
    tone: "sky",
  },
  {
    title: "Study planner",
    body: "Plan study around your deadlines.",
    icon: CalendarDays,
    tone: "orange",
  },
  {
    title: "Voice questions",
    body: "Ask questions using your voice.",
    icon: Mic,
    tone: "teal",
  },
  {
    title: "Progress tracking",
    body: "See your activity and quiz results.",
    icon: BarChart3,
    tone: "indigo",
  },
];

const steps: Array<[string, string, Icon, string]> = [
  ["Lecturers upload notes", "PDFs, slides and documents are added to each course by the lecturer.", Upload, "burgundy"],
  ["Materials are prepared", "Documents are processed so students can study and ask questions about them.", Sparkles, "violet"],
  ["Students learn and practise", "Ask questions, review flashcards, take quizzes and follow their progress.", GraduationCap, "green"],
];

const roles = [
  {
    id: "students",
    title: "Students",
    tone: "green",
    icon: GraduationCap,
    blurb: "Your personal tutor for every course you take.",
    points: ["Chat with course documents", "Flashcards, quizzes and summaries", "Study planner and AI coach", "Track progress and streaks"],
    cta: "Student sign in",
  },
  {
    id: "lecturers",
    title: "Lecturers",
    tone: "burgundy",
    icon: BookOpen,
    blurb: "Put your material to work between lectures.",
    points: ["Upload and manage course materials", "Create quizzes and assignments", "Grade submissions", "See how each student is doing"],
    cta: "Lecturer portal",
  },
  {
    id: "admin",
    title: "Administrators",
    tone: "slate",
    icon: ShieldCheck,
    blurb: "Run the platform with full visibility.",
    points: ["Create and manage accounts", "Manage courses and enrolments", "Configure the AI and study coach", "Audit logs and reports"],
    cta: "Admin portal",
  },
] as const;

const faqs = [
  {
    q: "Where does the AI get its answers?",
    a: "You can ask about a selected document or choose a source for your question. Depending on the selected mode, the assistant can use your course materials or provide general study help.",
  },
  {
    q: "What happens if my notes don't cover a question?",
    a: "The assistant may indicate when it cannot find relevant material. Check the source and your lecture notes, and ask your lecturer when you need clarification.",
  },
  {
    q: "What is the AI study coach?",
    a: "A background assistant that checks in every few hours. It can remind you about upcoming deadlines and quizzes, and prepare flashcards when new notes are uploaded. You can switch it off in your settings.",
  },
  {
    q: "Can I use it on my phone?",
    a: "Yes. Students can use the mobile app for Ask AI, flashcards, quizzes, documents and the study planner — including asking questions by voice.",
  },
  {
    q: "How do I get an account?",
    a: "Students sign in with their institution email. Lecturer and administrator accounts are created by your administrator.",
  },
  {
    q: "Is my data secure?",
    a: "Access is role-based. Students only see courses they are enrolled in, lecturers see their own classes, and administrators manage the platform. All requests are authenticated.",
  },
] as const;

function SlideTabs({ active, onNavigate }: { active: string; onNavigate: (href: string) => void }) {
  const navRef = useRef<HTMLElement>(null);
  const highlightedRef = useRef<HTMLAnchorElement | null>(null);
  const reducedMotion = useReducedMotion();
  const [position, setPosition] = useState({ left: 0, width: 0, opacity: 0 });

  const highlight = (element: HTMLAnchorElement) => {
    highlightedRef.current = element;
    setPosition({ left: element.offsetLeft, width: element.getBoundingClientRect().width, opacity: 1 });
  };

  const restoreActive = () => {
    const selected = navRef.current?.querySelector<HTMLAnchorElement>('a[aria-current="location"]');
    if (selected) {
      highlight(selected);
      return;
    }
    highlightedRef.current = null;
    setPosition((previous) => ({ ...previous, opacity: 0 }));
  };

  useEffect(() => {
    if (!navRef.current?.matches(":hover, :focus-within")) restoreActive();
  }, [active]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(() => {
      const element = highlightedRef.current;
      if (element) {
        setPosition({ left: element.offsetLeft, width: element.getBoundingClientRect().width, opacity: 1 });
      }
    });
    observer.observe(nav);
    nav.querySelectorAll("a").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      ref={navRef}
      className="lp-links"
      aria-label="Main"
      onMouseLeave={() => {
        const focused = navRef.current?.querySelector<HTMLAnchorElement>("a:focus-visible");
        if (focused) highlight(focused);
        else restoreActive();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) restoreActive();
      }}
    >
      {NAV.map((item) => (
        <a
          key={item.href}
          className={active === item.href.slice(1) ? "active" : undefined}
          href={item.href}
          aria-current={active === item.href.slice(1) ? "location" : undefined}
          onMouseEnter={(event) => highlight(event.currentTarget)}
          onFocus={(event) => highlight(event.currentTarget)}
          onClick={(event) => { event.preventDefault(); onNavigate(item.href); }}
        >
          {item.label}
        </a>
      ))}
      <motion.span
        className="lp-tab-cursor"
        aria-hidden="true"
        initial={false}
        animate={position}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 450, damping: 35 }}
      />
    </nav>
  );
}

function HeroChat() {
  return (
    <div className="lp-chat" aria-hidden="true">
      <div className="lp-chat-head">
        <span className="lp-chat-avatar"><Sparkles size={15} /></span>
        <div>
          <b>Ask AI</b>
          <small><i /> CSC 201 · Intro to Databases</small>
        </div>
      </div>
      <div className="lp-chat-body">
        <p className="lp-bubble lp-bubble-user">What is third normal form, in simple terms?</p>
        <div className="lp-bubble lp-bubble-ai">
          <p>
            A table is in <strong>third normal form (3NF)</strong> when every column depends only on the key — not on
            another non-key column. In your lecture's example, <em>city</em> depends on <em>postcode</em>, so it moves
            to its own table.
          </p>
          <span className="lp-source"><FileText size={12} /> Week 3 · Normalisation.pdf</span>
        </div>
      </div>
      <div className="lp-chat-input">
        <Mic size={15} />
        <span>Ask about your course…</span>
        <b><Send size={13} /></b>
      </div>
    </div>
  );
}

function DummyMobileHome() {
  return (
    <div className="lp-phone-ui" aria-hidden="true">
      <header>
        <div>
          <small>Good morning,</small>
          <b>Maya Chen</b>
        </div>
        <span className="lp-phone-avatar">M</span>
      </header>
      <p className="lp-phone-sub">Let's continue your learning journey</p>
      <div className="lp-phone-goal">
        <div>
          <small>DAILY GOAL</small>
          <strong>4 <em>/ 6 topics</em></strong>
          <div className="lp-mini-bar"><i style={{ width: "67%" }} /></div>
          <q>Consistency today. Excellence tomorrow.</q>
        </div>
        <img src="/cognify-auth-bot.png" alt="" />
      </div>
      <div className="lp-phone-over">
        <span>Overview</span>
        <em>This week</em>
      </div>
      <div className="lp-phone-stats">
        <div className="tone-sky"><Clock size={14} /><b>8h 20m</b><small>Study time</small></div>
        <div className="tone-amber"><HelpCircle size={14} /><b>12</b><small>Quizzes</small></div>
        <div className="tone-pink"><Layers size={14} /><b>24</b><small>Flashcards</small></div>
        <div className="tone-orange"><Flame size={14} /><b>5 days</b><small>Streak</small></div>
      </div>
      <div className="lp-phone-over">
        <span>Continue learning</span>
      </div>
      <div className="lp-phone-course">
        <span><BookOpen size={16} /></span>
        <div>
          <b>Intro to Databases</b>
          <small>CSC 201 · 3 lectures</small>
        </div>
      </div>
    </div>
  );
}

function DummyWebDashboard() {
  return (
    <div className="lp-web-ui" aria-hidden="true">
      <aside>
        <b>Course-Specific AI</b>
        <small>STUDENT PORTAL</small>
        <em className="on">Dashboard</em>
        <em>My courses</em>
        <em>Ask AI</em>
        <em>Flashcards</em>
        <em>Quizzes</em>
        <em>Study planner</em>
      </aside>
      <div className="lp-web-main">
        <div className="lp-web-top">
          <div className="lp-web-search"><Search size={12} /> Search courses, materials, quizzes…</div>
          <span className="lp-web-me">M</span>
        </div>
        <h4>Welcome back, Maya</h4>
        <p>You have 2 tasks due this week.</p>
        <div className="lp-web-kpis">
          <div className="tone-green"><small>COURSES</small><b>4</b><BookOpen size={15} /></div>
          <div className="tone-pink"><small>CARDS DUE</small><b>18</b><Layers size={15} /></div>
          <div className="tone-amber"><small>AVG QUIZ</small><b>86%</b><CheckCircle2 size={15} /></div>
          <div className="tone-orange"><small>STREAK</small><b>5d</b><Flame size={15} /></div>
        </div>
        <div className="lp-web-tasks">
          <div><span className="tone-orange"><CalendarDays size={13} /></span><b>ER diagram assignment</b><em>Due tomorrow</em></div>
          <div><span className="tone-violet"><Bot size={13} /></span><b>10 new flashcards from Week 3</b><em>Study coach</em></div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      lenisRef.current?.destroy();
      lenisRef.current = preference.matches ? null : new Lenis({ autoRaf: true, allowNestedScroll: true });
    };
    updateMotion();
    preference.addEventListener("change", updateMotion);
    return () => {
      preference.removeEventListener("change", updateMotion);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollToId = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    if (lenisRef.current) {
      const headerHeight = document.querySelector<HTMLElement>(".lp-nav")?.offsetHeight ?? 0;
      lenisRef.current.scrollTo(target, { offset: -headerHeight - 12 });
    } else {
      target.scrollIntoView({ behavior: "instant", block: "start" });
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0.12, 0.35] }
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.querySelector(".landing-page");
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("lp-animate");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (href: string) => {
    setMenuOpen(false);
    scrollToId(href.slice(1));
  };

  return (
    <main className="landing-page">
      <header className={`lp-nav${scrolled ? " is-scrolled" : ""}`}>
        <a className="lp-brand" href="#home" onClick={(e) => { e.preventDefault(); go("#home"); }}>
          <span className="lp-mark"><Sparkles size={18} /></span>
          <span>
            <strong>Course-Specific</strong>
            <small>AI Learning Assistant</small>
          </span>
        </a>
        <SlideTabs active={active} onNavigate={go} />
        <div className="lp-nav-actions">
          <Link href={getLoginUrl()} className="lp-btn lp-btn-quiet"><span className="lp-btn-face">Sign in</span></Link>
          <Link href={getLoginUrl()} className="lp-btn lp-btn-primary"><span className="lp-btn-face">Get started</span></Link>
          <button type="button" className="lp-menu" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" aria-expanded={menuOpen}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      {menuOpen && (
        <div className="lp-drawer">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={(e) => { e.preventDefault(); go(item.href); }}>{item.label}</a>
          ))}
          <Link href={getLoginUrl()} className="lp-btn lp-btn-primary"><span className="lp-btn-face">Sign in</span></Link>
        </div>
      )}

      <section className="lp-hero" id="home">
        <div className="lp-hero-bg" aria-hidden="true" />
        <div className="lp-copy">
          <span className="lp-eyebrow"><Sparkles size={14} /> Built on your lecturers' own notes</span>
          <h1>
            Your course materials. <span className="lp-highlight">More ways to learn.</span>
          </h1>
          <p>
            Your notes, questions and study tools, all in one place.
          </p>
          <div className="lp-hero-actions">
            <Link href={getLoginUrl()} className="lp-btn lp-btn-primary lp-btn-lg">
              <span className="lp-btn-face">Get started <ArrowRight size={18} /></span>
            </Link>
            <button type="button" className="lp-btn lp-btn-outline lp-btn-lg" onClick={() => scrollToId("how")}>
              <span className="lp-btn-face">See how it works</span>
            </button>
          </div>
          <ul className="lp-trust">
            {trustPoints.map((point) => (
              <li key={point}><CheckCircle2 size={16} /> {point}</li>
            ))}
          </ul>
        </div>

        <div className="lp-stage">
          <div className="lp-stage-glow" aria-hidden="true" />
          <img className="lp-hero-student" src="/landing-student.png" alt="Student holding a laptop and study notebooks" />
        </div>
      </section>

      <div className="lp-editorial-band" aria-label="Ways to learn">
        <span>YOUR NOTES</span><span aria-hidden="true">?</span><span>YOUR QUESTIONS</span><span aria-hidden="true">?</span><span>YOUR PROGRESS</span>
      </div>

      <section className="lp-section" id="features">
        <div className="lp-feature-intro" data-reveal>
          <span className="lp-kicker">EVERYTHING IN ONE PLACE</span>
          <h2>Everything you need to learn, in one place.</h2>
          <p className="lp-lead">From your first question to your final review.</p>
          <Link href={getLoginUrl()} className="lp-btn lp-btn-primary"><span className="lp-btn-face">Get started <ArrowRight size={16} /></span></Link>
        </div>
        <div className="lp-bento">
          {features.map(({ title, body, icon: IconCmp, tone }) => (
            <article key={title} className={`lp-feature tone-${tone}`} data-reveal>
              <span className="lp-feature-icon"><IconCmp size={20} /></span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" id="why" data-reveal>
        <span className="lp-kicker">WHY COURSE-SPECIFIC</span>
        <h2>Your notes have more to say.</h2>
        <div className="lp-study-story">
          <div className="lp-study-copy">
            <h3>Ask questions about your notes</h3>
            <p>Open a document, explore a topic and practise what you've learned.</p>
          </div>
          <figure className="lp-study-example">
            <HeroChat />
            <figcaption>Illustrative example of a question about course material.</figcaption>
          </figure>
        </div>
      </section>

      <section className="lp-section" id="how">
        <span className="lp-kicker" data-reveal>HOW IT WORKS</span>
        <h2 data-reveal>A simpler way to study.</h2>
        <ol className="lp-steps">
          {steps.map(([title, body, IconCmp, tone], i) => (
            <li key={title} className={`tone-${tone}`} data-reveal>
              <div className="lp-step-top">
                <span className="lp-step-icon"><IconCmp size={22} /></span>
                <span className="lp-step-num">0{i + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-showcase" data-reveal>
        <div className="lp-showcase-copy">
          <span className="lp-kicker">WEB AND MOBILE</span>
          <h2>Learn at your desk or on the go</h2>
          <p>Use the web portal or take your learning with you on mobile.</p>
          <ul>
            <li className="tone-green"><span><Monitor size={16} /></span> Full web portal for every role</li>
            <li className="tone-sky"><span><Smartphone size={16} /></span> Android and iOS app for students</li>
            <li className="tone-violet"><span><Mic size={16} /></span> Ask by voice, listen to answers</li>
          </ul>
        </div>
        <div className="lp-product">
          <figure className="lp-web-frame">
            <div className="lp-web-chrome">
              <span /><span /><span />
              <em>Student portal · sample data</em>
            </div>
            <DummyWebDashboard />
          </figure>
          <figure className="lp-phone-frame">
            <DummyMobileHome />
          </figure>
        </div>
      </section>

      <section className="lp-section" id="roles">
        <span className="lp-kicker" data-reveal>WHO IT'S FOR</span>
        <h2 data-reveal>One platform, three portals</h2>
        <div className="lp-role-grid">
          {roles.map((role) => (
            <article key={role.id} id={role.id} className={`lp-role tone-${role.tone}`} data-reveal>
              <span className="lp-role-icon"><role.icon size={26} /></span>
              <h3>{role.title}</h3>
              <p>{role.blurb}</p>
              <ul>
                {role.points.slice(0, 2).map((point) => (
                  <li key={point}><CheckCircle2 size={15} /> {point}</li>
                ))}
              </ul>
              <Link href={getLoginUrl()} className="lp-role-cta">
                {role.cta} <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" id="faq" data-reveal>
        <div className="lp-faq-grid">
          <div>
            <span className="lp-kicker">FAQ</span>
            <h2>Questions, answered</h2>
            <div className="lp-faq-help tone-violet">
              <span><Users size={18} /></span>
              <p>Need an account or help signing in? <b>Contact your administrator.</b></p>
            </div>
          </div>
          <Accordion type="single" collapsible className="lp-faq">
            {faqs.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="lp-cta" data-reveal>
        <div className="lp-cta-glow" aria-hidden="true" />
        <div className="lp-cta-copy">
          <h2>Make every study session count</h2>
          <p>Open your courses and start learning.</p>
          <div className="lp-cta-actions">
            <Link href={getLoginUrl()} className="lp-btn lp-btn-light lp-btn-lg">
              <span className="lp-btn-face">Get started <ArrowRight size={18} /></span>
            </Link>
            <button type="button" className="lp-btn lp-btn-ghost-light lp-btn-lg" onClick={() => scrollToId("features")}>
              <span className="lp-btn-face">Explore features</span>
            </button>
          </div>
        </div>
        <img src="/cognify-auth-bot.png" alt="" />
      </section>

      <footer className="lp-footer">
        <div className="lp-foot-brand">
          <span className="lp-mark"><Sparkles size={16} /></span>
          <div>
            <strong>Course-Specific AI Learning Assistant</strong>
            <p>Smarter learning, grounded in your course.</p>
          </div>
        </div>
        <div>
          <b>Product</b>
          <a href="#features" onClick={(e) => { e.preventDefault(); go("#features"); }}>Features</a>
          <a href="#how" onClick={(e) => { e.preventDefault(); go("#how"); }}>How it works</a>
          <a href="#faq" onClick={(e) => { e.preventDefault(); go("#faq"); }}>FAQ</a>
        </div>
        <div>
          <b>Portals</b>
          <Link href={getLoginUrl()}>Students</Link>
          <Link href={getLoginUrl()}>Lecturers</Link>
          <Link href={getLoginUrl()}>Administrators</Link>
        </div>
        <div>
          <b>Get in touch</b>
          <Link href={getLoginUrl()}>Sign in</Link>
          <a href="#faq" onClick={(e) => { e.preventDefault(); go("#faq"); }}>Ask your administrator for an account</a>
        </div>
      </footer>
      <p className="lp-copywrite">© {new Date().getFullYear()} Course-Specific AI Learning Assistant. All rights reserved.</p>
    </main>
  );
}
