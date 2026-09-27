export class Plugin {
  app = { workspace: { getActiveViewOfType: () => null } };
  async loadData(): Promise<unknown> { return null; }
  async saveData(_data: unknown): Promise<void> { /* test boundary */ }
  registerEditorExtension(_extension: unknown): void { /* test boundary */ }
  addSettingTab(_tab: unknown): void { /* test boundary */ }
  addCommand(_command: unknown): void { /* test boundary */ }
}
export class PluginSettingTab { constructor(_app: unknown, _plugin: unknown) { /* test boundary */ } }
export class Setting { constructor(_el: unknown) { /* test boundary */ } }
export class MarkdownView { editor: unknown; }
export const Platform = { isAndroidApp: false };
export class App {}
