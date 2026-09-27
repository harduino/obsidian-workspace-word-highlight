import {
  App,
  MarkdownView,
  Platform,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";
import { StateEffect, type Extension, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

interface WorkspaceWordHighlightSettings {
  enabled: boolean;
  caseSensitive: boolean;
  wholeWords: boolean;
  minWordLength: number;
  maxOccurrencesPerEditor: number;
  debounceMs: number;
  extraWordCharacters: string;
  highlightActiveOccurrence: boolean;
  androidSelectionGuard: boolean;
}

const MAX_SELECTION_LENGTH = 500;

const DEFAULT_SETTINGS: WorkspaceWordHighlightSettings = {
  enabled: true,
  caseSensitive: true,
  wholeWords: true,
  minWordLength: 2,
  maxOccurrencesPerEditor: 1000,
  debounceMs: 25,
  extraWordCharacters: "",
  highlightActiveOccurrence: true,
  androidSelectionGuard: true,
};

type HighlightOrigin = "cursor" | "selection";

interface HighlightQuery {
  text: string;
  origin: HighlightOrigin;
  sourceView: EditorView;
  sourceFrom: number;
  sourceTo: number;
  caseSensitive: boolean;
  wholeWord: boolean;
  extraWordCharacters: string;
  maxOccurrencesPerEditor: number;
  highlightActiveOccurrence: boolean;
}

interface WordRange {
  from: number;
  to: number;
  text: string;
}

/**
 * A no-op CodeMirror effect used only to tell every editor ViewPlugin that the
 * global highlight query has changed and its decorations must be rebuilt.
 */
const refreshHighlightsEffect = StateEffect.define<void>();

export default class WorkspaceWordHighlightPlugin extends Plugin {
  settings: WorkspaceWordHighlightSettings = { ...DEFAULT_SETTINGS };

  private readonly editorViews = new Set<EditorView>();
  private currentQuery: HighlightQuery | null = null;
  private refreshTimer: number | null = null;
  private pendingRefreshSourceView: EditorView | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerEditorExtension(this.createEditorExtension());
    this.addSettingTab(new WorkspaceWordHighlightSettingTab(this.app, this));

    this.addCommand({
      id: "toggle-highlighting",
      name: "Toggle highlights",
      callback: async () => {
        this.settings.enabled = !this.settings.enabled;
        await this.saveSettings();

        if (!this.settings.enabled) {
          this.setCurrentQuery(null);
        } else {
          this.recomputeFromActiveMarkdownView();
        }
      },
    });

    this.addCommand({
      id: "clear-highlighting",
      name: "Clear highlights",
      callback: () => this.setCurrentQuery(null),
    });
  }

  onunload(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.pendingRefreshSourceView = null;
    this.currentQuery = null;
    this.editorViews.clear();
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<WorkspaceWordHighlightSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved ?? {});
    this.sanitizeSettings();
  }

  async saveSettings(): Promise<void> {
    this.sanitizeSettings();
    await this.saveData(this.settings);
  }

  onSettingsChanged(): void {
    this.sanitizeSettings();

    if (!this.settings.enabled) {
      this.setCurrentQuery(null);
      return;
    }

    if (this.currentQuery) {
      const query = this.currentQuery;

      if (query.origin === "cursor" && query.text.length < this.settings.minWordLength) {
        this.setCurrentQuery(null);
        return;
      }

      this.currentQuery = {
        ...query,
        caseSensitive: this.settings.caseSensitive,
        wholeWord: query.origin === "cursor" && this.settings.wholeWords,
        extraWordCharacters: this.settings.extraWordCharacters,
        maxOccurrencesPerEditor: this.settings.maxOccurrencesPerEditor,
        highlightActiveOccurrence: this.settings.highlightActiveOccurrence,
      };
      this.refreshAllEditorViews();
    }
  }

  private sanitizeSettings(): void {
    this.settings.minWordLength = clampInteger(this.settings.minWordLength, 1, 100, 2);
    this.settings.maxOccurrencesPerEditor = clampInteger(
      this.settings.maxOccurrencesPerEditor,
      10,
      10000,
      1000,
    );
    this.settings.debounceMs = clampInteger(this.settings.debounceMs, 0, 1000, 25);
    this.settings.extraWordCharacters = String(this.settings.extraWordCharacters ?? "");
  }

  private createEditorExtension(): Extension {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- ViewPlugin class has its own this.
    const plugin = this;

    const highlightViewPlugin = ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(readonly view: EditorView) {
          plugin.editorViews.add(view);
          this.decorations = plugin.buildDecorations(view);
        }

        private deferredAndroidRefresh = false;

        update(update: ViewUpdate): void {
          const explicitRefresh = update.transactions.some((transaction) =>
            transaction.effects.some((effect) => effect.is(refreshHighlightsEffect)),
          );

          let sourceQueryChanged = false;

          // Important: derive the active editor query *inside the editor's own
          // update*. This lets us rebuild its decorations as part of the normal
          // typing/cursor transaction, instead of dispatching a second no-op
          // transaction back into the focused editor. The latter can make
          // Obsidian/CodeMirror recalculate scroll geometry and causes the
          // vertical scrollbar to visibly jump while typing.
          if (
            plugin.settings.enabled &&
            update.view.hasFocus &&
            (update.docChanged || update.selectionSet || update.focusChanged)
          ) {
            sourceQueryChanged = plugin.updateQueryFromViewDuringViewUpdate(update.view);
          }

          const needsDecorationRefresh =
            explicitRefresh || sourceQueryChanged || update.docChanged || update.viewportChanged;
          const protectAndroidSelection = plugin.shouldProtectAndroidSelection(update.view);

          // Android's native selection handles are sensitive to DOM mutations
          // inside CodeMirror while a selection is being adjusted. Decoration.mark
          // creates/removes spans in the editor content DOM, so rebuilding marks on
          // every selectionSet can make selection handles and Copy unstable.
          //
          // Keep the source editor DOM frozen while a non-empty Android selection
          // exists. The global query is still updated and propagated to other panes.
          // Once the selection collapses, one deferred refresh applies the latest
          // state. Document changes are never deferred because decoration positions
          // must remain valid after an edit/cut/replacement.
          if (protectAndroidSelection && !update.docChanged && !(explicitRefresh && (!plugin.settings.enabled || !plugin.currentQuery))) {
            if (needsDecorationRefresh) this.deferredAndroidRefresh = true;
            return;
          }

          if (needsDecorationRefresh || this.deferredAndroidRefresh) {
            this.decorations = plugin.buildDecorations(update.view);
            this.deferredAndroidRefresh = false;
          }
        }

        destroy(): void {
          plugin.editorViews.delete(this.view);
          if (plugin.currentQuery?.sourceView === this.view) {
            plugin.currentQuery = null;
            plugin.scheduleRefreshOtherEditorViews(this.view);
          }
        }
      },
      {
        decorations: (value) => value.decorations,
      },
    );

    return [highlightViewPlugin];
  }


  private shouldProtectAndroidSelection(view: EditorView): boolean {
    return (
      this.settings.androidSelectionGuard &&
      Platform.isAndroidApp &&
      !view.state.selection.main.empty
    );
  }

  /**
   * Update the global query while CodeMirror is already processing the source
   * editor's own transaction. No transaction is dispatched back to that editor.
   * Returns true when the query changed so the caller can rebuild decorations in
   * the same ViewPlugin update.
   */
  private updateQueryFromViewDuringViewUpdate(view: EditorView): boolean {
    const query = this.computeQueryFromView(view);
    if (sameQuery(this.currentQuery, query)) return false;

    this.currentQuery = query;
    this.scheduleRefreshOtherEditorViews(view);
    return true;
  }

  private scheduleRefreshOtherEditorViews(sourceView: EditorView): void {
    this.pendingRefreshSourceView = sourceView;

    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      const source = this.pendingRefreshSourceView;
      this.pendingRefreshSourceView = null;
      this.refreshAllEditorViews(source ?? undefined);
    }, this.settings.debounceMs);
  }

  private computeQueryFromView(view: EditorView): HighlightQuery | null {
    if (!this.settings.enabled) return null;

    const selection = view.state.selection.main;

    if (!selection.empty) {
      const from = Math.min(selection.from, selection.to);
      const to = Math.max(selection.from, selection.to);
      const selectedText = view.state.sliceDoc(from, to);

      // Multiline selections are intentionally ignored. Highlighting large blocks
      // globally is both noisy and potentially expensive.
      if (!selectedText || selectedText.length > MAX_SELECTION_LENGTH || /\r|\n/.test(selectedText)) {
        return null;
      }

      return {
        text: selectedText,
        origin: "selection",
        sourceView: view,
        sourceFrom: from,
        sourceTo: to,
        caseSensitive: this.settings.caseSensitive,
        wholeWord: false,
        extraWordCharacters: this.settings.extraWordCharacters,
        maxOccurrencesPerEditor: this.settings.maxOccurrencesPerEditor,
        highlightActiveOccurrence: this.settings.highlightActiveOccurrence,
      };
    }

    const line = view.state.doc.lineAt(selection.head);
    const word = getWordAtCursor(
      line.text,
      selection.head - line.from,
      this.settings.extraWordCharacters,
    );

    if (!word || word.text.length < this.settings.minWordLength) return null;

    return {
      text: word.text,
      origin: "cursor",
      sourceView: view,
      sourceFrom: line.from + word.from,
      sourceTo: line.from + word.to,
      caseSensitive: this.settings.caseSensitive,
      wholeWord: this.settings.wholeWords,
      extraWordCharacters: this.settings.extraWordCharacters,
      maxOccurrencesPerEditor: this.settings.maxOccurrencesPerEditor,
      highlightActiveOccurrence: this.settings.highlightActiveOccurrence,
    };
  }

  private updateQueryFromView(view: EditorView): void {
    this.setCurrentQuery(this.computeQueryFromView(view));
  }

  private setCurrentQuery(query: HighlightQuery | null): void {
    if (sameQuery(this.currentQuery, query)) return;
    this.currentQuery = query;
    this.refreshAllEditorViews();
  }

  private refreshAllEditorViews(except?: EditorView): void {
    for (const view of Array.from(this.editorViews)) {
      if (view === except) continue;

      try {
        // This is a visual-only refresh. Preserve the pane's scroll position
        // explicitly so a CodeMirror/Chromium layout recalculation cannot move a
        // non-source pane as a side effect of rebuilding decorations.
        const scrollTop = view.scrollDOM.scrollTop;
        const scrollLeft = view.scrollDOM.scrollLeft;

        view.dispatch({ effects: refreshHighlightsEffect.of(undefined) });

        if (view.scrollDOM.scrollTop !== scrollTop) {
          view.scrollDOM.scrollTop = scrollTop;
        }
        if (view.scrollDOM.scrollLeft !== scrollLeft) {
          view.scrollDOM.scrollLeft = scrollLeft;
        }
      } catch (error) {
        // A view can disappear between taking the Set snapshot and dispatching.
        // Remove it and continue refreshing the remaining panes.
        this.editorViews.delete(view);
        console.warn("Workspace Word Highlight: failed to refresh an editor view", error);
      }
    }
  }

  private buildDecorations(view: EditorView): DecorationSet {
    const query = this.currentQuery;
    if (!this.settings.enabled || !query || !query.text) return Decoration.none;

    const decorations: Range<Decoration>[] = [];
    const flags = query.caseSensitive ? "gu" : "giu";
    const matcher = new RegExp(escapeRegExp(query.text), flags);
    let occurrenceCount = 0;

    for (const visibleRange of view.visibleRanges) {
      if (occurrenceCount >= query.maxOccurrencesPerEditor) break;

      const text = view.state.sliceDoc(visibleRange.from, visibleRange.to);
      matcher.lastIndex = 0;

      for (let match = matcher.exec(text); match !== null; match = matcher.exec(text)) {
        if (occurrenceCount >= query.maxOccurrencesPerEditor) break;

        // Empty strings are never used as a query, but this protects against a
        // future change accidentally creating an infinite regex loop.
        if (match[0].length === 0) {
          matcher.lastIndex += 1;
          continue;
        }

        const from = visibleRange.from + match.index;
        const to = from + match[0].length;

        if (query.wholeWord && !hasWholeWordBoundaries(view, from, to, query.extraWordCharacters)) {
          continue;
        }

        const isActiveOccurrence =
          query.highlightActiveOccurrence &&
          view === query.sourceView &&
          from === query.sourceFrom &&
          to === query.sourceTo;

        const className = isActiveOccurrence
          ? "workspace-word-highlight workspace-word-highlight-active"
          : "workspace-word-highlight";

        decorations.push(Decoration.mark({ class: className }).range(from, to));
        occurrenceCount += 1;
      }
    }

    return Decoration.set(decorations, true);
  }

  private recomputeFromActiveMarkdownView(): void {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) {
      this.refreshAllEditorViews();
      return;
    }

    // Obsidian currently exposes its CM6 EditorView at editor.cm at runtime,
    // although this property is intentionally not part of the public Editor type.
    // This access pattern is documented by Obsidian for communication with editor
    // extensions.
    // @ts-expect-error - `cm` exists at runtime but is not typed by Obsidian.
    const cm = markdownView.editor.cm as EditorView | undefined;
    if (cm) this.updateQueryFromView(cm);
  }
}

class WorkspaceWordHighlightSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: WorkspaceWordHighlightPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Enable highlighting")
      .setDesc("Highlight the current word or selection in every open Markdown editor pane.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
          this.plugin.onSettingsChanged();
        }),
      );

    new Setting(containerEl)
      .setName("Case sensitive")
      .setDesc("Treat Foo and foo as different text.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.caseSensitive).onChange(async (value) => {
          this.plugin.settings.caseSensitive = value;
          await this.plugin.saveSettings();
          this.plugin.onSettingsChanged();
        }),
      );

    new Setting(containerEl)
      .setName("Whole words")
      .setDesc("For cursor-based highlighting, do not match the word inside a longer word. Selections are always matched literally.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.wholeWords).onChange(async (value) => {
          this.plugin.settings.wholeWords = value;
          await this.plugin.saveSettings();
          this.plugin.onSettingsChanged();
        }),
      );

    new Setting(containerEl)
      .setName("Minimum word length")
      .setDesc("Cursor words shorter than this are ignored. Selections are not affected.")
      .addText((text) =>
        text
          .setPlaceholder("2")
          .setValue(String(this.plugin.settings.minWordLength))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed)) this.plugin.settings.minWordLength = parsed;
            await this.plugin.saveSettings();
            this.plugin.onSettingsChanged();
          }),
      );

    new Setting(containerEl)
      .setName("Additional word characters")
      .setDesc("Characters to consider part of a cursor word in addition to Unicode letters, digits, and underscore. Example: -.$")
      .addText((text) =>
        text
          .setPlaceholder("-.$")
          .setValue(this.plugin.settings.extraWordCharacters)
          .onChange(async (value) => {
            this.plugin.settings.extraWordCharacters = value;
            await this.plugin.saveSettings();
            this.plugin.onSettingsChanged();
          }),
      );

    new Setting(containerEl)
      .setName("Highlight active occurrence")
      .setDesc("Use a separate CSS class for the occurrence that contains the active cursor or selection.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.highlightActiveOccurrence).onChange(async (value) => {
          this.plugin.settings.highlightActiveOccurrence = value;
          await this.plugin.saveSettings();
          this.plugin.onSettingsChanged();
        }),
      );

    new Setting(containerEl)
      .setName("Protect Android text selection")
      .setDesc(
        "Avoid rebuilding highlight spans in an editor while Android text selection handles are active. This improves selection and Copy stability; selected text can still be highlighted in other panes.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.androidSelectionGuard).onChange(async (value) => {
          this.plugin.settings.androidSelectionGuard = value;
          await this.plugin.saveSettings();
          this.plugin.onSettingsChanged();
        }),
      );

    new Setting(containerEl)
      .setName("Debounce (ms)")
      .setDesc("Delay before propagating a new cursor word to the other panes. The active pane updates inside its normal editor transaction. 0 is immediate; 15–40 ms is usually smoother.")
      .addText((text) =>
        text
          .setPlaceholder("25")
          .setValue(String(this.plugin.settings.debounceMs))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed)) this.plugin.settings.debounceMs = parsed;
            await this.plugin.saveSettings();
            this.plugin.onSettingsChanged();
          }),
      );

    new Setting(containerEl)
      .setName("Maximum matches per editor")
      .setDesc("Safety limit for a single pane. Only visible text is scanned.")
      .addText((text) =>
        text
          .setPlaceholder("1000")
          .setValue(String(this.plugin.settings.maxOccurrencesPerEditor))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed)) this.plugin.settings.maxOccurrencesPerEditor = parsed;
            await this.plugin.saveSettings();
            this.plugin.onSettingsChanged();
          }),
      );
  }
}

function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sameQuery(a: HighlightQuery | null, b: HighlightQuery | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    a.text === b.text &&
    a.origin === b.origin &&
    a.sourceView === b.sourceView &&
    a.sourceFrom === b.sourceFrom &&
    a.sourceTo === b.sourceTo &&
    a.caseSensitive === b.caseSensitive &&
    a.wholeWord === b.wholeWord &&
    a.extraWordCharacters === b.extraWordCharacters &&
    a.maxOccurrencesPerEditor === b.maxOccurrencesPerEditor &&
    a.highlightActiveOccurrence === b.highlightActiveOccurrence
  );
}

function getWordAtCursor(lineText: string, cursorOffset: number, extraWordCharacters: string): WordRange | null {
  const matcher = new RegExp(`[\\p{L}\\p{N}_${escapeForCharacterClass(extraWordCharacters)}]+`, "gu");
  const matches = Array.from(lineText.matchAll(matcher));

  // A caret at the first character of a word counts as being in that word. A
  // caret just after a word (before whitespace/punctuation) does not: this keeps
  // the highlight from sticking when the user moves into separators.
  for (const match of matches) {
    const from = match.index ?? 0;
    const to = from + match[0].length;
    if (cursorOffset >= from && cursorOffset < to) {
      return { from, to, text: match[0] };
    }
  }

  return null;
}

function hasWholeWordBoundaries(
  view: EditorView,
  from: number,
  to: number,
  extraWordCharacters: string,
): boolean {
  const previous = getCodePointBefore(view, from);
  const next = getCodePointAt(view, to);
  return !isWordCharacter(previous, extraWordCharacters) && !isWordCharacter(next, extraWordCharacters);
}

function getCodePointBefore(view: EditorView, position: number): string {
  if (position <= 0) return "";
  const start = Math.max(0, position - 2);
  const text = view.state.sliceDoc(start, position);
  const chars = Array.from(text);
  return chars.at(-1) ?? "";
}

function getCodePointAt(view: EditorView, position: number): string {
  if (position >= view.state.doc.length) return "";
  const end = Math.min(view.state.doc.length, position + 2);
  const text = view.state.sliceDoc(position, end);
  return Array.from(text)[0] ?? "";
}

function isWordCharacter(character: string, extraWordCharacters: string): boolean {
  if (!character) return false;
  if (/^[\p{L}\p{N}_]$/u.test(character)) return true;
  return extraWordCharacters.includes(character);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeForCharacterClass(text: string): string {
  return text.replace(/[\\\]\-^]/g, "\\$&");
}
