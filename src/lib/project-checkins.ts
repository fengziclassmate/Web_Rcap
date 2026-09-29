import type { ProjectCheckin, ProjectCheckinArchive } from "@/lib/types";

type ProjectCheckinWithArchives = ProjectCheckin & { archives: ProjectCheckinArchive[] };

export function appendProjectCheckin(project: ProjectCheckin, date: string, note: string, time: string): ProjectCheckin {
  const entry = `${time} · ${note.trim() || "已打卡"}`;
  const exists = project.checkins.some((item) => item.date === date);
  return { ...project, checkins: exists
    ? project.checkins.map((item) => item.date === date ? { ...item, note: [item.note, entry].filter(Boolean).join("\n\n") } : item)
    : [...project.checkins, { date, note: entry }] };
}

export function isProjectCheckinDateInCurrentCycle(project: ProjectCheckin, date: string) {
  return date >= project.startDate;
}

export function archiveProjectCheckinCycle(
  project: ProjectCheckin,
  restartedAt: string,
  archiveId: string,
): ProjectCheckinWithArchives {
  if (project.checkins.length === 0) {
    return { ...project, archives: project.archives ?? [] };
  }

  const sortedCheckins = [...project.checkins].sort((a, b) => a.date.localeCompare(b.date));
  const endDate = sortedCheckins.at(-1)?.date ?? project.startDate;

  return {
    ...project,
    startDate: restartedAt,
    checkins: [],
    archives: [
      {
        id: archiveId,
        startDate: project.startDate,
        endDate,
        archivedAt: new Date().toISOString(),
        checkins: sortedCheckins,
      },
      ...(project.archives ?? []),
    ],
  };
}
