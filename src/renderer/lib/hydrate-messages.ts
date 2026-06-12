import type { ChatMessage } from '../../shared/ipc';
import { chatMessageToUi, type UiMessage } from './chat-message-model';
import { idleYield } from './scheduling';

const TAIL_COUNT = 24;
const CHUNK_SIZE = 6;

/** 先渲染最近消息，其余分块在空闲时补齐，避免切换会话时卡死输入 */
export async function hydrateMessagesProgressive(
  messages: ChatMessage[],
  onUpdate: (msgs: UiMessage[], hydrating: boolean) => void,
): Promise<void> {
  if (messages.length === 0) {
    onUpdate([], false);
    return;
  }

  const tailStart = Math.max(0, messages.length - TAIL_COUNT);
  const tail = messages.slice(tailStart).map(chatMessageToUi);
  onUpdate(tail, tailStart > 0);

  if (tailStart === 0) return;

  const head: UiMessage[] = [];
  for (let i = 0; i < tailStart; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE).map(chatMessageToUi);
    head.push(...chunk);
    onUpdate([...head, ...tail], i + CHUNK_SIZE < tailStart);
    await idleYield(24);
  }

  onUpdate([...head, ...tail], false);
}
