import { PermissionResolvable, WSEventType } from 'discord.js';
import { Guilds } from '../models/Guilds';
import { PollManager } from '../models/PollManager';
import { QueuePlayerManager } from '../models/QueuePlayerManager';
import { SoundCloudUsers } from '../models/SoundCloudUsers';
import { Users } from '../models/Users';

interface Track {
  title: string;
  url: string;
  poster: string;
  pic: string;
  src: string;
}

interface SpotifyTrack extends Track {
  loaded: boolean;
  trackId: string;
}

type SCUser = {
  permalink: string;
  username: string;
  id: number;
  guilds: string[];
  favorites: number;
  list: Track[];
};

type GuildUser = {
  userId: string;
  playlists: Playlist[];
};

type Playlist = {
  name: string;
  key: string;
  size: number;
  list: Track[];
};

type BotConfig = {
  owners: string[];
  dbUrl: string;
  tokens: {
    discord: string;
    soundcloud: string;
    youtube: string;
    spotify: {
      clientId: string;
      clientSecret: string;
    }
  };
  commandToken: string;
  botPerms: PermissionResolvable;
  disabledEvents: WSEventType[];
  sc: {
    limit: number;
    interval: number;
  };
  invite: boolean;
  music: {
    limit: number;
  };
  playlists: {
    idLength: number;
    nameLength: number;
  }
  commands: CommandsList;
  emojis: string[];
  playlistInfo: string;
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
  pollManager: PollManager;
  guilds: Guilds;
  users: Users;
};

type PollOption = {
  text: string;
  emoji: string;
};