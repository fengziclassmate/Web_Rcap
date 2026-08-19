import type { ProjectCheckin, ProjectCheckinArchive } from "@/lib/types";

type ProjectCheckinWithArchives = ProjectCheckin & { archives: ProjectCheckinArchive[] };

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
