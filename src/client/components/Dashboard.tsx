import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  CalendarPlus,
  CheckCircle2,
  MonitorPlay,
  Settings,
  Sparkles,
  Users
} from "lucide-react";
import type { Course, DashboardData, StudentAgent, TrainingSession } from "../../shared/types";

interface DashboardProps {
  data: DashboardData;
  onCreateSession: (courseId: string, studentIds: string[]) => void;
  onOpenSession: (sessionId: string) => void;
  onNavigate: (view: "students" | "reports" | "settings") => void;
}

function latestActiveSession(sessions: TrainingSession[]) {
  return sessions.find((session) => session.status !== "completed") ?? sessions[0];
}

function CourseCard({
  course,
  students,
  onCreateSession
}: {
  course: Course;
  students: StudentAgent[];
  onCreateSession: (courseId: string, studentIds: string[]) => void;
}) {
  return (
    <article className="course-card">
      <div>
        <span className="eyebrow">{course.grade} · {course.subject}</span>
        <h3>{course.title}</h3>
        <p>{course.objectives}</p>
      </div>
      <div className="course-card__meta">
        <span>{course.topic}</span>
        <span>{course.durationMinutes} 分钟</span>
      </div>
      <button
        className="primary-button"
        type="button"
        onClick={() => onCreateSession(course.id, students.slice(0, 6).map((student) => student.id))}
      >
        <MonitorPlay size={18} />
        开始实训
      </button>
    </article>
  );
}

export function Dashboard({ data, onCreateSession, onOpenSession, onNavigate }: DashboardProps) {
  const activeSession = latestActiveSession(data.sessions);
  const completed = data.sessions.filter((session) => session.status === "completed").length;

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

      <section className="panel panel--wide">
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
        <div className="course-grid">
          {data.courses.map((course) => (
            <CourseCard key={course.id} course={course} students={data.students} onCreateSession={onCreateSession} />
          ))}
        </div>
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
    </main>
  );
}
