import type { ProjectRow } from "../db/schema.ts";
import type { ActivityView } from "../repos/activity.ts";
import type { MemberView } from "../repos/members.ts";
import type { TagView } from "../repos/tags.ts";

/** How many members the list shows as an avatar stack; `memberCount` has the full number. */
export const MEMBER_PREVIEW = 5;

export interface ProjectListItem {
  id: number;
  key: string;
  name: string;
  description: string;
  visibility: ProjectRow["visibility"];
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  members: MemberView[];
  tags: TagView[];
  latestActivity: ActivityView | null;
}

export function toListItem(
  project: ProjectRow,
  members: MemberView[],
  tags: TagView[],
  latestActivity: ActivityView | null,
): ProjectListItem {
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    visibility: project.visibility,
    pinned: project.pinned,
    archived: project.archived,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    memberCount: members.length,
    members: members.slice(0, MEMBER_PREVIEW),
    tags,
    latestActivity,
  };
}
