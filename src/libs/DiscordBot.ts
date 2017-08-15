"use strict"

import * as co from 'co';
import * as _  from 'lodash';

import { BotConfig, CommandsList } from '../typings';
import { EventEmitter }            from 'events';
import { Client, TextChannel, Message, PermissionResolvable, GuildMember, Role } from 'discord.js';

export class DiscordBot extends EventEmitter {

  public readonly client: Client;
  public readonly perms: PermissionResolvable[];
  private commandToken: string;
  private discordToken: string;
  private owners: string[];
  private commands: CommandsList;

  constructor(config: BotConfig) {
    super();
    this.client = new Client({ disabledEvents: config.disabledEvents });
    this.discordToken = config.tokens.discord;
    this.commandToken = config.commandToken;
    this.commands = config.commands;
    this.perms = config.botPerms;
    this.owners = config.owners;

    this.client.once('ready', () => this.readyHandler(this));
    this.client.on('message', (message: Message) => this.messageHandler(this, message));
    this.client.on('error', console.log);

  }
  
  public login() {
    return this.client.login(this.discordToken);
  }

  private readyHandler = co.wrap(function* (bot: DiscordBot) {
    try {
      yield bot.client.user.setGame(`${bot.commandToken}help`);
      console.log('Bot is ready!');
      if (bot.client.guilds.size === 0 || process.argv.includes('-gi')) {
        const link = yield bot.client.generateInvite(bot.perms);
        console.log(`Bot invite link: ${link}`);
      }
    } catch (e) {
      console.log(e);
      process.exit(0);
    }
  });

  private messageHandler = co.wrap(function* (bot: DiscordBot, message: Message) {
    try {
      if (message.author.bot || message.channel.type !== "text") return;
      else if (!bot.hasSendPermission(message.channel as TextChannel)) {
        return message.author.send("I do not have permission to send messages there. Contact a server admin to get this resolved.");
      }
      const content = message.content.trim().split(/\s+/g);
      if (content[0].charAt(0) !== bot.commandToken) return;
      const cmd = content[0].substr(1);
      if (_.isNil(bot.commands.everyone[cmd]) && !bot.validateOwner(cmd, message.author.id) && !bot.validateAdmin(cmd, message.member)) {
        return message.reply(`Command not recognized! Use ${bot.commandToken}help to see list of commands.`);
      }
      console.log(`Serving command: ${cmd}`);
      bot.emit(cmd, message, content.slice(1));
    } catch (e) {
      yield message.reply(`I failed to do that request: ${e}`);
      console.log(e.stack);
    }
  });

  private hasSendPermission(channel: TextChannel) {
    return channel.permissionsFor(this.client.user).has("SEND_MESSAGES");
  }

  private validateAdmin(cmd: string, member: GuildMember) {
    return !_.isNil(this.commands.admin[cmd]) && _.some(member.roles, (role: Role) => role.hasPermission("ADMINISTRATOR"));
  }

  private validateOwner(cmd: string, id: string) {
    return !_.isNil(this.commands.owner[cmd]) && this.owners.includes(id);
  }
}
