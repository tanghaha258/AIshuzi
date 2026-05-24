export interface TeacherInputKey {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
}

export function shouldSendTeacherTurnFromKey(event: TeacherInputKey) {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing;
}
