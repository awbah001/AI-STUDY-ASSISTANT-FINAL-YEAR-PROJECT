import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  GraduationCap,
  HelpCircle,
  Layers,
  Menu,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

const NAV = [
  { href: "#home", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it Works" },
  { href: "#students", label: "For Students" },
  { href: "#lecturers", label: "For Lecturers" },
  { href: "#about", label: "About" },
] as const;

const heroPills = [
  ["Documents", "Chat with your course materials", FileText],
  ["Flashcards", "Study smarter with spaced repetition", Layers],
  ["Progress", "Track your learning journey", BarChart3],
  ["AI Tutor", "Get instant help & explanations", Bot],
] as const;

const heroBenefits = [
  ["Course-Specific AI", "Get accurate, relevant answers from your course material, not the internet.", BookOpen],
  ["Personalized Study", "Learning paths and recommendations adapted to your needs.", Sparkles],
  ["Lecturer-Controlled Content", "Your institution controls the content, access and learning experience.", ShieldCheck],
] as const;

const roles = [
  {
    id: "students",
    title: "Students",
    tone: "green",
    icon: GraduationCap,
    points: ["Chat with course documents", "Get personalized learning paths", "Create flashcards and take quizzes", "Track your progress"],
    cta: "Student Access",
    href: "#students",
  },
  {
    id: "lecturers",
    title: "Lecturers",
    tone: "violet",
    icon: BookOpen,
    points: ["Upload and manage course materials", "Create quizzes and assignments", "Monitor student progress", "Use AI for lesson planning"],
    cta: "Lecturer Portal",
    href: "/lecturer/signup",
  },
  {
    id: "admin",
    title: "Administrators",
    tone: "amber",
    icon: ShieldCheck,
    points: ["Manage users and courses", "Monitor system activity", "Generate reports and analytics", "Control portal access"],
    cta: "Admin Portal",
    href: getLoginUrl(),
  },
] as const;

const steps = [
  ["Join a course", "Enter your course code and get access to relevant materials and tools."],
  ["Learn with AI", "Chat with your documents, get personalized guidance, and complete quizzes and flashcards."],
  ["Track progress", "See your learning journey, identify areas to improve, and achieve your goals."],
] as const;

const featureTiles = [
  ["Document Q&A & RAG", "Get instant, accurate answers from your course materials.", MessageSquare],
  ["AI-Generated Quizzes", "Practice with smart, course-specific questions.", CheckCircle2],
  ["Spaced Repetition Flashcards", "Build long-term memory with proven review science.", Layers],
  ["Course Analytics", "Track your progress and identify knowledge gaps.", BarChart3],
  ["Announcements", "Stay updated with the latest course information.", Bell],
  ["Materials Management", "Organize and access all your learning resources.", FileText],
] as const;

const faqs = [
  {
    q: "Is Cognify free to use?",
    a: "This Cognify deployment is for your institution. Students study in the mobile app. Lecturers and administrators sign in on the web at no extra consumer billing step.",
  },
  {
    q: "Can I use Cognify on my mobile device?",
    a: "Yes. Students use the Cognify Expo app for Ask AI, flashcards, quizzes, documents, and the study calendar. Staff use this website.",
  },
  {
    q: "How does the AI get its answers?",
    a: "Cognify retrieves relevant passages from the lecture notes and documents you are allowed to access, then answers from that material instead of the open internet.",
  },
  {
    q: "Is my data secure?",
    a: "Access is role-based. Students only see enrolled courses, lecturers see their own classes, and administrators manage the platform. Sessions use authenticated API access.",
  },
] as const;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      <p className="lp-phone-sub">Let’s continue your learning journey</p>
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
        <div><Clock size={14} /><b>8h 20m</b><small>Study Time</small></div>
        <div><HelpCircle size={14} /><b>12</b><small>Quizzes</small></div>
        <div><Layers size={14} /><b>24</b><small>Flashcards</small></div>
        <div><Flame size={14} /><b>5 days</b><small>Streak</small></div>
      </div>
      <div className="lp-phone-over">
        <span>Continue Learning</span>
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
        <b>Cognify</b>
        <small>ADMIN PORTAL</small>
        <em className="on">Admin Panel</em>
        <em>User Management</em>
        <em>Content</em>
        <em>Operations</em>
      </aside>
      <div className="lp-web-main">
        <div className="lp-web-top">
          <div className="lp-web-search"><Search size={12} /> Search courses or topics…</div>
          <strong>SAMPLE ADMIN</strong>
        </div>
        <h4>Admin Dashboard</h4>
        <p>Platform overview with sample data for demonstration.</p>
        <div className="lp-web-user">
          <span>S</span>
          <div>
            <b>Sample Admin</b>
            <small>admin@cognify.demo</small>
          </div>
          <em>Administrator</em>
        </div>
        <div className="lp-web-kpis">
          <div><small>TOTAL USERS</small><b>128</b><Users size={16} /></div>
          <div><small>ACTIVE LEARNERS</small><b>86</b><BarChart3 size={16} /></div>
          <div><small>QUIZ COMPLETION</small><b>92%</b><HelpCircle size={16} /></div>
          <div><small>FAILED JOBS</small><b>0</b><Layers size={16} /></div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const ids = ["home", "features", "how", "students", "lecturers", "about"];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0.12, 0.35] }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const go = (href: string) => {
    setMenuOpen(false);
    if (href.startsWith("#")) {
      scrollToId(href.slice(1));
      return;
    }
    window.location.href = href;
  };

  return (
    <main className="landing-page">
      <header className="lp-nav">
        <a className="lp-brand" href="#home" onClick={(e) => { e.preventDefault(); go("#home"); }}>
          <span className="lp-mark"><Sparkles size={18} /></span>
          <span>
            <strong>Cognify</strong>
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
          <Button asChild variant="outline" className="lp-btn-ghost">
            <Link href={getLoginUrl()}>Sign In</Link>
          </Button>
          <Button asChild className="lp-btn-green">
            <Link href={getLoginUrl()}>Get Started</Link>
          </Button>
          <button type="button" className="lp-menu" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      {menuOpen && (
        <div className="lp-drawer">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={(e) => { e.preventDefault(); go(item.href); }}>{item.label}</a>
          ))}
        </div>
      )}

      <section className="lp-hero" id="home">
        <div className="lp-copy">
          <span className="lp-eyebrow"><Sparkles size={14} /> Smarter Learning, Brighter Future</span>
          <h1>
            Your <em>AI-Powered</em>
            <br /> Learning Companion
          </h1>
          <p>
            Get course-specific document chat, personalized learning paths, flashcards, quizzes, and track your progress — all in one powerful AI learning assistant.
          </p>
          <div className="lp-hero-actions">
            <Button asChild size="lg" className="lp-btn-green lp-btn-lg">
              <Link href={getLoginUrl()}>Get Started <ArrowRight /></Link>
            </Button>
            <button type="button" className="lp-btn-outline" onClick={() => scrollToId("features")}>
              Explore Features
            </button>
          </div>
        </div>
        <div className="lp-visual" aria-hidden="false">
          <div className="lp-orbit" />
          {heroPills.map(([title, blurb, Icon], i) => (
            <article key={title} className={`lp-float lp-float-${i}`}>
              <span><Icon size={18} /></span>
              <div>
                <b>{title}</b>
                <small>{blurb}</small>
              </div>
            </article>
          ))}
          <img className="lp-bot" src="/cognify-auth-bot.png" alt="Cognify learning assistant" />
        </div>
      </section>

      <section className="lp-benefit-row" aria-label="Why Cognify">
        {heroBenefits.map(([title, body, Icon]) => (
          <article key={title}>
            <span><Icon size={20} /></span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="lp-section" id="students">
        <span className="lp-kicker">BUILT FOR EVERY ROLE</span>
        <h2>Built for every role</h2>
        <p className="lp-lead">Cognify adapts to the needs of students, lecturers and administrators, giving everyone the tools they need to teach, learn and manage effectively.</p>
        <div className="lp-role-grid">
          {roles.map((role) => (
            <article key={role.title} className={`lp-role lp-role-${role.tone}`} id={role.id === "lecturers" ? "lecturers" : undefined}>
              <div className="lp-role-art"><role.icon size={36} /></div>
              <h3>{role.title}</h3>
              <ul>
                {role.points.map((point) => (
                  <li key={point}><CheckCircle2 size={15} /> {point}</li>
                ))}
              </ul>
              <Button asChild className="lp-role-cta">
                {role.href.startsWith("#") ? (
                  <a href={role.href} onClick={(e) => { e.preventDefault(); scrollToId(role.href.slice(1)); }}>{role.cta}</a>
                ) : (
                  <Link href={role.href}>{role.cta}</Link>
                )}
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" id="how">
        <span className="lp-kicker">SIMPLE PROCESS</span>
        <h2>How Cognify works</h2>
        <p className="lp-lead">Get started in these three simple steps and unlock a smarter way to learn.</p>
        <div className="lp-steps">
          {steps.map(([title, body], i) => (
            <article key={title}>
              <span>{i + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-preview-wrap" id="features">
        <div className="lp-preview">
          <div className="lp-product">
            <figure className="lp-web-frame">
              <div className="lp-web-chrome">
                <span /><span /><span />
                <em>app.cognify · sample dashboard</em>
              </div>
              <DummyWebDashboard />
            </figure>
            <figure className="lp-phone-frame">
              <DummyMobileHome />
            </figure>
          </div>
          <div>
            <span className="lp-kicker">POWERFUL FEATURES</span>
            <h2>Everything you need to succeed</h2>
            <p className="lp-lead" style={{ margin: "0 0 16px", textAlign: "left" }}>
              Students learn in the mobile app. Lecturers and admins run courses from the web portal you see here.
            </p>
            <div className="lp-tiles">
              {featureTiles.map(([title, body, Icon]) => (
                <article key={title}>
                  <span><Icon size={18} /></span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="lp-split">
        <article className="lp-workflow">
          <div className="lp-workflow-shot">
            <DummyMobileHome />
          </div>
          <h3>Student Workflow</h3>
          <p>Access course materials and chat with AI. Create flashcards and take quizzes. Track progress and get recommendations.</p>
          <Button asChild className="lp-btn-green">
            <a href="#students">Explore Student Features</a>
          </Button>
        </article>
        <article className="lp-workflow lp-workflow-violet">
          <div className="lp-workflow-shot lp-workflow-shot-wide">
            <DummyWebDashboard />
          </div>
          <h3>Lecturer &amp; Admin Workflow</h3>
          <p>Upload materials, manage users, and monitor the platform from the same web dashboard used by staff.</p>
          <Button asChild className="lp-btn-violet">
            <Link href="/lecturer/signup">Explore Lecturer Features</Link>
          </Button>
        </article>
      </section>

      <section className="lp-section" id="about">
        <div className="lp-faq-grid">
          <div>
            <span className="lp-kicker">FAQ</span>
            <h2>Frequently Asked Questions</h2>
            <p className="lp-lead" style={{ margin: 0 }}>Find answers to common questions about Cognify and how it works.</p>
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

      <section className="lp-cta">
        <img src="/cognify-auth-bot.png" alt="" />
        <div>
          <h2>Make every study session count</h2>
          <p>Join Cognify today and experience a smarter, more personalized way to learn.</p>
          <div className="lp-cta-actions">
            <Button asChild variant="secondary" className="lp-btn-light">
              <a href="#students">Student Access</a>
            </Button>
            <Button asChild className="lp-btn-green">
              <Link href={getLoginUrl()}>Staff Portal</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-foot-brand">
          <span className="lp-mark"><Sparkles size={16} /></span>
          <div>
            <strong>Cognify</strong>
            <p>Smarter learning. Brighter futures.</p>
          </div>
        </div>
        <div>
          <b>Product</b>
          <a href="#features">Features</a>
          <a href="#how">How it Works</a>
          <a href="#about">Pricing</a>
        </div>
        <div>
          <b>For Students</b>
          <a href="#students">Learning</a>
          <a href="#students">Support</a>
        </div>
        <div>
          <b>For Lecturers</b>
          <Link href="/lecturer/signup">Lesson tools</Link>
          <Link href="/lecturer/signup">Create course</Link>
        </div>
        <div>
          <b>Get in touch</b>
          <Link href={getLoginUrl()}>Sign in</Link>
          <Link href="/lecturer/signup">Staff signup</Link>
        </div>
      </footer>
      <p className="lp-copywrite">© {new Date().getFullYear()} Cognify. All rights reserved.</p>
    </main>
  );
}
