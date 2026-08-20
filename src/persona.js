export function buildPersonaPayload(person, messagesByPerson, newMessage, { ageConfirmed = false, webSearch = true } = {}) {
  if (!person?.id) throw new Error('没有选择有效的对话对象。');
  const ownHistory = Array.isArray(messagesByPerson?.[person.id]) ? messagesByPerson[person.id] : [];
  return {
    consent: true,
    ageConfirmed,
    webSearch,
    persona: { id: person.id, name: person.name },
    samples: Array.isArray(person.samples) ? person.samples : [],
    messages: [...ownHistory, newMessage],
  };
}
