// Koder 设置管理器
// 负责用户偏好设置的读写与持久化到 userData/settings.json

import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { AppSettings } from '../shared/ipc.js';

const DEFAULTS: AppSettings = {
  theme: 'light',
  fontSize: 13,
  locale: 'zh',
  dismissedTemporalNotice: false,
};

export class SettingsManager {
  private settings: AppSettings = { ...DEFAULTS };
  private filePath = '';

  init(): void {
    this.filePath = path.join(app.getPath('userData'), 'settings.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.settings = { ...DEFAULTS, ...JSON.parse(raw) };
      }
    } catch {
      this.settings = { ...DEFAULTS };
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (err) {
      console.error('[koder settings] save error:', err);
    }
  }

  get(): AppSettings {
    return { ...this.settings };
  }

  update(patch: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...patch };
    this.save();
    return this.get();
  }
}
