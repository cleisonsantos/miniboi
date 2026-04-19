const timestamp = () => new Date().toLocaleTimeString('pt-BR');

export const logger = {
  info: (msg: string) => console.log(`[${timestamp()}] INFO  ${msg}`),
  warn: (msg: string) => console.log(`[${timestamp()}] WARN  ${msg}`),
  error: (msg: string, error?: any) => console.log(`[${timestamp()}] ERROR ${msg}`, error || ''),
};
