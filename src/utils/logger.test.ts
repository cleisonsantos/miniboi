import { describe, expect, test } from 'bun:test';
import { createLogger } from './logger.js';

describe('structured logger', () => {
  test('gera JSON e remove dados sensíveis', () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: 'debug',
      format: 'json',
      write: (_level, line) => lines.push(line),
    });

    logger.info('request', {
      token: 'secret-token',
      nested: { clientSecret: 'secret', safe: 'visible' },
    });

    const entry = JSON.parse(lines[0] ?? '{}');
    expect(entry).toMatchObject({
      level: 'info',
      message: 'request',
      context: {
        token: '[REDACTED]',
        nested: { clientSecret: '[REDACTED]', safe: 'visible' },
      },
    });
    expect(entry.timestamp).toBeString();
  });

  test('serializa Error sem perder contexto', () => {
    const lines: string[] = [];
    const logger = createLogger({
      format: 'json',
      write: (_level, line) => lines.push(line),
    });

    logger.error('falha', new Error('boom'), { guildId: 'guild' });

    const entry = JSON.parse(lines[0] ?? '{}');
    expect(entry.context).toEqual({ guildId: 'guild' });
    expect(entry.error).toMatchObject({ name: 'Error', message: 'boom' });
  });

  test('remove segredo presente em mensagem de erro', () => {
    const lines: string[] = [];
    process.env.TEST_TOKEN = 'super-secret-value';
    try {
      const logger = createLogger({
        format: 'json',
        write: (_level, line) => lines.push(line),
      });
      logger.error('falhou com super-secret-value', new Error('super-secret-value'));

      expect(lines[0]).not.toContain('super-secret-value');
      expect(lines[0]).toContain('[REDACTED]');
    } finally {
      delete process.env.TEST_TOKEN;
    }
  });

  test('filtra níveis abaixo da configuração', () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: 'warn',
      format: 'pretty',
      write: (_level, line) => lines.push(line),
    });

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('WARN');
    expect(lines[1]).toContain('ERROR');
  });
});
