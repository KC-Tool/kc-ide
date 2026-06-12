// 后台 Worker：批量解析会话 JSON，避免阻塞主进程事件循环
'use strict';

const { parentPort, workerData } = require('worker_threads');
const fs = require('node:fs');

const files = Array.isArray(workerData?.files) ? workerData.files : [];

for (const filePath of files) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const session = JSON.parse(raw);
    if (session && session.id) {
      parentPort.postMessage({ ok: true, session });
    }
  } catch (err) {
    parentPort.postMessage({ ok: false, filePath, error: String(err) });
  }
}

parentPort.postMessage({ done: true });
