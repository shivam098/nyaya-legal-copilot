export const emptyDraft = { text: '', preview: null, undo: null };

export function intakeDraftReducer(state, action) {
  switch (action.type) {
    case 'edit': {
      const text = typeof action.update === 'function' ? action.update(state.text) : action.update;
      return { ...state, text, preview: null };
    }
    case 'choose': {
      const { text, label } = action.example;
      if (!state.text && !action.hasFiles && !state.undo) return { ...emptyDraft, text };
      return { ...state, preview: { kind: 'example', text, label } };
    }
    case 'cancel':
      return { ...state, preview: null };
    case 'replace': {
      if (!state.preview) return state;
      if (state.preview.text === state.text) return { ...state, preview: null };
      // Trying another unedited example should still undo to the user's own words.
      const cyclingExamples = state.preview.kind === 'example' && state.undo?.kind === 'example' && state.text === state.undo.after;
      return {
        text: state.preview.text,
        preview: null,
        undo: { kind: state.preview.kind, before: cyclingExamples ? state.undo.before : state.text, after: state.preview.text }
      };
    }
    case 'undo':
      if (!state.undo) return state;
      if (state.text === state.undo.after) return { ...emptyDraft, text: state.undo.before };
      // Edits made since replacement are a draft too. Preview instead of discarding them.
      return { ...state, preview: { kind: 'restore', label: 'Previous draft', text: state.undo.before } };
    case 'clear':
      return emptyDraft;
    default:
      throw new Error(`Unknown intake draft action: ${action.type}`);
  }
}

export function composeFollowUp(selectedFacts, note) {
  return [Object.values(selectedFacts).join(' · '), note.trim()].filter(Boolean).join('\n\n');
}
