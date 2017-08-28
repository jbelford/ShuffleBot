import { ObjectID } from 'mongodb';
import { PermissionResolvable, WSEventType, Emoji } from 'discord.js';
import { SoundCloudUsers } from '../models/SoundCloudUsers';
import { QueuePlayerManager } from '../models/QueuePlayerManager';
import { PollManager } from '../models/PollManager';

type Track = {
  title: string;
  url: string;
  poster: string;
  pic: string;
  src: string;
};

type SCUser = {
  permalink: string;
  username: string;
  id: number;
  guilds: string[];
  favorites: number;
  list: Track[] ;
};

type BotConfig = {
  owners: string[];
  dbUrl: string;
  tokens: {
    discord: string;
    soundcloud: string;
    youtube: string;
  };
  commandToken: string;
  botPerms: PermissionResolvable[];
  disabledEvents: WSEventType[];
  commands: CommandsList;
  emojis: string[];
};

type Command = {
  args?: {
    text: string;
    description: string[];
  };
  detail: string;
  usage: string[];
  level: number;
}

type CommandModule = {
  name: string;
  prefix: string;
  commands: {
    [name: string]: Command
  };
}

type CommandsList = CommandModule[];

type Daos = {
  soundCloudUsers: SoundCloudUsers;
  queuePlayerManager: QueuePlayerManager;
  pollManager: PollManager
};

type PollOption = {
  text: string;
  emoji: string;
};