import { useId } from "react";
import { CheckCircle2, GraduationCap, Hexagon, ShieldCheck, type LucideIcon } from "lucide-react";

type HeroKind = "users" | "academic" | "operations" | "audit" | "communications";
const content: Record<HeroKind, { eyebrow: string; title: string; description: string; icon?: LucideIcon; checklist?: string[] }> = {
  users: { eyebrow: "User management", title: "Users", description: "Students and lecturers are listed separately. Students sign up on the web or in the mobile app; lecturers are created here." },
  academic: { eyebrow: "Academic", title: "Give a lecturer a course", description: "Only administrators can add a course to the catalogue. The selected lecturer then sees it under My Courses.", icon: GraduationCap },
  operations: { eyebrow: "Platform", title: "Operations", description: "AI processing queue, storage health, and operational failures.", icon: Hexagon, checklist: ["Monitor processing queue", "Track storage health", "Identify and resolve failures", "Ensure platform stability"] },
  audit: { eyebrow: "Compliance", title: "Audit", description: "Immutable history of privileged actions across the platform.", icon: ShieldCheck, checklist: ["Track administrative actions", "Ensure accountability", "Maintain platform security"] },
  communications: { eyebrow: "Outreach", title: "Communications", description: "Send targeted notices and monitor inbox delivery." },
};

export function AdminHero({ kind }: { kind: HeroKind }) {
  const { eyebrow, title, description, icon: Icon, checklist } = content[kind];
  return <header className={`admin-hero admin-hero--${kind}`}>
    <div className="admin-hero-copy">
      {Icon && <span className="admin-hero-icon"><Icon strokeWidth={2} /></span>}
      <div><p className="admin-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="admin-hero-description">{description}</p></div>
    </div>
    <HeroArt kind={kind} />
    {checklist && <ul className="admin-hero-checklist">{checklist.map(item => <li key={item}><CheckCircle2 />{item}</li>)}</ul>}
  </header>;
}

/** Decorative vector artwork scales cleanly with the responsive banner. */
function HeroArt({ kind }: { kind: HeroKind }) {
  const id = useId().replace(/:/g, "");
  const green = `url(#${id}-green)`, white = `url(#${id}-white)`, dark = `url(#${id}-dark)`;
  return <svg className="admin-hero-art" viewBox="0 0 360 200" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-green`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#73e5c5"/><stop offset=".45" stopColor="#00a881"/><stop offset="1" stopColor="#005b4c"/></linearGradient>
      <linearGradient id={`${id}-white`} x1="0" y1="0" x2=".9" y2="1"><stop stopColor="white"/><stop offset=".6" stopColor="#f5fffc"/><stop offset="1" stopColor="#b5dbd3"/></linearGradient>
      <linearGradient id={`${id}-dark`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#218f7d"/><stop offset="1" stopColor="#003e36"/></linearGradient>
      <radialGradient id={`${id}-glow`}><stop stopColor="#45cba7" stopOpacity=".3"/><stop offset="1" stopColor="#45cba7" stopOpacity="0"/></radialGradient>
      <filter id={`${id}-shadow`} x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#007e62" floodOpacity=".18"/></filter>
    </defs>
    <ellipse cx="190" cy="169" rx="158" ry="32" fill={`url(#${id}-glow)`}/>
    <g filter={`url(#${id}-shadow)`}>
      {kind === "users" && <>
        {[{x:117,y:69,s:.72},{x:243,y:68,s:.72},{x:180,y:58,s:1}].map(({x,y,s}) => <g key={x} transform={`translate(${x} ${y}) scale(${s})`}><ellipse cy="-13" rx="23" ry="25" fill={green}/><path d="M-38 69V47C-38 4 38 4 38 47V69Q0 81-38 69" fill={green}/><ellipse cx="-8" cy="-22" rx="8" ry="12" fill="white" opacity=".18"/></g>)}
        <circle cx="251" cy="148" r="32" fill={white}/><path d="m227 141 24-12 24 12-24 12Zm9 9v12q15 10 30 0v-12" fill={dark}/>
      </>}
      {kind === "academic" && <>
        <path d="m85 148 111-48 85 39-110 50Z" fill={green}/><path d="m85 131 110-45 86 36-110 48Z" fill={white}/><path d="m85 131 86 39v18l-86-39Z" fill="#a1d0c0"/>
        <path d="m101 113 93-43 85 37-92 45Z" fill={white}/><path d="m101 113 86 39v16l-86-38Z" fill="#d7ebe2"/>
        <path d="M146 62v37q37 32 72 0V62" fill={dark}/><path d="m111 53 72-34 75 32-73 35Z" fill={dark} stroke="#259480" strokeWidth="2"/>
        <path d="m182 53 49 18v42" fill="none" stroke="#d5f7ee" strokeWidth="3"/><circle cx="182" cy="53" r="4" fill="#d5f7ee"/><path d="m227 113-3 16h14l-3-16" fill="#daf6ed"/>
      </>}
      {kind === "operations" && <>
        {[116,80,44].map(y => <g key={y}><path d={`m118 ${y+25} 70-32 74 32v27l-72 34-72-34Z`} fill={green}/><path d={`m118 ${y+25} 72 34v27l-72-34Z`} fill={white}/><path d={`m118 ${y+25} 70-32 74 32-72 34Z`} fill={dark}/><circle cx="135" cy={y+46} r="3" fill="#00ad80"/><circle cx="146" cy={y+51} r="3" fill="#00ad80"/><path d={`m230 ${y+57} 15-7`} stroke="#004e41" strokeWidth="4" strokeLinecap="round"/></g>)}
        <path d="m176 41 13-6 15 6-14 7Z" fill="none" stroke="#5df1c6" strokeWidth="4"/>
        <rect x="38" y="53" width="51" height="51" rx="13" fill={white}/><rect x="288" y="36" width="48" height="51" rx="13" fill={white}/><path d="M304 51h14v22h-14Zm3 7h8m-8 5h8" fill="none" stroke="#008768" strokeWidth="2"/>
        <circle cx="63" cy="78" r="12" fill="none" stroke="#008768" strokeWidth="5"/><circle cx="63" cy="78" r="4" fill="#008768"/>
      </>}
      {kind === "audit" && <>
        <rect x="82" y="86" width="176" height="105" rx="13" fill={green} transform="rotate(-5 170 135)"/>
        <g transform="rotate(5 180 110)"><rect x="112" y="28" width="172" height="186" rx="14" fill={white}/><path d="m164 50 28 12-4 41q-12 21-25 27-19-10-28-28l-3-40Z" fill={green} stroke="#12c393" strokeWidth="3"/><path d="m149 85 11 10 18-23" stroke="white" strokeWidth="5" fill="none"/>
        {[76,96,116,147,168,188].map((y,i) => <rect key={y} x={i<3?208:135} y={y} width={i<3?51:118} height="7" rx="2" fill="#e2eaeD"/>)}</g>
        <rect x="54" y="57" width="75" height="45" rx="8" fill="#b5efe0" opacity=".7"/><rect x="248" y="112" width="68" height="42" rx="7" fill="#a2e7d4" opacity=".8"/>
      </>}
      {kind === "communications" && <>
        <rect x="33" y="62" width="65" height="61" rx="13" fill={green} transform="rotate(-4 65 90)"/><path d="M48 80h34v25H48Zm0 0 17 14 17-14" fill="none" stroke="white" strokeWidth="2.5"/>
        <ellipse cx="204" cy="172" rx="39" ry="43" fill={white}/><path d="m175 149-26 26m81-26 23 19" stroke={white} strokeWidth="19" strokeLinecap="round"/>
        <path d="m203 39 3-24" stroke="#178a89" strokeWidth="5"/><circle cx="206" cy="14" r="5" fill="#69dace"/>
        <rect x="150" y="41" width="109" height="99" rx="43" fill={white}/><rect x="165" y="57" width="81" height="65" rx="27" fill="#073843"/>
        <ellipse cx="187" cy="85" rx="6" ry="9" fill="#47f5e9"/><ellipse cx="223" cy="85" rx="6" ry="9" fill="#47f5e9"/><path d="M201 105h10" stroke="#46dcd3" strokeWidth="3" strokeLinecap="round"/>
        <path d="m256 119 28-12 25-31v72l-25-18-28-1Z" fill={green}/><ellipse cx="311" cy="111" rx="17" ry="38" fill={dark} stroke="#00b98b" strokeWidth="5"/><path d="m271 132 6 23" stroke="#007c60" strokeWidth="11" strokeLinecap="round"/>
        <path d="m334 79 10-6m-7 37h12m-17 25 10 6" stroke="#4bd9b2" strokeWidth="5" strokeLinecap="round"/>
      </>}
    </g>
  </svg>;
}
