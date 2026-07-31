export class WhatsAppNotConnectedError extends Error {
  constructor(instanceName: string) {
    super(
      `WhatsApp "${instanceName}" desconectado. Vá em Configurações, escaneie o QR Code e tente novamente.`,
    );
    this.name = 'WhatsAppNotConnectedError';
  }
}
