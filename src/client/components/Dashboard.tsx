import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  MonitorPlay,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Users
} from "lucide-react";
import { useMemo, useState } from "react";
import { findReusableSession, sessionStatusLabel } from "../../shared/sessionLifecycle";
import type { Course, DashboardData, EvaluationReport, StudentAgent, TrainingSession } from "../../shared/types";

interface DashboardProps {
  data: DashboardData;
  onCreateSession: (courseId: string, studentIds: string[], options?: { forceNew?: boolean }) => void;
  onDeleteCourse: (courseId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onNavigate: (view: "students" | "reports" | "settings") => void;
}

const coursePageSize = 6;
const sessionPageSize = 5;

function latestActiveSession(sessions: TrainingSession[]) {
  return sessions.find((session) => session.status !== "completed") ?? sessions[0];
}

function CourseCard({
  course,
  reports,
  sessions,
  students,
  onCreateSession,
  onDeleteCourse,
  onOpenSession
}: {
  course: Course;
  reports: EvaluationReport[];
  sessions: TrainingSession[];
  students: StudentAgent[];
  onCreateSession: (courseId: string, studentIds: string[], options?: { forceNew?: boolean }) => void;
  onDeleteCourse: (courseId: string) => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const reusableSession = findReusableSession(sessions, course.id);
  const relatedSessions = sessions.filter((session) => session.courseId === course.id);
  const relatedSessionIds = new Set(relatedSessions.map((session) => session.id));
  const relatedReports = reports.filter((report) => relatedSessionIds.has(report.sessionId));
  const defaultStudentIds = students.slice(0, 6).map((student) => student.id);

  function confirmDeleteCourse() {
    const relationText = relatedSessions.length
      ? `该课程下已有 ${relatedSessions.length} 次实训、${relatedReports.length} 份报告。删除后历史实训和报告仍会保留，但这个课程入口会从工作台移除。`
      : "该课程暂无实训记录，删除后会移除课程方案和备课脚本。";
    const ok = window.confirm(`确定删除“${course.title} / ${course.topic}”这个课程方案吗？\n\n${relationText}`);
    if (ok) onDeleteCourse(course.id);
  }

  return (
    <article className="course-card">
      <div className="course-card__topline">
        <span className="eyebrow">{course.grade} · {course.subject}</span>
        <button className="icon-only delete-course-button" type="button" onClick={confirmDeleteCourse} title="删除课程方案">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="course-card__body">
        <h3>{course.title}</h3>
        <p>{course.objectives}</p>
      </div>
      <div className="course-card__meta">
        <span>{course.topic}</span>
        <span>{course.durationMinutes} 分钟</span>
      </div>
      <div className="course-card__actions">
        <button
          className="primary-button"
          type="button"
          onClick={() => reusableSession ? onOpenSession(reusableSession.id) : onCreateSession(course.id, defaultStudentIds)}
        >
          <MonitorPlay size={18} />
          {reusableSession ? "继续实训" : "开始实训"}
        </button>
        {reusableSession ? (
          <button className="ghost-button" type="button" onClick={() => onCreateSession(course.id, defaultStudentIds, { forceNew: true })}>
            新建一次
          </button>
        ) : null}
      </div>
    </article>
  );
}

function matchesCourse(course: Course, query: string) {
  const text = `${course.title} ${course.subject} ${course.grade} ${course.topic} ${course.objectives}`.toLowerCase();
  return text.includes(query.trim().toLowerCase());
}

function matchesSession(session: TrainingSession, query: string) {
  const text = `${session.courseTitle} ${session.topic} ${session.status}`.toLowerCase();
  return text.includes(query.trim().toLowerCase());
}

function Pagination({
  page,
  totalPages,
  total,
  onPageChange
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="pagination-controls">
      <span>{total ? `第 ${page} / ${totalPages} 页，共 ${total} 条` : "无匹配结果"}</span>
      <button className="icon-only" type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} title="上一页">
        <ChevronLeft size={17} />
      </button>
      <button className="icon-only" type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} title="下一页">
        <ChevronRight size={17} />
      </button>
    </div>
  );
}

export function Dashboard({ data, onCreateSession, onDeleteCourse, onDeleteSession, onOpenSession, onNavigate }: DashboardProps) {
  const activeSession = latestActiveSession(data.sessions);
  const completed = data.sessions.filter((session) => session.status === "completed").length;
  const [courseQuery, setCourseQuery] = useState("");
  const [coursePage, setCoursePage] = useState(1);
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionPage, setSessionPage] = useState(1);
  const filteredCourses = useMemo(
    () => data.courses.filter((course) => matchesCourse(course, courseQuery)),
    [courseQuery, data.courses]
  );
  const filteredSessions = useMemo(
    () => data.sessions.filter((session) => matchesSession(session, sessionQuery)),
    [data.sessions, sessionQuery]
  );
  const courseTotalPages = Math.max(1, Math.ceil(filteredCourses.length / coursePageSize));
  const sessionTotalPages = Math.max(1, Math.ceil(filteredSessions.length / sessionPageSize));
  const safeCoursePage = Math.min(coursePage, courseTotalPages);
  const safeSessionPage = Math.min(sessionPage, sessionTotalPages);
  const visibleCourses = filteredCourses.slice((safeCoursePage - 1) * coursePageSize, safeCoursePage * coursePageSize);
  const visibleSessions = filteredSessions.slice((safeSessionPage - 1) * sessionPageSize, safeSessionPage * sessionPageSize);

  function confirmDeleteSession(session: TrainingSession) {
    const ok = window.confirm(`确定删除“${session.courseTitle} / ${session.topic}”这次实训吗？相关课堂事件和报告也会删除。`);
    if (ok) onDeleteSession(session.id);
  }

  return (
    <main className="dashboard-grid">
      <section className="workspace-hero">
        <div>
          <span className="eyebrow">AI Digital Student Micro-Teaching</span>
          <h1>AI数字学生课堂微格实训平台</h1>
          <p>
            面向师范生和新教师的虚拟 AI 学生课堂，支持备课、试讲、突发互动、即时策略提示和课后诊断。
          </p>
        </div>
        <div className="hero-actions">
          {activeSession ? (
            <button className="primary-button" type="button" onClick={() => onOpenSession(activeSession.id)}>
              <Activity size={18} />
              进入最近实训
            </button>
          ) : null}
          <button className="ghost-button" type="button" onClick={() => onNavigate("settings")}>
            <Settings size={18} />
            模型设置
          </button>
        </div>
      </section>

      <section className="metric-strip">
        <div className="metric-tile">
          <CalendarPlus size={20} />
          <strong>{data.courses.length}</strong>
          <span>课程方案</span>
        </div>
        <div className="metric-tile">
          <Users size={20} />
          <strong>{data.students.length}</strong>
          <span>AI学生画像</span>
        </div>
        <div className="metric-tile">
          <MonitorPlay size={20} />
          <strong>{data.sessions.length}</strong>
          <span>实训记录</span>
        </div>
        <div className="metric-tile">
          <CheckCircle2 size={20} />
          <strong>{completed}</strong>
          <span>已生成报告</span>
        </div>
      </section>

      <section className="panel panel--wide course-entry-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Teaching Scripts</span>
            <h2>课程实训入口</h2>
          </div>
          <button className="icon-text-button" type="button">
            <Sparkles size={17} />
            示例已就绪
          </button>
        </div>
        <div className="list-toolbar">
          <label className="search-input">
            <Search size={16} />
            <input
              value={courseQuery}
              placeholder="搜索课程、主题、学科或年级"
              onChange={(event) => {
                setCourseQuery(event.target.value);
                setCoursePage(1);
              }}
            />
          </label>
          <Pagination page={safeCoursePage} totalPages={courseTotalPages} total={filteredCourses.length} onPageChange={setCoursePage} />
        </div>
        <div className="course-grid">
          {visibleCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              reports={data.reports}
              sessions={data.sessions}
              students={data.students}
              onCreateSession={onCreateSession}
              onDeleteCourse={onDeleteCourse}
              onOpenSession={onOpenSession}
            />
          ))}
        </div>
        {!visibleCourses.length ? <div className="empty-state">没有找到匹配课程。</div> : null}
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Students</span>
            <h2>AI学生群体</h2>
          </div>
          <button className="icon-only" type="button" onClick={() => onNavigate("students")} title="管理学生画像">
            <Bot size={18} />
          </button>
        </div>
        <div className="student-preview-list">
          {data.students.slice(0, 5).map((student) => (
            <div className="student-row" key={student.id}>
              <div className="avatar-token">{student.name.slice(-1)}</div>
              <div>
                <strong>{student.name}</strong>
                <span>{student.status} · {student.avatar}</span>
              </div>
              <meter value={student.participation} max={100} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Reports</span>
            <h2>最近诊断</h2>
          </div>
          <button className="icon-only" type="button" onClick={() => onNavigate("reports")} title="查看报告">
            <BarChart3 size={18} />
          </button>
        </div>
        {data.reports[0] ? (
          <div className="report-preview">
            <BrainCircuit size={32} />
            <p>{data.reports[0].summary}</p>
            <button className="ghost-button" type="button" onClick={() => onNavigate("reports")}>
              查看课后报告
            </button>
          </div>
        ) : (
          <div className="empty-state">完成一次微格试讲后，系统会在这里展示课后诊断摘要。</div>
        )}
      </section>

      <section className="panel session-management-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Training Sessions</span>
            <h2>实训记录</h2>
          </div>
          <MonitorPlay size={22} />
        </div>
        <div className="list-toolbar">
          <label className="search-input">
            <Search size={16} />
            <input
              value={sessionQuery}
              placeholder="搜索实训课程、主题或状态"
              onChange={(event) => {
                setSessionQuery(event.target.value);
                setSessionPage(1);
              }}
            />
          </label>
          <Pagination page={safeSessionPage} totalPages={sessionTotalPages} total={filteredSessions.length} onPageChange={setSessionPage} />
        </div>
        <div className="session-list">
          {visibleSessions.map((session) => (
            <article className="session-card" key={session.id}>
              <div>
                <strong>{session.courseTitle}</strong>
                <span>{session.topic}</span>
              </div>
              <div className="course-card__meta">
                <span>{sessionStatusLabel(session.status)}</span>
                <span>{new Date(session.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="session-card__actions">
                <button className="ghost-button" type="button" onClick={() => onOpenSession(session.id)}>
                  <MonitorPlay size={16} />
                  打开
                </button>
                <button className="danger-button delete-session-button" type="button" onClick={() => confirmDeleteSession(session)}>
                  <Trash2 size={16} />
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
        {!visibleSessions.length ? <div className="empty-state">没有找到匹配实训。</div> : null}
      </section>
    </main>
  );
}
