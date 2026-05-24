import type { SessionStatus, TrainingSession } from "./types.js";

const statusLabels: Record<SessionStatus, string> = {
  draft: "未开始",
  active: "进行中",
  completed: "已完成"
};

export function sessionStatusLabel(status: SessionStatus) {
  return statusLabels[status] ?? "未知";
}

function timeValue(value?: string) {
  return value ? new Date(value).getTime() || 0 : 0;
}

export function findReusableSession(sessions: TrainingSession[], courseId: string) {
  const unfinished = sessions
    .filter((session) => session.courseId === courseId && session.status !== "completed")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return timeValue(b.startedAt ?? b.createdAt) - timeValue(a.startedAt ?? a.createdAt);
    });
  return unfinished[0];
}
