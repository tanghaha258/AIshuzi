import { CalendarPlus, Loader2, MonitorPlay, Plus, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { Course, GenerateLessonPlanPayload, LessonPlan, StudentAgent } from "../../shared/types";
import { LessonPlanPanel } from "./planner/LessonPlanPanel";

interface CoursePlannerPageProps {
  courses: Course[];
  students: StudentAgent[];
  onCourseCreated: (course: Course) => void;
  onCreateSession: (courseId: string, studentIds: string[]) => void;
}

interface GeneratedPlanState {
  course: Course;
  lessonPlan: LessonPlan;
  usedModel: boolean;
}

const initialDraft: GenerateLessonPlanPayload = {
  title: "",
  subject: "数学",
  grade: "八年级",
  topic: "勾股定理的生活化理解",
  objectives: "学生能够用生活例子解释直角三角形三边关系，并完成一次即时判断。",
  durationMinutes: 10
};

export function CoursePlannerPage({
  courses,
  students,
  onCourseCreated,
  onCreateSession
}: CoursePlannerPageProps) {
  const [draft, setDraft] = useState<GenerateLessonPlanPayload>(initialDraft);
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? "");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(students.slice(0, 6).map((student) => student.id));
  const [generated, setGenerated] = useState<GeneratedPlanState | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedCourseId && courses[0]) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  useEffect(() => {
    if (students.length && selectedStudentIds.length === 0) {
      setSelectedStudentIds(students.slice(0, 6).map((student) => student.id));
    }
  }, [selectedStudentIds.length, students]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? courses[0],
    [courses, selectedCourseId]
  );

  const recommendedIds = useMemo(
    () => new Set(generated?.lessonPlan.recommendedStudentIds ?? []),
    [generated]
  );

  async function saveCourse() {
    if (!draft.title?.trim() || !draft.topic.trim()) return;
    setSaving(true);
    setError("");
    try {
      const course = await api.createCourse({
        title: draft.title.trim(),
        subject: draft.subject.trim(),
        grade: draft.grade.trim(),
        topic: draft.topic.trim(),
        objectives: draft.objectives.trim() || "完成课堂导入、关键提问、即时反馈和课堂收束训练。",
        durationMinutes: Number(draft.durationMinutes || 10)
      });
      onCourseCreated(course);
      setSelectedCourseId(course.id);
      setDraft((current) => ({ ...current, title: "", topic: "", objectives: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存课程失败。");
    } finally {
      setSaving(false);
    }
  }

  async function generatePlan() {
    if (!draft.subject.trim() || !draft.grade.trim() || !draft.topic.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const result = await api.generateLessonPlan({
        ...draft,
        subject: draft.subject.trim(),
        grade: draft.grade.trim(),
        topic: draft.topic.trim(),
        title: draft.title?.trim(),
        objectives: draft.objectives.trim(),
        durationMinutes: Number(draft.durationMinutes || 10)
      });
      setGenerated({
        course: result.course,
        lessonPlan: result.lessonPlan,
        usedModel: result.usedModel
      });
      onCourseCreated(result.course);
      setSelectedCourseId(result.course.id);
      setSelectedStudentIds(
        result.lessonPlan.recommendedStudentIds.length
          ? result.lessonPlan.recommendedStudentIds
          : result.recommendedStudents.map((student) => student.id)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成备课脚本失败。");
    } finally {
      setGenerating(false);
    }
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  }

  function startGeneratedSession() {
    if (!generated || selectedStudentIds.length === 0) return;
    onCreateSession(generated.course.id, selectedStudentIds);
  }

  return (
    <main className="page-stack">
      <section className="generated-planner-grid">
        <div className="panel planner-form-column">
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
              <input value={draft.title ?? ""} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
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
          <div className="planner-actions">
            <button className="primary-button" type="button" onClick={generatePlan} disabled={generating || !draft.topic.trim()}>
              {generating ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
              AI生成备课脚本
            </button>
            <button className="ghost-button" type="button" onClick={saveCourse} disabled={saving || !draft.title || !draft.topic}>
              <Save size={17} />
              保存课程方案
            </button>
          </div>
          {error ? <p className="generation-error">{error}</p> : null}
        </div>

        {generated ? (
          <LessonPlanPanel
            lessonPlan={generated.lessonPlan}
            students={students}
            usedModel={generated.usedModel}
            canStart={selectedStudentIds.length > 0}
            onStart={startGeneratedSession}
          />
        ) : (
          <div className="lesson-plan-panel lesson-plan-panel--empty">
            <div className="lesson-plan-panel__header">
              <div>
                <span className="eyebrow">Generated Script</span>
                <h2>等待备课脚本</h2>
              </div>
              <Sparkles size={24} />
            </div>
            <p>生成后会在这里呈现课堂阶段、预设突发事件和推荐 AI 学生组合。</p>
          </div>
        )}
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
                <span>{course.grade} / {course.subject} / {course.topic}</span>
              </button>
            ))}
          </div>
          <div className="student-check-grid">
            {students.map((student) => (
              <label
                className={recommendedIds.has(student.id) ? "student-check student-check--recommended" : "student-check"}
                key={student.id}
              >
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes(student.id)}
                  onChange={() => toggleStudent(student.id)}
                />
                <span>{student.name}</span>
                <small>{recommendedIds.has(student.id) ? "AI推荐" : student.avatar}</small>
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
