import { ValidationError } from "./errors.ts";
import type { EditableFields } from "./types.ts";

interface Template {
  body: string;
  tags: string[];
}

const TEMPLATES: Record<string, Template> = {
  "meeting-notes": {
    body: "## Attendees\n\n## Agenda\n\n## Decisions\n\n## Action items\n",
    tags: ["meeting"],
  },
  "design-doc": {
    body: "## Problem\n\n## Goals\n\n## Non-goals\n\n## Proposal\n\n## Alternatives\n\n## Open questions\n",
    tags: ["design"],
  },
  postmortem: {
    body: "## Summary\n\n## Timeline\n\n## Impact\n\n## Root cause\n\n## What we will change\n",
    tags: ["incident"],
  },
};

export function templateNames(): string[] {
  return Object.keys(TEMPLATES);
}

/**
 * Fills the parts of a new document the caller left empty from a template. A body or tags the
 * caller gave always win; the template's tags are added to the ones given.
 */
export function applyTemplate(name: unknown, input: EditableFields, given: { body: boolean }): EditableFields {
  if (name === undefined) return input;
  if (typeof name !== "string" || !(name in TEMPLATES)) {
    throw new ValidationError(`template must be one of ${templateNames().join(", ")}`);
  }
  const template = TEMPLATES[name] as Template;
  const tags = [...input.tags];
  for (const tag of template.tags) if (!tags.includes(tag)) tags.push(tag);
  return { ...input, body: given.body ? input.body : template.body, tags };
}
