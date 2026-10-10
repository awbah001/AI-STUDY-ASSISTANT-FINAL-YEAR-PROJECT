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
import { useEffect, useState, type ComponentType } from "react";
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
  "Answers from your lecture notes",
  "Web portal + mobile app",
  "Role-based, secure access",
] as const;

const highlights: Array<[string, string, Icon, string]> = [
  ["Grounded answers", "Every reply comes from notes your lecturers uploaded", FileText, "green"],
  ["8 study tools", "Chat, flashcards, quizzes, summaries, planner and more", Layers, "violet"],
  ["Always on", "An AI study coach that checks in between classes", Zap, "amber"],
  ["Anywhere", "Same account on the web, Android and iOS", Smartphone, "sky"],
];

const generic = [
  "Answers from the open internet",
  "May contradict what your lecturer taught",
  "Knows nothing about your deadlines",
  "Can invent sources that don't exist",
];

const ours = [
  "Answers from your own course notes",
  "Names the exact lecture it used",
  "Knows your assignments, quizzes and progress",
  "Says clearly when the notes don't cover a topic",
];

const features: Array<{ title: string; body: string; icon: Icon; tone: string; wide?: boolean }> = [
  {
    title: "Ask AI about your notes",
    body: "Ask anything about a lecture and get a clear explanation drawn from the document itself — with the source named so you can check it.",
    icon: MessageSquare,
    tone: "green",
    wide: true,
  },
  {
    title: "AI study coach",
    body: "Works in the background: reminds you before deadlines and prepares flashcards when new notes arrive.",
    icon: Bot,
    tone: "violet",
  },
  {
    title: "Smart flashcards",
    body: "Generated from your notes and scheduled with spaced repetition so you review at the right time.",
    icon: Layers,
    tone: "pink",
  },
  {
    title: "Practice quizzes",
    body: "Course-specific questions with instant marking to show what you really know.",
    icon: CheckCircle2,
    tone: "amber",
  },
  {
    title: "Instant summaries",
    body: "Turn a long lecture into key points in seconds.",
    icon: FileText,
    tone: "sky",
  },
  {
    title: "Study planner",
    body: "Build a revision timetable around your exams and assignments.",
    icon: CalendarDays,
    tone: "orange",
  },
  {
    title: "Voice questions",
    body: "Tap the mic and speak — your words are typed for you.",
    icon: Mic,
    tone: "teal",
  },
  {
    title: "Progress tracking",
    body: "See quiz scores, streaks and weak topics at a glance.",
    icon: BarChart3,
    tone: "indigo",
  },
];

const steps: Array<[string, string, Icon, string]> = [
  ["Lecturers upload notes", "PDFs, slides and documents are added to each course by the lecturer.", Upload, "burgundy"],
  ["The AI learns the course", "Materials are read and indexed so answers can be traced back to them.", Sparkles, "violet"],
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
    a: "From the lecture notes and documents in the courses you are enrolled in. It searches those materials first and names the document it used, instead of answering from the open internet.",
  },
  {
    q: "What happens if my notes don't cover a question?",
    a: "The assistant tells you the uploaded notes don't cover it, then gives a clearly labelled general explanation — so you always know what came from your course and what didn't.",
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

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        <nav className="lp-links" aria-label="Main">
          {NAV.map((item) => (
            <a
              key={item.href}
              className={active === item.href.slice(1) ? "active" : undefined}
              href={item.href}
              onClick={(e) => { e.preventDefault(); go(item.href); }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav-actions">
          <Link href={getLoginUrl()} className="lp-btn lp-btn-quiet">Sign in</Link>
          <Link href={getLoginUrl()} className="lp-btn lp-btn-primary">Get started</Link>
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
          <Link href={getLoginUrl()} className="lp-btn lp-btn-primary">Sign in</Link>
        </div>
      )}

      <section className="lp-hero" id="home">
        <div className="lp-hero-bg" aria-hidden="true" />
        <div className="lp-copy">
          <span className="lp-eyebrow"><Sparkles size={14} /> Built on your lecturers' own notes</span>
          <h1>
            Study smarter with an AI that knows <span className="lp-highlight">your course</span>
          </h1>
          <p>
            Ask questions about your lecture notes, turn them into flashcards and quizzes, and get reminders before
            deadlines — all grounded in the material your lecturers actually teach.
          </p>
          <div className="lp-hero-actions">
            <Link href={getLoginUrl()} className="lp-btn lp-btn-primary lp-btn-lg">
              Get started <ArrowRight size={18} />
            </Link>
            <button type="button" className="lp-btn lp-btn-outline lp-btn-lg" onClick={() => scrollToId("how")}>
              See how it works
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
          <img className="lp-stage-bot" src="/cognify-auth-bot.png" alt="Course-Specific AI Learning Assistant mascot" />
          <HeroChat />
          <div className="lp-chip lp-chip-1 tone-pink" aria-hidden="true">
            <span><Layers size={16} /></span>
            <div><b>10 flashcards ready</b><small>From Week 3 notes</small></div>
          </div>
          <div className="lp-chip lp-chip-2 tone-amber" aria-hidden="true">
            <span><CheckCircle2 size={16} /></span>
            <div><b>Quiz score 86%</b><small>Up 12% this week</small></div>
          </div>
          <div className="lp-chip lp-chip-3 tone-violet" aria-hidden="true">
            <span><Bot size={16} /></span>
            <div><b>Study coach</b><small>Assignment due tomorrow</small></div>
          </div>
        </div>
      </section>

      <section className="lp-highlights" aria-label="Highlights" data-reveal>
        {highlights.map(([title, body, IconCmp, tone]) => (
          <article key={title} className={`tone-${tone}`}>
            <span><IconCmp size={20} /></span>
            <div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="lp-section" id="why" data-reveal>
        <span className="lp-kicker">WHY COURSE-SPECIFIC</span>
        <h2>Not just another chatbot</h2>
        <p className="lp-lead">
          General AI tools guess. This assistant reads your course first, so what you learn matches what you'll be
          assessed on.
        </p>
        <div className="lp-compare">
          <article className="lp-compare-card lp-compare-generic">
            <header>
              <span><Bot size={20} /></span>
              <h3>Generic AI chatbot</h3>
            </header>
            <ul>
              {generic.map((item) => (
                <li key={item}><XCircle size={17} /> {item}</li>
              ))}
            </ul>
          </article>
          <article className="lp-compare-card lp-compare-ours">
            <header>
              <span><Sparkles size={20} /></span>
              <h3>Course-Specific AI Learning Assistant</h3>
            </header>
            <ul>
              {ours.map((item) => (
                <li key={item}><CheckCircle2 size={17} /> {item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="lp-section" id="features">
        <span className="lp-kicker" data-reveal>EVERYTHING IN ONE PLACE</span>
        <h2 data-reveal>Every tool you need to master a course</h2>
        <p className="lp-lead" data-reveal>From the first lecture to the final exam — all powered by the same course notes.</p>
        <div className="lp-bento">
          {features.map(({ title, body, icon: IconCmp, tone, wide }) => (
            <article key={title} className={`lp-feature tone-${tone}${wide ? " lp-feature-wide" : ""}`} data-reveal>
              <span className="lp-feature-icon"><IconCmp size={20} /></span>
              <h3>{title}</h3>
              <p>{body}</p>
              {wide && (
                <div className="lp-feature-demo" aria-hidden="true">
                  <p className="lp-bubble lp-bubble-user">Summarise the key formulas from Week 1</p>
                  <div className="lp-bubble lp-bubble-ai">
                    <p>Linear regression models <strong>y = β₀ + β₁x</strong>, fitted by minimising the squared error…</p>
                    <span className="lp-source"><FileText size={12} /> Week 1 · Linear Regression.pdf</span>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" id="how">
        <span className="lp-kicker" data-reveal>HOW IT WORKS</span>
        <h2 data-reveal>From lecture notes to learning, in three steps</h2>
        <p className="lp-lead" data-reveal>No setup for students — sign in and your courses are ready.</p>
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
          <p>
            The web portal serves students, lecturers and administrators. Students also get the mobile app, with the same
            account, courses and progress everywhere.
          </p>
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
        <p className="lp-lead" data-reveal>Each role gets a workspace designed around what they need to do.</p>
        <div className="lp-role-grid">
          {roles.map((role) => (
            <article key={role.id} id={role.id} className={`lp-role tone-${role.tone}`} data-reveal>
              <span className="lp-role-icon"><role.icon size={26} /></span>
              <h3>{role.title}</h3>
              <p>{role.blurb}</p>
              <ul>
                {role.points.map((point) => (
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
            <p className="lp-lead">Everything you need to know before you sign in.</p>
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
          <p>Sign in to open your courses, ask your first question and let the study coach keep you on track.</p>
          <div className="lp-cta-actions">
            <Link href={getLoginUrl()} className="lp-btn lp-btn-light lp-btn-lg">
              Get started <ArrowRight size={18} />
            </Link>
            <button type="button" className="lp-btn lp-btn-ghost-light lp-btn-lg" onClick={() => scrollToId("features")}>
              Explore features
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
