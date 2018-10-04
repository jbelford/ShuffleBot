"use strict"

import { Client, Guild, GuildMember, Message, PermissionResolvable, Role, TextChannel } from 'discord.js';
import { EventEmitter } from 'events';
import * as _ from 'lodash';
import { BotConfig } from '../typings';


export class DiscordBot extends EventEmitter {

  public readonly client: Client;
  public readonly perms: PermissionResolvable;

  constructor(private config: BotConfig) {
    super();
    this.perms = config.botPerms;
    this.client = new Client({ disabledEvents: config.disabledEvents });
    this.client.once('ready', () => this.readyHandler(this));
    this.client.on('message', message => this.messageHandler(this, message));
    this.client.on('guildCreate', guild => this.joinGuildHandler(this, guild));
    this.client.on('error', console.log);
  }

  public login() {
    return this.client.login(this.config.tokens.discord);
  }

  public voiceIsFull() {
    return this.config.music.limit <= this.client.voiceConnections.size;
  }

  private async readyHandler(bot: DiscordBot) {
    try {
      await bot.client.user.setGame(`${bot.config.commandToken}help`);
      console.log('Bot is ready!');
      if (bot.client.guilds.size === 0 || process.argv.includes('-gi')) {
        const link = await bot.client.generateInvite(bot.perms);
        console.log(`Bot invite link: ${link}`);
      }
    } catch (e) {
      console.log(e);
      process.exit(0);
    }
  }

  private async messageHandler(bot: DiscordBot, message: Message) {
    try {
      if (message.author.bot || message.channel.type !== "text") return;

      const content = message.content.trim().split(/\s+/g);
      if (content[0].charAt(0) !== bot.config.commandToken) return;
      else if (!bot.hasSendPermission(message.channel as TextChannel))
        return await message.author.send("I do not have permission to send messages there. Contact a server admin to get this resolved.");

      const cmd = content[0].substr(1);
      let cmdsplit = cmd.split('.');
      if (cmdsplit.length === 1) cmdsplit = ["", cmdsplit[0]];

      const cmdModule = bot.config.commands.find(value => value.prefix === cmdsplit[0]);
      if (_.isNil(cmdModule)) return await message.reply(`There is no category with prefix \`${cmdsplit[0]}\`!`);

      const userPermissionLevel = bot.getPermissionLevel(message.member);
      const command = cmdModule.commands[cmdsplit[1]];
      if (_.isNil(command) || (command.level === 3 && userPermissionLevel < 3))
        return await message.reply(`There is no \`${cmdsplit[1]}\` command for the category \`${cmdModule.name}\`!` +
          `\nUse \`${bot.config.commandToken}help ${cmdModule.name}\` to see the list of commands in that category.` +
          `\nYou can also use \`${bot.config.commandToken}help\` to see the list of all categories.`);
      else if (userPermissionLevel < command.level)
        return await message.reply(`You do not have permission to use that command!`);

      console.log(`SERVER: ${message.guild.name} ~ COMMAND: ${cmd}`);
      bot.emit(cmdsplit[0], cmdsplit[1], message, content.slice(1), userPermissionLevel);
    } catch (e) {
      await message.reply(`Uh oh! I failed to do that request.`);
      console.log(e.stack);
    }
  }

  private async joinGuildHandler(bot: DiscordBot, guild: Guild) {
    if (bot.config.invite) {
      await guild.owner.send(`Hey! Thanks for inviting me to your server! To get started take ` +
        `a look at the commands available to you with ${bot.config.commandToken}help\n` +
        `Forewarning: I do not accept commands through DM's`);
    } else {
      await guild.owner.send(`Hey! Sorry but invites are disabled right now. I'd love to join another time!`);
      await guild.leave();
    }
  }

  private getPermissionLevel(member: GuildMember) {
    if (this.config.owners.includes(member.id)) return 3;
    else if (_.some(member.roles, (role: Role) => role.hasPermission("ADMINISTRATOR"))) return 2;
    return 1;
  }

  private hasSendPermission(channel: TextChannel) {
    return channel.permissionsFor(this.client.user).has("SEND_MESSAGES");
  }
}
