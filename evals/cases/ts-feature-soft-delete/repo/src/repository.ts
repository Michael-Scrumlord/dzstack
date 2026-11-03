import type { Project } from "./project.ts";

export interface ProjectRepository {
  insert(project: Project): void;
  findById(id: string): Project | undefined;
  findAll(): Project[];
  update(id: string, patch: Partial<Omit<Project, "id">>): Project | undefined;
  remove(id: string): boolean;
}

// Keeps projects in memory. Everything that goes in or comes out is a copy, so callers can't change stored rows by accident.
export function createProjectRepository(): ProjectRepository {
  const rows = new Map<string, Project>();

  return {
    insert(project) {
      if (rows.has(project.id)) throw new Error(`duplicate project id ${project.id}`);
      rows.set(project.id, { ...project });
    },
    findById(id) {
      const row = rows.get(id);
      return row === undefined ? undefined : { ...row };
    },
    findAll() {
      return [...rows.values()].map((row) => ({ ...row }));
    },
    update(id, patch) {
      const row = rows.get(id);
      if (row === undefined) return undefined;
      const next = { ...row, ...patch, id };
      rows.set(id, next);
      return { ...next };
    },
    remove(id) {
      return rows.delete(id);
    },
  };
}
