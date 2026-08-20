export function scrollConversationToBottom(element) {
  element?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
}
