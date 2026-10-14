import DashboardLayout from "@/components/DashboardLayout";
import { LecturerHero, LecturerStats, downloadCsv } from "@/components/lecturer/LecturerUi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { trpc } from "@/lib/trpc";
import { Users, Search, BookOpen, Mail, Download, Plus, Eye, GraduationCap } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { FieldError } from "@/components/FieldError";
import { useFieldErrors } from "@/lib/formValidation";
import { validateEmail } from "@shared/validation";
import { levelLabel } from "@shared/academics";

export default function LecturerStudents() {
  const { isAllowed } = useRoleGuard("lecturer");
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [courseTab, setCourseTab] = useState("all");
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [enrollCourse, setEnrollCourse] = useState("");
  const { errors, check, clear } = useFieldErrors<"course" | "email">();
  const utils = trpc.useUtils();
  const courses = trpc.lecturer.courses.list.useQuery(undefined, { enabled: isAllowed });
  const students = trpc.lecturer.students.listAll.useQuery(undefined, { enabled: isAllowed });
  const enroll = trpc.lecturer.students.enroll.useMutation({ onSuccess: result => {
    if (!result.success) return toast.error(result.message);
    toast.success(result.message); setOpen(false); setEmail(""); utils.lecturer.students.listAll.invalidate(); utils.lecturer.dashboardStats.invalidate();
  }, onError: e => toast.error(e.message) });
  if (!isAllowed) return null;
  const all = students.data ?? [];
  const programmeOptions = [...new Set(all.map(s => s.programme?.trim()).filter((v): v is string => Boolean(v)))].sort();
  const levelOptions = [...new Set(all.map(s => levelLabel(s.level)).filter(v => v !== "\u2014"))].sort();
  const scoped = all.filter(s =>
    (courseTab === "all" || s.courseId === Number(courseTab)) &&
    (!programmeFilter || s.programme?.trim() === programmeFilter) &&
    (!levelFilter || levelLabel(s.level) === levelFilter)
  );
  const matchedIds = new Set(scoped.filter(s => [s.name,s.email,s.courseTitle].some(v => v?.toLowerCase().includes(search.toLowerCase()))).map(s => s.studentId));
  const grouped = new Map<number, { student: (typeof all)[number]; courses: (typeof all) }>();
  for (const s of scoped) if (matchedIds.has(s.studentId)) {
    if (!grouped.has(s.studentId)) grouped.set(s.studentId, { student:s, courses:[] });
    grouped.get(s.studentId)!.courses.push(s);
  }
  const rows = [...grouped.values()];
  const exportStudents = () => downloadCsv("students.csv", [["Name","Email","Student ID","Programme","Year","Courses","Enrolled"], ...rows.map(({student:s,courses:c}) => [s.name,s.email,s.studentNumber ?? "",s.programme ?? "",s.level ? levelLabel(s.level) : "",c.map(v=>v.courseTitle).join("; "),new Date(s.enrolledAt).toLocaleDateString()])]);
  return <DashboardLayout><main className="lecturer-content lecturer-students">
    <LecturerHero eyebrow="Learners" title="Students" description="View and manage students enrolled in your courses. Use course tabs to filter the list." icon={Users}/>
    <LecturerStats items={[
      {label:"Enrolled Students",value:students.data ? new Set(all.map(s=>s.studentId)).size : "\u2014",hint:"Across your courses",icon:Users},
      {label:"Courses in View",value:courses.data ? (courseTab === "all" ? courses.data.length : 1) : "\u2014",hint:"Active and archived courses",icon:BookOpen},
      {label:"Search Results",value:students.data ? rows.length : "\u2014",hint:"Matching students",icon:Search},
      {label:"Course Enrollments",value:students.data ? all.length : "\u2014",hint:"Across your courses",icon:GraduationCap},
    ]}/>
    <div className="lecturer-tabs"><button className={courseTab === "all" ? "selected" : ""} onClick={()=>setCourseTab("all")}>All courses ({new Set(all.map(s=>s.studentId)).size})</button>{courses.data?.map(c=><button key={c.id} className={courseTab===String(c.id)?"selected":""} onClick={()=>setCourseTab(String(c.id))}>{c.title} ({all.filter(s=>s.courseId===c.id).length})</button>)}</div>
    <div className="lecturer-filterbar"><label className="lecturer-search"><Search/><Input aria-label="Search students" placeholder="Search by name, email, or course..." value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Filter by course" value={courseTab} onChange={e=>setCourseTab(e.target.value)}><option value="all">All Courses</option>{courses.data?.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select><select aria-label="Filter by programme" value={programmeFilter} onChange={e=>setProgrammeFilter(e.target.value)}><option value="">All programmes</option>{programmeOptions.map(p=><option key={p} value={p}>{p}</option>)}</select><select aria-label="Filter by year" value={levelFilter} onChange={e=>setLevelFilter(e.target.value)}><option value="">All years</option>{levelOptions.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
    <section className="lecturer-panel"><div className="lecturer-panel-heading"><span><Users/><h2>Students ({rows.length})</h2></span><div><Button variant="accent-outline" onClick={exportStudents} disabled={!rows.length}><Download/>Export</Button><Button onClick={()=>setOpen(true)}><Plus/>Add Student</Button></div></div>
    <div className="lecturer-table-scroll"><table className="lecturer-table"><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Programme</th><th>Courses Enrolled</th><th>Enrolled</th><th>Actions</th></tr></thead><tbody>
      {rows.map(({student:s,courses:c},i)=><tr key={s.studentId}><td>{i+1}</td><td><span className="lecturer-person">{s.avatarUrl ? <img src={s.avatarUrl} alt=""/> : <span className={`lecturer-initial lecturer-tone-${i%3}`}>{s.name?.split(" ").map(v=>v[0]).join("").slice(0,2)}</span>}{s.name}</span></td><td>{s.email}</td><td>{s.programme ? <>{s.programme}<br/><small className="text-slate-500">{levelLabel(s.level)}{s.academicStatus === "completed" ? " \u00b7 Completed" : ""}</small></> : "\u2014"}</td><td><div className="lecturer-course-badges">{c.map(v=><button key={v.courseId} onClick={()=>navigate(`/lecturer/courses/${v.courseId}`)}>{v.courseTitle}</button>)}</div></td><td>{new Date(s.enrolledAt).toLocaleDateString(undefined,{dateStyle:"medium"})}</td><td><div className="lecturer-row-actions"><button aria-label={`View ${s.name}'s course`} onClick={()=>navigate(`/lecturer/courses/${s.courseId}`)}><Eye/></button>{s.email && <a aria-label={`Email ${s.name}`} href={`mailto:${s.email}`}><Mail/></a>}</div></td></tr>)}
      {!rows.length && <tr><td colSpan={7} className="lecturer-empty">{students.isLoading ? "Loading students..." : students.isError ? "Unable to load students. Please try again." : "No students match this view."}</td></tr>}
    </tbody></table></div><footer className="lecturer-table-footer">Showing {rows.length ? 1 : 0} to {rows.length} of {rows.length} students</footer></section>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader><form noValidate className="space-y-4" onSubmit={e=>{e.preventDefault();const ok=check({course:enrollCourse?null:"Choose a course.",email:validateEmail(email)});if(ok)enroll.mutate({courseId:Number(enrollCourse),email:email.trim()});}}><label className="block space-y-2"><span>Course</span><select aria-invalid={Boolean(errors.course)} className="h-10 w-full rounded-xl border px-3" value={enrollCourse} onChange={e=>{setEnrollCourse(e.target.value);clear("course");}}><option value="">Select course</option>{courses.data?.filter(c=>c.isActive).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select><FieldError message={errors.course}/></label><label className="block space-y-2"><span>Student email</span><Input type="email" maxLength={254} placeholder="student@central.edu.sl" aria-invalid={Boolean(errors.email)} value={email} onChange={e=>{setEmail(e.target.value);clear("email");}}/><FieldError message={errors.email}/></label><Button disabled={enroll.isPending} type="submit">{enroll.isPending?"Enrolling...":"Enroll student"}</Button></form></DialogContent></Dialog>
  </main></DashboardLayout>;
}
