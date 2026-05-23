import { Bot, Plus, Save } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import type { StudentAgent } from "../../shared/types";

interface StudentsPageProps {
  students: StudentAgent[];
  onSaved: (student: StudentAgent) => void;
}

export function StudentsPage({ students, onSaved }: StudentsPageProps) {
  const [draft, setDraft] = useState({
    name: "",
    avatar: "自定义型",
    personality: "",
    foundation: 60,
    attention: 60,
    comprehension: 60,
    participation: 60,
    behaviorStyle: "",
    status: "观察",
    strategy: ""
  });
  const [saving, setSaving] = useState(false);

  async function saveStudent() {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      const student = await api.upsertStudent(draft);
      onSaved(student);
      setDraft((current) => ({ ...current, name: "", personality: "", behaviorStyle: "", strategy: "" }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Agent Profiles</span>
            <h1>AI学生画像管理</h1>
          </div>
          <Bot size={26} />
        </div>
        <div className="student-management-grid">
          {students.map((student) => (
            <article className="profile-card" key={student.id}>
              <div className="profile-card__top">
                <div className="avatar-token">{student.name.slice(-1)}</div>
                <div>
                  <h3>{student.name}</h3>
                  <span>{student.avatar} · {student.status}</span>
                </div>
              </div>
              <p>{student.personality}</p>
              <div className="profile-bars">
                <label>基础 <meter value={student.foundation} max={100} /></label>
                <label>注意 <meter value={student.attention} max={100} /></label>
                <label>理解 <meter value={student.comprehension} max={100} /></label>
                <label>参与 <meter value={student.participation} max={100} /></label>
              </div>
              <small>{student.strategy}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Create Agent</span>
            <h2>新增学生画像</h2>
          </div>
          <Plus size={22} />
        </div>
        <div className="form-grid">
          <label>
            姓名
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            类型
            <input value={draft.avatar} onChange={(event) => setDraft({ ...draft, avatar: event.target.value })} />
          </label>
          <label>
            状态
            <input value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} />
          </label>
          <label>
            基础
            <input type="number" min={0} max={100} value={draft.foundation} onChange={(event) => setDraft({ ...draft, foundation: Number(event.target.value) })} />
          </label>
          <label>
            注意力
            <input type="number" min={0} max={100} value={draft.attention} onChange={(event) => setDraft({ ...draft, attention: Number(event.target.value) })} />
          </label>
          <label>
            理解度
            <input type="number" min={0} max={100} value={draft.comprehension} onChange={(event) => setDraft({ ...draft, comprehension: Number(event.target.value) })} />
          </label>
          <label>
            参与度
            <input type="number" min={0} max={100} value={draft.participation} onChange={(event) => setDraft({ ...draft, participation: Number(event.target.value) })} />
          </label>
          <label className="form-grid__wide">
            性格描述
            <textarea value={draft.personality} onChange={(event) => setDraft({ ...draft, personality: event.target.value })} />
          </label>
          <label className="form-grid__wide">
            典型行为
            <textarea value={draft.behaviorStyle} onChange={(event) => setDraft({ ...draft, behaviorStyle: event.target.value })} />
          </label>
          <label className="form-grid__wide">
            教师引导策略
            <textarea value={draft.strategy} onChange={(event) => setDraft({ ...draft, strategy: event.target.value })} />
          </label>
        </div>
        <button className="primary-button" type="button" onClick={saveStudent} disabled={saving}>
          <Save size={17} />
          保存学生画像
        </button>
      </section>
    </main>
  );
}
