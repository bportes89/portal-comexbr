let messageQueueEnabled = process.env.MESSAGE_QUEUE_ENABLED !== 'false';

export function isMessageQueueEnabled() {
  return messageQueueEnabled;
}

export function setMessageQueueEnabled(enabled: boolean) {
  messageQueueEnabled = enabled;
  process.env.MESSAGE_QUEUE_ENABLED = enabled ? 'true' : 'false';
}
