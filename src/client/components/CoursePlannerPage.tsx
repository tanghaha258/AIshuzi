import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, MonitorPlay, Plus, Save, Search, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { Course, GenerateLessonPlanPayload, LessonPlan, StudentAgent } from "../../shared/types";
import { LessonPlanPanel } from "./planner/LessonPlanPanel";

interface CoursePlannerPageProps {
  courses: Course[];
  students: StudentAgent[];
  onCourseCreated: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onCreateSession: (courseId: string, studentIds: string[], options?: { forceNew?: boolean }) => void;
}

interface GeneratedPlanState {
  course: Course;
  lessonPlan: LessonPlan;
  usedModel: boolean;
  fallbackReason: string;
}

const emptyDraft: GenerateLessonPlanPayload = {
  planningMode: "free-topic",
  title: "",
  subject: "",
  grade: "",
  textbookVersion: "",
  volume: "",
  unit: "",
  lesson: "",
  period: "",
  topic: "",
  objectives: "",
  durationMinutes: 10,
  processEvaluation: {
    focus: "",
    method: "",
    peerReviewPrompt: "",
    evidenceTypes: []
  }
};

const exampleDraft: GenerateLessonPlanPayload = {
  planningMode: "textbook",
  title: "勾股定理微格试讲脚本",
  subject: "数学",
  grade: "八年级",
  textbookVersion: "人教版",
  volume: "八年级下册",
  unit: "第十八章",
  lesson: "勾股定理",
  period: "第1课时",
  topic: "勾股定理的生活化理解",
  objectives: "学生能够用生活例子解释直角三角形三边关系，并完成一次即时判断。",
  durationMinutes: 10,
  processEvaluation: {
    focus: "学生能否说出直角三角形三边关系的依据",
    method: "教师观察 + 学生自评 + 同伴互评",
    peerReviewPrompt: "请同桌判断对方是否指出了直角边和斜边，并补充一个理由。",
    evidenceTypes: ["学生复述", "追问回应", "同伴反馈"]
  }
};

const setupCoursePageSize = 8;

export function CoursePlannerPage({
  courses,
  students,
  onCourseCreated,
  onDeleteCourse,
  onCreateSession
}: CoursePlannerPageProps) {
  const [draft, setDraft] = useState<GenerateLessonPlanPayload>(emptyDraft);
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? "");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(students.slice(0, 6).map((student) => student.id));
  const [generated, setGenerated] = useState<GeneratedPlanState | null>(null);
  const [setupCourseQuery, setSetupCourseQuery] = useState("");
  const [setupCoursePage, setSetupCoursePage] = useState(1);
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
  const filteredSetupCourses = useMemo(() => {
    const query = setupCourseQuery.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) =>
      `${course.title} ${course.subject} ${course.grade} ${course.topic} ${course.objectives}`.toLowerCase().includes(query)
    );
  }, [courses, setupCourseQuery]);
  const setupCourseTotalPages = Math.max(1, Math.ceil(filteredSetupCourses.length / setupCoursePageSize));
  const safeSetupCoursePage = Math.min(setupCoursePage, setupCourseTotalPages);
  const visibleSetupCourses = filteredSetupCourses.slice(
    (safeSetupCoursePage - 1) * setupCoursePageSize,
    safeSetupCoursePage * setupCoursePageSize
  );
  const processEvaluation = draft.processEvaluation ?? emptyDraft.processEvaluation!;
  const evidenceTypesText = processEvaluation.evidenceTypes.join("、");
  const canGenerate = Boolean(draft.subject.trim() && draft.grade.trim() && draft.topic.trim());

  function updateProcessEvaluation(field: "focus" | "method" | "peerReviewPrompt", value: string) {
    setDraft((current) => ({
      ...current,
      processEvaluation: {
        ...(current.processEvaluation ?? emptyDraft.processEvaluation!),
        [field]: value
      }
    }));
  }

  function updateEvidenceTypes(value: string) {
    setDraft((current) => ({
      ...current,
      processEvaluation: {
        ...(current.processEvaluation ?? emptyDraft.processEvaluation!),
        evidenceTypes: value
          .split(/[、,，;；\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
      }
    }));
  }

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
    if (!canGenerate) return;
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
        durationMinutes: Number(draft.durationMinutes || 10),
        processEvaluation: {
          focus: draft.processEvaluation?.focus.trim() ?? "",
          method: draft.processEvaluation?.method.trim() ?? "",
          peerReviewPrompt: draft.processEvaluation?.peerReviewPrompt.trim() ?? "",
          evidenceTypes: draft.processEvaluation?.evidenceTypes ?? []
        }
      });
      setGenerated({
        course: result.course,
        lessonPlan: result.lessonPlan,
        usedModel: result.usedModel,
        fallbackReason: result.fallbackReason
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
    onCreateSession(generated.course.id, selectedStudentIds, { forceNew: true });
  }

  function confirmDeleteCourse(course: Course) {
    const ok = window.confirm(`确定删除“${course.title} / ${course.topic}”这个课程方案吗？\n\n这里只会移除课程方案和备课脚本，历史实训和报告仍会保留。`);
    if (!ok) return;
    onDeleteCourse(course.id);
    if (selectedCourseId === course.id) {
      const fallback = courses.find((item) => item.id !== course.id);
      setSelectedCourseId(fallback?.id ?? "");
    }
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
          <button className="ghost-button planner-example-button" type="button" onClick={() => setDraft(exampleDraft)}>
            <Sparkles size={16} />
            填入示例
          </button>
          <div className="planner-mode-switch" role="group" aria-label="备课模式">
            <button
              className={draft.planningMode === "textbook" ? "planner-mode-switch__item planner-mode-switch__item--active" : "planner-mode-switch__item"}
              type="button"
              onClick={() => setDraft({ ...draft, planningMode: "textbook", topic: draft.lesson || draft.topic })}
            >
              教材课时备课
            </button>
            <button
              className={draft.planningMode !== "textbook" ? "planner-mode-switch__item planner-mode-switch__item--active" : "planner-mode-switch__item"}
              type="button"
              onClick={() => setDraft({ ...draft, planningMode: "free-topic" })}
            >
              自由主题微格备课
            </button>
          </div>
          <div className="form-grid">
            <label>
              课程标题
              <input placeholder="例如：勾股定理微格试讲脚本" value={draft.title ?? ""} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <label>
              学科
              <input placeholder="例如：数学" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} />
            </label>
            <label>
              年级
              <input placeholder="例如：八年级" value={draft.grade} onChange={(event) => setDraft({ ...draft, grade: event.target.value })} />
            </label>
            <label>
              试讲主题
              <input placeholder="例如：勾股定理的生活化理解" value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} />
            </label>
            {draft.planningMode === "textbook" ? (
              <>
                <label>
                  教材版本
                  <input placeholder="例如：人教版" value={draft.textbookVersion ?? ""} onChange={(event) => setDraft({ ...draft, textbookVersion: event.target.value })} />
                </label>
                <label>
                  册次
                  <input placeholder="例如：八年级下册" value={draft.volume ?? ""} onChange={(event) => setDraft({ ...draft, volume: event.target.value })} />
                </label>
                <label>
                  单元
                  <input placeholder="例如：第十八章" value={draft.unit ?? ""} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} />
                </label>
                <label>
                  课题
                  <input
                    placeholder="例如：勾股定理"
                    value={draft.lesson ?? ""}
                    onChange={(event) => setDraft({ ...draft, lesson: event.target.value, topic: event.target.value || draft.topic })}
                  />
                </label>
                <label>
                  课时
                  <input placeholder="例如：第1课时" value={draft.period ?? ""} onChange={(event) => setDraft({ ...draft, period: event.target.value })} />
                </label>
              </>
            ) : null}
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
              <textarea
                placeholder="例如：学生能够用生活例子解释直角三角形三边关系，并完成一次即时判断。"
                value={draft.objectives}
                onChange={(event) => setDraft({ ...draft, objectives: event.target.value })}
              />
            </label>
          </div>
          <div className="process-evaluation-fields">
            <label>
              过程性评价重点
              <input
                placeholder="例如：学生能否说出直角边、斜边和平方和关系的依据"
                value={processEvaluation.focus}
                onChange={(event) => updateProcessEvaluation("focus", event.target.value)}
              />
            </label>
            <label>
              评价方式
              <input
                placeholder="例如：教师观察 + 学生自评 + 同伴互评"
                value={processEvaluation.method}
                onChange={(event) => updateProcessEvaluation("method", event.target.value)}
              />
            </label>
            <label className="process-evaluation-fields__wide">
              自评/互评提示语
              <textarea
                placeholder="例如：请同桌判断对方是否指出了直角边和斜边，并补充一个理由。"
                value={processEvaluation.peerReviewPrompt}
                onChange={(event) => updateProcessEvaluation("peerReviewPrompt", event.target.value)}
              />
            </label>
            <label className="process-evaluation-fields__wide">
              证据类型
              <input
                placeholder="例如：学生复述、追问回应、同伴反馈"
                value={evidenceTypesText}
                onChange={(event) => updateEvidenceTypes(event.target.value)}
              />
            </label>
          </div>
          <div className="planner-actions">
            <button className="primary-button" type="button" onClick={generatePlan} disabled={generating || !canGenerate}>
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
            fallbackReason={generated.fallbackReason}
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
        <div className="list-toolbar">
          <label className="search-input">
            <Search size={16} />
            <input
              value={setupCourseQuery}
              placeholder="搜索课程后创建实训"
              onChange={(event) => {
                setSetupCourseQuery(event.target.value);
                setSetupCoursePage(1);
              }}
            />
          </label>
          <div className="pagination-controls">
            <span>{filteredSetupCourses.length ? `第 ${safeSetupCoursePage} / ${setupCourseTotalPages} 页，共 ${filteredSetupCourses.length} 门` : "无匹配课程"}</span>
            <button className="icon-only" type="button" disabled={safeSetupCoursePage <= 1} onClick={() => setSetupCoursePage(safeSetupCoursePage - 1)} title="上一页">
              <ChevronLeft size={17} />
            </button>
            <button className="icon-only" type="button" disabled={safeSetupCoursePage >= setupCourseTotalPages} onClick={() => setSetupCoursePage(safeSetupCoursePage + 1)} title="下一页">
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <div className="planner-grid planner-list-panel">
          <div className="course-select-list bounded-list">
            {visibleSetupCourses.map((course) => (
              <article className={selectedCourse?.id === course.id ? "select-card-row select-card-row--active" : "select-card-row"} key={course.id}>
                <button
                  className="select-card"
                  type="button"
                  onClick={() => setSelectedCourseId(course.id)}
                >
                  <strong>{course.title}</strong>
                  <span>{course.grade} / {course.subject} / {course.topic}</span>
                </button>
                <button className="icon-only delete-setup-course-button" type="button" onClick={() => confirmDeleteCourse(course)} title="删除课程方案">
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
            {!visibleSetupCourses.length ? <div className="empty-state">没有找到匹配课程。</div> : null}
          </div>
          <div className="student-check-grid bounded-list">
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
          onClick={() => selectedCourse && onCreateSession(selectedCourse.id, selectedStudentIds, { forceNew: true })}
        >
          <MonitorPlay size={17} />
          创建并进入试讲室
        </button>
      </section>
    </main>
  );
}
