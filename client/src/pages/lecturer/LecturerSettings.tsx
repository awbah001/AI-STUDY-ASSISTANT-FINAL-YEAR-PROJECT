import { useState } from "react";
import { Link } from "wouter";
import { Moon, Sun, Settings, Palette, BookOpen, ShieldCheck, Info, Check, Save } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { LecturerHero } from "@/components/lecturer/LecturerUi";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { getLecturerQuizLength, saveLecturerQuizLength, QUIZ_LENGTHS } from "@/lib/lecturerPreferences";
import { toast } from "sonner";

export default function LecturerSettings() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [quizLength, setQuizLength] = useState(() => getLecturerQuizLength(user?.id));
  const [savedLength, setSavedLength] = useState(quizLength);
  return <DashboardLayout><main className="lecturer-content lecturer-settings">
    <LecturerHero eyebrow="Account" title="Settings" description="Customize your workspace and teaching preferences." icon={Settings}/>
    <div className="lecturer-settings-grid">
      <section className="lecturer-panel"><div className="lecturer-settings-title"><Palette/><div><h2>Appearance</h2><p>Choose how your workspace looks.</p></div></div>
        <div className="lecturer-setting-row"><div>Theme<small>Saved automatically on this browser.</small></div><div>{(["light","dark"] as const).map(value=><Button key={value} variant={theme===value?"default":"outline"} aria-pressed={theme===value} onClick={()=>theme!==value&&toggleTheme?.()}>{value==="light"?<Sun/>:<Moon/>}{value==="light"?"Light":"Dark"}{theme===value&&<Check/>}</Button>)}</div></div>
      </section>
      <section className="lecturer-panel"><div className="lecturer-settings-title"><BookOpen/><div><h2>Teaching Preferences</h2><p>Defaults used when you create course quizzes.</p></div></div>
        <label className="lecturer-setting-row"><div>Default quiz length<small>Saved for your account on this browser.</small></div><select value={quizLength} onChange={e=>setQuizLength(Number(e.target.value))}>{QUIZ_LENGTHS.map(n=><option key={n} value={n}>{n} questions</option>)}</select></label>
        <Button disabled={!user||quizLength===savedLength} onClick={()=>{if(!user)return;try{saveLecturerQuizLength(user.id,quizLength);setSavedLength(quizLength);toast.success("Teaching preferences saved.");}catch{toast.error("Unable to save preferences in this browser.");}}}><Save/>Save preferences</Button>
      </section>
      <section className="lecturer-panel"><div className="lecturer-settings-title"><ShieldCheck/><div><h2>Account & Security</h2><p>Keep your information and sign-in details up to date.</p></div></div>
        <div className="lecturer-setting-row"><div>Profile<small>Your display name and photo.</small></div><Link href="/profile">Manage profile →</Link></div>
        <div className="lecturer-setting-row"><div>Sign-in method<small>{user?.loginMethod ?? "—"}</small></div>{user?.loginMethod === "local" && <Link href="/profile">Change password →</Link>}</div>
      </section>
      <section className="lecturer-panel"><div className="lecturer-settings-title"><Info/><div><h2>About Your Workspace</h2><p>Course-Specific AI Learning Assistant lecturer portal.</p></div></div>
        <div className="lecturer-setting-row"><span>Account</span><span className="break-all">{user?.email ?? "—"}</span></div>
        <div className="lecturer-setting-row"><span>Role</span><span>Lecturer</span></div>
        <div className="lecturer-setting-row"><span>Courses</span><Link href="/lecturer/courses">View assigned courses →</Link></div>
      </section>
    </div>
  </main></DashboardLayout>;
}
