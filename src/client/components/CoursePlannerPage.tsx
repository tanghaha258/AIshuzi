import { CalendarPlus, MonitorPlay, Plus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../api";
import type { Course, StudentAgent } from "../../shared/types";

interface CoursePlannerPageProps {
  courses: Course[];
  students: StudentAgent[];
  onCourseCreated: (course: Course) => void;
  onCreateSession: (courseId: string, studentIds: string[]) => void;
}

export function CoursePlannerPage({
  courses,
  students,
  onCourseCreated,
  onCreateSession
}: CoursePlannerPageProps) {
  const [draft, setDraft] = useState({
    title: "",
    subject: "数学",
    grade: "八年级",
    topic: "",
    objectives: "",
    durationMinutes: 10
  });
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? "");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(students.slice(0, 6).map((student) => student.id));
  const [saving, setSaving] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? courses[0],
    [courses, selectedCourseId]
  );

  async function saveCourse() {
    if (!draft.title.trim() || !draft.topic.trim()) return;
    setSaving(true);
    try {
      const course = await api.createCourse({
        ...draft,
        title: draft.title.trim(),
        topic: draft.topic.trim(),
        objectives: draft.objectives.trim() || "完成课堂导入、关键提问、即时反馈和课堂收束训练。"
      });
      onCourseCreated(course);
      setSelectedCourseId(course.id);
      setDraft((current) => ({ ...current, title: "", topic: "", objectives: "" }));
    } finally {
      setSaving(false);
    }
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  }

  return (
    <main className="page-stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Lesson Planning</span>
            <h1>备课与实训创建</h1>
          </div>
          <CalendarPlus size={26} />
        </div>
        <div className="form-grid">
          <label>
            课程标题
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label>
            学科
            <input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} />
          </label>
          <label>
            年级
            <input value={draft.grade} onChange={(event) => setDraft({ ...draft, grade: event.target.value })} />
          </label>
          <label>
            试讲主题
            <input value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} />
          </label>
          <label>
            时长
            <input
              type="number"
              min={5}
              max={45}
              value={draft.durationMinutes}
              onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })}
            />
          </label>
          <label className="form-grid__wide">
            教学目标
            <textarea value={draft.objectives} onChange={(event) => setDraft({ ...draft, objectives: event.target.value })} />
          </label>
        </div>
        <button className="primary-button" type="button" onClick={saveCourse} disabled={saving || !draft.title || !draft.topic}>
          <Save size={17} />
          保存课程方案
        </button>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Training Setup</span>
            <h2>创建微格实训</h2>
          </div>
          <Plus size={24} />
        </div>
        <div className="planner-grid">
          <div className="course-select-list">
            {courses.map((course) => (
              <button
                className={selectedCourse?.id === course.id ? "select-card select-card--active" : "select-card"}
                key={course.id}
                type="button"
                onClick={() => setSelectedCourseId(course.id)}
              >
                <strong>{course.title}</strong>
                <span>{course.grade} · {course.subject} · {course.topic}</span>
              </button>
            ))}
          </div>
          <div className="student-check-grid">
            {students.map((student) => (
              <label className="student-check" key={student.id}>
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes(student.id)}
                  onChange={() => toggleStudent(student.id)}
                />
                <span>{student.name}</span>
                <small>{student.avatar}</small>
              </label>
            ))}
          </div>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={!selectedCourse || selectedStudentIds.length === 0}
          onClick={() => selectedCourse && onCreateSession(selectedCourse.id, selectedStudentIds)}
        >
          <MonitorPlay size={17} />
          创建并进入试讲室
        </button>
      </section>
    </main>
  );
}
