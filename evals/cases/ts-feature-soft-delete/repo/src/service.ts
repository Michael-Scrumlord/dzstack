import { ConflictError, NotFoundError, ValidationError } from "./errors.ts";
import type { Project } from "./project.ts";
import type { ProjectRepository } from "./repository.ts";

export interface ServiceDeps {
  now?: () => number;
  newId?: () => string;
}

export interface ProjectService {
  create(input: { name: unknown }): Project;
  get(id: string): Project;
  list(): Project[];
  rename(id: string, name: unknown): Project;
  delete(id: string): void;
}

function cleanName(raw: unknown): string {
  if (typeof raw !== "string") throw new ValidationError("name must be a string");
  const name = raw.trim();
  if (name === "") throw new ValidationError("name is required");
  if (name.length > 60) throw new ValidationError("name must be at most 60 characters");
  return name;
}

export function createProjectService(repo: ProjectRepository, deps: ServiceDeps = {}): ProjectService {
  const now = deps.now ?? Date.now;
  let counter = 0;
  const newId = deps.newId ?? (() => `p${++counter}`);

  function assertNameFree(name: string, exceptId?: string): void {
    const taken = repo.findAll().some((p) => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase());
    if (taken) throw new ConflictError(`a project named "${name}" already exists`);
  }

  return {
    create(input) {
      const name = cleanName(input.name);
      assertNameFree(name);
      const project: Project = { id: newId(), name, createdAt: now() };
      repo.insert(project);
      return project;
    },
    get(id) {
      const project = repo.findById(id);
      if (project === undefined) throw new NotFoundError();
      return project;
    },
    list() {
      return repo.findAll();
    },
    rename(id, rawName) {
      const name = cleanName(rawName);
      if (repo.findById(id) === undefined) throw new NotFoundError();
      assertNameFree(name, id);
      return repo.update(id, { name }) as Project;
    },
    delete(id) {
      if (!repo.remove(id)) throw new NotFoundError();
    },
  };
}
