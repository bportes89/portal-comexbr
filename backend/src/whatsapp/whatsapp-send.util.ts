function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function extractProviderMessageId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;

  const data = isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(data)) return undefined;

  const key = isRecord(data.key) ? data.key : undefined;
  const idFromKey = key && typeof key.id === 'string' ? key.id : undefined;
  if (idFromKey) return idFromKey;

  const messageId =
    typeof data.messageId === 'string'
      ? data.messageId
      : typeof data.id === 'string'
        ? data.id
        : undefined;
  if (messageId) return messageId;

  const nestedKey =
    isRecord(data.message) && isRecord(data.message.key)
      ? data.message.key
      : undefined;
  const idFromNestedKey =
    nestedKey && typeof nestedKey.id === 'string' ? nestedKey.id : undefined;
  return idFromNestedKey;
}

export function assertSendTextSuccess(payload: unknown): string {
  const providerMessageId = extractProviderMessageId(payload);
  if (providerMessageId) return providerMessageId;

  if (isRecord(payload)) {
    const response = isRecord(payload.response) ? payload.response : undefined;
    const message = response?.message;
    if (Array.isArray(message) && message.length > 0) {
      throw new Error(String(message[0]));
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      throw new Error(payload.message);
    }
    if (typeof payload.error === 'string' && payload.error.trim()) {
      throw new Error(payload.error);
    }
  }

  throw new Error(
    `Evolution API não confirmou o envio: ${JSON.stringify(payload ?? {})}`,
  );
}
