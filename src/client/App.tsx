import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CalendarPlus,
  FileText,
  Home,
  Loader2,
  MonitorPlay,
  Settings,
  Sparkles
} from "lucide-react";
import { CoursePlannerPage } from "./components/CoursePlannerPage";
import { Dashboard } from "./components/Dashboard";
import { ReportsPage } from "./components/ReportsPage";
import { SettingsPage } from "./components/SettingsPage";
import { StudentsPage } from "./components/StudentsPage";
import { TrainingRoom } from "./components/TrainingRoom";
import { api } from "./api";
import { findReusableSession } from "../shared/sessionLifecycle";
import type {
  ClassroomEvent,
  DashboardData,
  EvaluationReport,
  StudentAgent,
  StudentRuntimeState,
  TrainingSession
} from "../shared/types";

type View = "dashboard" | "planner" | "training" | "students" | "reports" | "settings";

const emptyData: DashboardData = {
  courses: [],
  students: [],
  sessions: [],
  reports: [],
  lessonPlans: []
};

function viewFromHash(): View {
  const raw = window.location.hash.replace(/^#\/?/, "");
  return ["dashboard", "planner", "training", "students", "reports", "settings"].includes(raw) ? (raw as View) : "dashboard";
}

function NavButton({
  view,
  current,
  label,
  icon,
  onClick
}: {
  view: View;
  current: View;
  label: string;
  icon: React.ReactNode;
  onClick: (view: View) => void;
}) {
  return (
    <button className={current === view ? "nav-button nav-button--active" : "nav-button"} type="button" onClick={() => onClick(view)}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function App() {
  const [view, setView] = useState<View>(() => viewFromHash());
  const [data, setData] = useState<DashboardData>(emptyData);
  const [activeSession, setActiveSession] = useState<TrainingSession | null>(null);
  const [activeEvents, setActiveEvents] = useState<ClassroomEvent[]>([]);
  const [activeRuntimeStates, setActiveRuntimeStates] = useState<StudentRuntimeState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    const next = await api.dashboard();
    setData(next);
    return next;
  }

  useEffect(() => {
    refresh()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (view === "training" && !activeSession && data.sessions[0]) {
      openSession(data.sessions[0].id).catch((err: Error) => setError(err.message));
    }
  }, [activeSession, data.sessions, view]);

  function navigate(next: View) {
    setView(next);
    window.location.hash = next === "dashboard" ? "" : next;
  }

  const selectedStudents = useMemo(() => {
    if (!activeSession) return data.students;
    return data.students.filter((student) => activeSession.selectedStudentIds.includes(student.id));
  }, [activeSession, data.students]);

  async function openSession(sessionId: string) {
    const result = await api.getSession(sessionId);
    setActiveSession(result.session);
    setActiveEvents(result.events);
    setActiveRuntimeStates(result.runtimeStates);
    navigate("training");
  }

  async function createSession(courseId: string, studentIds: string[], options: { forceNew?: boolean } = {}) {
    if (!options.forceNew) {
      const reusableSession = findReusableSession(data.sessions, courseId);
      if (reusableSession) {
        await openSession(reusableSession.id);
        return;
      }
    }
    const session = await api.createSession(courseId, studentIds);
    await refresh();
    await openSession(session.id);
  }

  async function deleteSession(sessionId: string) {
    await api.deleteSession(sessionId);
    const next = await refresh();
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setActiveEvents([]);
      setActiveRuntimeStates([]);
      if (view === "training") {
        const fallbackSession = next.sessions.find((session) => session.status !== "completed") ?? next.sessions[0];
        if (fallbackSession) {
          await openSession(fallbackSession.id);
        } else {
          navigate("dashboard");
        }
      }
    }
  }

  function handleSessionChange(session: TrainingSession) {
    setActiveSession(session);
    setData((current) => ({
      ...current,
      sessions: current.sessions.map((item) => (item.id === session.id ? session : item))
    }));
  }

  function handleReport(report: EvaluationReport) {
    setData((current) => ({
      ...current,
      reports: [report, ...current.reports.filter((item) => item.id !== report.id)]
    }));
    navigate("reports");
  }

  async function deleteReport(reportId: string) {
    await api.deleteReport(reportId);
    await refresh();
  }

  function handleCourseCreated(course: DashboardData["courses"][number]) {
    setData((current) => ({
      ...current,
      courses: [course, ...current.courses.filter((item) => item.id !== course.id)]
    }));
  }

  function handleStudentSaved(student: StudentAgent) {
    setData((current) => ({
      ...current,
      students: [student, ...current.students.filter((item) => item.id !== student.id)]
    }));
  }

  if (loading) {
    return (
      <div className="boot-screen">
        <Loader2 className="spin" size={36} />
        <span>正在启动本地实训平台...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="boot-screen boot-screen--error">
        <strong>平台启动失败</strong>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand-mark">
          <Sparkles size={24} />
          <div>
            <strong>AI数字学生</strong>
            <span>课堂微格实训平台</span>
          </div>
        </div>
        <nav>
          <NavButton view="dashboard" current={view} label="工作台" icon={<Home size={19} />} onClick={navigate} />
          <NavButton view="planner" current={view} label="备课创建" icon={<CalendarPlus size={19} />} onClick={navigate} />
          <NavButton
            view="training"
            current={view}
            label="试讲室"
            icon={<MonitorPlay size={19} />}
            onClick={() => {
              if (activeSession) {
                navigate("training");
              } else if (data.sessions[0]) {
                openSession(data.sessions[0].id).catch((err: Error) => setError(err.message));
              }
            }}
          />
          <NavButton view="students" current={view} label="AI学生" icon={<Bot size={19} />} onClick={navigate} />
          <NavButton view="reports" current={view} label="课后报告" icon={<FileText size={19} />} onClick={navigate} />
          <NavButton view="settings" current={view} label="模型设置" icon={<Settings size={19} />} onClick={navigate} />
        </nav>
      </aside>

      <div className="content-shell">
        {view === "dashboard" ? (
          <Dashboard
            data={data}
            onCreateSession={createSession}
            onDeleteSession={deleteSession}
            onOpenSession={openSession}
            onNavigate={navigate}
          />
        ) : null}
        {view === "planner" ? (
          <CoursePlannerPage
            courses={data.courses}
            students={data.students}
            onCourseCreated={handleCourseCreated}
            onCreateSession={createSession}
          />
        ) : null}
        {view === "training" && activeSession ? (
          <TrainingRoom
            session={activeSession}
            students={selectedStudents}
            initialEvents={activeEvents}
            initialRuntimeStates={activeRuntimeStates}
            onSessionChange={handleSessionChange}
            onReport={handleReport}
          />
        ) : null}
        {view === "training" && !activeSession ? (
          <main className="page-stack">
            <section className="panel empty-state">请先在工作台选择课程并开始一次实训。</section>
          </main>
        ) : null}
        {view === "students" ? <StudentsPage students={data.students} onSaved={handleStudentSaved} /> : null}
        {view === "reports" ? <ReportsPage reports={data.reports} sessions={data.sessions} onDeleteReport={deleteReport} /> : null}
        {view === "settings" ? <SettingsPage data={data} /> : null}
      </div>
    </div>
  );
}
