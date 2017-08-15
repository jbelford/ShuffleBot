import { ObjectID } from 'mongodb';
import { PermissionResolvable, WSEventType } from 'discord.js';
import { SoundCloudUsers } from '../models/SoundCloudUsers';
import { QueuePlayerManager } from '../models/QueuePlayerManager';

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
};

type Command = {
  args?: string;
  detail: string[];
}

type CommandsList = {
  admin: {
    [key: string]: Command;
  };
  everyone: {
    [key: string]: Command;
  };
  owner: {
    [key: string]: Command;
  }
};

type Daos = {
  soundCloudUsers: SoundCloudUsers;
  queuePlayerManager: QueuePlayerManager;
};