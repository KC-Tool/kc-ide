# Streaming 工具名重复拼接导致 "Unknown tool: list_dirlist_dirlist_dirlist_dir"

## 触发条件
使用 Agent 引擎执行 tool call 时，OpenAI-compatible API 以 streaming 方式返回多个 tool_calls delta。

## 现象 / 错误信息
错误信息：`Error: Unknown tool: list_dirlist_dirlist_dirlist_dirlist_dir`
工具名被重复拼接多次，导致工具执行时找不到匹配的工具定义。

## 根因
OpenAI streaming API 在 tool_calls delta 中只在第一个 delta 发送 `function.name`，后续 delta 只发送 `function.arguments`。代码中使用了 `+=` 拼接 name：
```typescript
if (tc.function?.name) existing.name += tc.function.name;
```
当多个 delta 都包含 name 字段时（某些 API 实现会重复发送），name 被反复追加。

## 修复
将 `+=` 改为 `=`，始终覆盖而非追加：
```typescript
if (tc.function?.name) existing.name = tc.function.name;
```
文件：`src/main/agent-engine.ts` 第 248 行

## 预防
- streaming parser 中对于只应出现一次的字段（id、name），始终使用赋值而非追加
- 对 arguments 这种增量拼接字段才使用 `+=`
- 添加单元测试覆盖 streaming tool_calls 多 delta 场景

## 关联
- 文件：src/main/agent-engine.ts
- 日期：2026-06-04
- 任务摘要：修复 Agent 工具名重复拼接 bug
