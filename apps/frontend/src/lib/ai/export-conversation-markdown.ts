import type { ChatMessage } from './chat-types';

function partToMarkdown(part: ChatMessage['parts'][number]): string {
  switch (part.type) {
    case 'text':
      return part.text;
    case 'file':
      return `[Attachment: ${part.filename ?? 'file'}](${part.url})`;
    case 'reasoning':
      return `> Reasoning: ${part.text}`;
    case 'tool-call':
      return `\`\`\`\nTool call: ${part.toolName}\n${JSON.stringify(part.args, null, 2)}\n\`\`\``;
    case 'tool-result':
      return `\`\`\`\nTool result: ${part.toolName}\n${JSON.stringify(part.result, null, 2)}\n\`\`\``;
    case 'canvas-action':
      return `*[Canvas: ${part.title}]*`;
    case 'citation':
      return `*[Citation: ${part.entityName} (${part.entityType})]*`;
    default:
      return '';
  }
}

export function buildConversationMarkdown(
  title: string,
  messages: ChatMessage[],
): string {
  const lines: string[] = [`# ${title || 'Conversation'}`, ''];

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : msg.role;
    lines.push(`## ${role}`);
    lines.push('');
    const body = msg.parts
      .map(partToMarkdown)
      .filter(Boolean)
      .join('\n\n');
    lines.push(body || '_(empty)_');
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadConversationMarkdown(
  title: string,
  messages: ChatMessage[],
): void {
  const content = buildConversationMarkdown(title, messages);
  const safeName = (title || 'conversation')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName || 'conversation'}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
