import type { BotCommand } from '../types/index.js';
import { playCommand } from './play.js';
import { pauseCommand } from './pause.js';
import { resumeCommand } from './resume.js';
import { skipCommand } from './skip.js';
import { stopCommand } from './stop.js';
import { queueCommand } from './queue.js';
import { nowplayingCommand } from './nowplaying.js';
import { volumeCommand } from './volume.js';
import { shuffleCommand } from './shuffle.js';
import { loopCommand } from './loop.js';

export const commands: BotCommand[] = [
  playCommand,
  pauseCommand,
  resumeCommand,
  skipCommand,
  stopCommand,
  queueCommand,
  nowplayingCommand,
  volumeCommand,
  shuffleCommand,
  loopCommand,
];

export async function deployCommands(token: string, clientId: string) {
  const { REST, Routes } = await import('discord.js');
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Atualizando comandos slash (app level)...');
    await rest.put(Routes.applicationCommands(clientId), {
      body: commands.map((command) => command.data.toJSON()),
    });
    console.log(`${commands.length} comandos slash atualizados com sucesso!`);
  } catch (error) {
    console.error('Erro ao atualizar comandos:', error);
  }
}
