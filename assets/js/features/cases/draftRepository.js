import { readJson, writeJson } from "../../core/storage.js";

const DRAFT_KEY = "bot_worklog_draft_v1";
const STACK_KEY = "bot_worklog_draft_stack_v1";

export const draftRepository = {
  getDraft() {
    return readJson(DRAFT_KEY, null);
  },

  saveDraft(draft) {
    writeJson(DRAFT_KEY, draft);
  },

  clearDraft() {
    writeJson(DRAFT_KEY, null);
  },

  // stack = lijst van drafts (LIFO)
  pushToStack(draft) {
    const stack = readJson(STACK_KEY, []);
    stack.push(draft);
    writeJson(STACK_KEY, stack);
  },

  popFromStack() {
    const stack = readJson(STACK_KEY, []);
    const draft = stack.pop() ?? null;
    writeJson(STACK_KEY, stack);
    return draft;
  },

  peekStackCount() {
    const stack = readJson(STACK_KEY, []);
    return stack.length;
  }
};
