import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import WorkspaceWordHighlightPlugin from "../src/main";
import type { App, PluginManifest } from "obsidian";
import { Platform } from "./obsidian";

let plugin: WorkspaceWordHighlightPlugin;
const views: EditorView[] = [];

function editor(doc: string, position: number): EditorView {
  const view = new EditorView({
    state: EditorState.create({ doc, selection: { anchor: position }, extensions: [plugin["createEditorExtension"]()] }),
    parent: document.body,
  });
  views.push(view);
  return view;
}

function marks(view: EditorView): string[] {
  return Array.from(view.dom.querySelectorAll(".workspace-word-highlight"), el => el.textContent ?? "");
}

beforeEach(() => {
  vi.useFakeTimers();
  plugin = new WorkspaceWordHighlightPlugin({} as App, {} as PluginManifest);
  plugin.settings.debounceMs = 25;
  Platform.isAndroidApp = false;
});
afterEach(() => {
  plugin.onunload();
  for (const view of views.splice(0)) view.destroy();
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("production ViewPlugin characterization", () => {
  it("registers first-public-release commands with plugin-agnostic IDs and working callbacks", async () => {
    const addCommand = vi.spyOn(plugin, "addCommand");
    const save = vi.spyOn(plugin, "saveData").mockResolvedValue();
    await plugin.onload();
    expect(addCommand.mock.calls.map(([command]) => command.id)).toEqual(["toggle-highlighting", "clear-highlighting"]);
    const toggle = addCommand.mock.calls[0]?.[0];
    const clear = addCommand.mock.calls[1]?.[0];
    expect(toggle?.callback).toBeDefined();
    expect(clear?.callback).toBeDefined();
    await toggle?.callback?.();
    expect(plugin.settings.enabled).toBe(false);
    expect(save).toHaveBeenCalled();
    clear?.callback?.();
    expect(plugin["currentQuery"]).toBeNull();
  });

  it("propagates a focused Cyrillic cursor word across distinct documents without dispatching back to source", () => {
    const source = editor("мир мир", 0);
    const other = editor("мир дом мир", 0);
    const dispatch = vi.spyOn(source, "dispatch");
    vi.spyOn(source, "hasFocus", "get").mockReturnValue(true);
    source.dispatch({ selection: { anchor: 1 } });
    dispatch.mockClear();
    vi.runAllTimers();
    expect(marks(source)).toEqual(["мир", "мир"]);
    expect(marks(other)).toEqual(["мир", "мир"]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("treats selected regex punctuation literally and ignores multiline / oversized selections", () => {
    const source = editor("a.$ a.$\na.$", 0);
    const other = editor("a.$ and aXX", 0);
    vi.spyOn(source, "hasFocus", "get").mockReturnValue(true);
    source.dispatch({ selection: { anchor: 0, head: 3 } });
    vi.runAllTimers();
    expect(marks(other)).toEqual(["a.$"]);
    source.dispatch({ selection: { anchor: 0, head: 9 } });
    vi.runAllTimers();
    expect(marks(other)).toEqual([]);
    const long = editor("a".repeat(501), 0);
    vi.spyOn(long, "hasFocus", "get").mockReturnValue(true);
    long.dispatch({ selection: { anchor: 0, head: 501 } });
    vi.runAllTimers();
    expect(marks(other)).toEqual([]);
  });

  it("does not let an unfocused editor replace the source query", () => {
    const source = editor("alpha alpha", 0);
    const other = editor("alpha beta", 0);
    vi.spyOn(source, "hasFocus", "get").mockReturnValue(true);
    source.dispatch({ selection: { anchor: 1 } });
    vi.runAllTimers();
    other.dispatch({ selection: { anchor: 7 } });
    expect(marks(other)).toEqual(["alpha"]);
  });

  it("honors case, whole-word, extra characters and occurrence limit", () => {
    plugin.settings.caseSensitive = false;
    plugin.settings.extraWordCharacters = "-.$";
    plugin.settings.maxOccurrencesPerEditor = 10;
    const source = editor("word-key", 0);
    const other = editor("word-key WORD-KEY word-keyword", 0);
    vi.spyOn(source, "hasFocus", "get").mockReturnValue(true);
    source.dispatch({ selection: { anchor: 1 } });
    vi.runAllTimers();
    expect(marks(other)).toEqual(["word-key", "WORD-KEY"]);
    plugin.settings.caseSensitive = true;
    plugin.onSettingsChanged();
    expect(marks(other)).toEqual(["word-key"]);
  });

  it("caps accepted visible matches at the minimum configurable limit", () => {
    plugin.settings.maxOccurrencesPerEditor = 10;
    const source = editor("alpha", 0);
    const other = editor(Array(15).fill("alpha").join(" "), 0);
    vi.spyOn(source, "hasFocus", "get").mockReturnValue(true);
    source.dispatch({ selection: { anchor: 1 } });
    vi.runAllTimers();
    expect(marks(other)).toHaveLength(10);
  });

  it("uses supplementary Unicode letters as cursor words and treats whitespace selection literally", () => {
    const source = editor("𐐀bc 𐐀bc", 0);
    const other = editor("𐐀bc x 𐐀bc", 0);
    vi.spyOn(source, "hasFocus", "get").mockReturnValue(true);
    source.dispatch({ selection: { anchor: 2 } });
    vi.runAllTimers();
    expect(marks(other)).toEqual(["𐐀bc", "𐐀bc"]);
    source.dispatch({ selection: { anchor: 4, head: 5 } });
    vi.runAllTimers();
    expect(marks(other)).toEqual([" ", " "]);
  });

  it("retains old settings defaults and sanitizes saved numbers", async () => {
    vi.spyOn(plugin, "loadData").mockResolvedValue({ enabled: true, caseSensitive: false, debounceMs: -50 });
    await plugin.loadSettings();
    expect(plugin.settings.androidSelectionGuard).toBe(true);
    expect(plugin.settings.caseSensitive).toBe(false);
    expect(plugin.settings.debounceMs).toBe(0);
  });

  it("clears source marks on Android Clear during non-empty selection", () => {
    const source = editor("alpha alpha", 0);
    vi.spyOn(source, "hasFocus", "get").mockReturnValue(true);
    source.dispatch({ selection: { anchor: 1 } });
    expect(marks(source)).toHaveLength(2);
    Platform.isAndroidApp = true;
    source.dispatch({ selection: { anchor: 0, head: 5 } });
    plugin["setCurrentQuery"](null);
    expect(marks(source)).toEqual([]);
  });

  it("refreshes after Android document changes and after selection collapses, including disable", () => {
    const source = editor("alpha alpha", 0);
    vi.spyOn(source, "hasFocus", "get").mockReturnValue(true);
    source.dispatch({ selection: { anchor: 1 } });
    Platform.isAndroidApp = true;
    source.dispatch({ selection: { anchor: 0, head: 5 } });
    source.dispatch({ changes: { from: 0, to: 5, insert: "beta" }, selection: { anchor: 4 } });
    expect(marks(source)).toEqual([]);
    source.dispatch({ selection: { anchor: 0, head: 4 } });
    plugin.settings.enabled = false;
    plugin.onSettingsChanged();
    expect(marks(source)).toEqual([]);
    plugin.settings.enabled = true;
    source.dispatch({ selection: { anchor: 1 } });
    expect(marks(source)).toEqual(["beta"]);
  });

  it("cancels pending cross-pane refresh at unload", () => {
    const source = editor("alpha alpha", 0);
    const other = editor("alpha", 0);
    const dispatch = vi.spyOn(other, "dispatch");
    vi.spyOn(source, "hasFocus", "get").mockReturnValue(true);
    source.dispatch({ selection: { anchor: 1 } });
    plugin.onunload();
    vi.runAllTimers();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("clears the query when the source editor is destroyed", () => {
    const source = editor("alpha alpha", 0);
    const other = editor("alpha alpha", 0);
    vi.spyOn(source, "hasFocus", "get").mockReturnValue(true);
    source.dispatch({ selection: { anchor: 1 } });
    vi.runAllTimers();
    expect(marks(other)).toHaveLength(2);
    source.destroy();
    vi.runAllTimers();
    expect(marks(other)).toEqual([]);
  });
});
