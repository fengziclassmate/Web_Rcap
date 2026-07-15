/**
 * 旧版科研面板的数据形状。
 *
 * 这些类型仅用于读取已有的 schedule_data 备份并迁移到 ResearchWorkflowState。
 * 新功能应使用 research-workflow.ts 中的领域类型。
 */
export type Achievement = {
  id: string;
  date: string;
  title: string;
  note?: string;
};

export type PlanItem = {
  id: string;
  date: string;
  content: string;
  done: boolean;
};

export type ResearchProject = {
  id: string;
  name: string;
  content: string;
  techDetails: string;
  nextStepPlan: string;
  milestones: string;
  dailyPlans: PlanItem[];
  weeklyPlans: PlanItem[];
  monthlyPlans: PlanItem[];
};

export type PaperPlanItem = {
  id: string;
  date: string;
  content: string;
  done: boolean;
};

export type PaperProgress = {
  title: string;
  totalChapters: number;
  doneChapters: number;
  nextStepPlan: string;
  milestones: string;
  dailyPlans: PaperPlanItem[];
  weeklyPlans: PaperPlanItem[];
  monthlyPlans: PaperPlanItem[];
};

export type SubmissionStatus =
  | "准备中"
  | "已投稿"
  | "审稿中"
  | "需要大修"
  | "需要小修"
  | "已接收"
  | "已拒稿"
  | "已撤稿";

export type SubmissionRecord = {
  id: string;
  content: string;
  journal: string;
  submittedAt: string;
  status: SubmissionStatus;
  resultNote: string;
};

export type GroupMeetingRecord = {
  id: string;
  date: string;
  topic: string;
  attendees: string;
  notes: string;
  actionItems: string;
};
