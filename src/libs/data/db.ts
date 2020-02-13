import { CollectionReference, FieldValue, Firestore } from '@google-cloud/firestore';
import { GuildUser, SCUser, Track } from '../../typings';

export interface IDbCollection<T> {

    findIn(ids: string[]): Promise<T[]>;

    get(id: string): Promise<T | undefined>;

    set(id: string, item: T): Promise<void>;

    remove(id: string): Promise<void>;

}

class FirestoreCollection<T> implements IDbCollection<T> {

    constructor(protected readonly collection: CollectionReference) {}

    async findIn(ids: string[]): Promise<T[]> {
        const query = await this.collection.get();
        return query.docs.filter(doc => ids.includes(doc.id)).map(doc => doc.data() as T);
    }

    async get(id: string): Promise<T | undefined> {
        const ref = await this.collection.doc(id).get();
        return ref.data() as T;
    }

    async set(id: string, item: T): Promise<void> {
        await this.collection.doc(id).set(item, { merge: true });
    }

    async remove(id: string): Promise<void> {
        await this.collection.doc(id).delete();
    }

}

export interface UsersCollection extends IDbCollection<GuildUser> {
    addPlaylist(userId: string, name: string, plId: string): Promise<GuildUser>;
    deletePlaylist(userId: string, plId: string): Promise<GuildUser>;
    addToPlaylist(userId: string, plId: string, tracks: Track[]): Promise<GuildUser>;
}

export class FirestoreUsersCollection extends FirestoreCollection<GuildUser> implements UsersCollection {

    constructor(db: Firestore) {
        super(db.collection('users'));
    }

    async addPlaylist(userId: string, name: string, plId: string): Promise<GuildUser> {
        await this.collection.doc(userId).set(
            { userId: userId, playlists: FieldValue.arrayUnion({ name, key: plId }) },
            { merge: true });

        return await this.get(userId);
    }

    async deletePlaylist(userId: string, plId: string): Promise<GuildUser> {
        const user = await this.get(userId);

        const idx = user.playlists.findIndex(pl => pl.key === plId);
        if (idx >= 0) {
            user.playlists = user.playlists.slice(0, idx).concat(user.playlists.slice(idx + 1));
        }

        await this.set(userId, user);
        return user;
    }

    async addToPlaylist(userId: string, plId: string, tracks: Track[]): Promise<GuildUser> {
        const user = await this.get(userId);

        const playlist = user.playlists.find(x => x.key === plId);
        if (!playlist) throw 'No playlist found';

        playlist.list = (playlist.list || []).concat(tracks);
        playlist.size = playlist.list.length;

        await this.set(userId, user);

        return user;
    }

}

interface PlaylistToUser {
    user: string;
}

export interface PlaylistToUserCollection extends IDbCollection<PlaylistToUser> {

}

export class FirestorePlaylistToUserCollection extends FirestoreCollection<PlaylistToUser> implements PlaylistToUserCollection {

    constructor(db: Firestore) {
        super(db.collection('playlist_to_user'));
    }

}

export interface SearchCollection extends IDbCollection<Track> {

}

export class FirestoreSearchCollection extends FirestoreCollection<Track> implements SearchCollection {

    constructor(db: Firestore) {
        super(db.collection('spotify_yt_search'));
    }

}

interface GuildItem {
    guildId: string;
    scdl: {
        timestamp: number;
        num: number;
    }
}

export interface GuildsCollection extends IDbCollection<GuildItem> {
    incrementScdl(id: string): Promise<void>;
}

export class FirestoreGuildsCollection extends FirestoreCollection<GuildItem> implements GuildsCollection {

    constructor(db: Firestore) {
        super(db.collection('guilds'));
    }

    async incrementScdl(id: string): Promise<void> {
        await this.collection.doc(id).set({ scdl: { timestamp: Date.now(), num: FieldValue.increment(1) }}, { merge: true });
    }

}

export interface SoundCloudUsersCollection extends IDbCollection<SCUser> {

    updateAndAddGuild(user: SCUser, guildId: string): Promise<SCUser>;
    getForGuild(guildId: string): Promise<SCUser[]>;
    removeGuild(id: string, guildId: string): Promise<boolean>;
}

export class FirestoreSoundCloudUsersCollection extends FirestoreCollection<SCUser> implements SoundCloudUsersCollection {

    constructor(db: Firestore) {
        super(db.collection('soundcloud_users'));
    }

    async updateAndAddGuild(user: SCUser, guildId: string): Promise<SCUser> {
        delete user.guilds;
        await this.collection.doc(user.permalink).set(
            { ...user, guilds: FieldValue.arrayUnion(guildId) },
            { merge: true });

        return await this.get(user.permalink);
    }

    async getForGuild(guildId: string): Promise<SCUser[]> {
        const query = await this.collection.where('guilds', 'array-contains', guildId).get();
        return query.docs.map(docs => docs.data() as SCUser);
    }

    removeGuild(id: string, guildId: string): Promise<boolean> {
        return this.collection.doc(id).update({ guilds: FieldValue.arrayRemove(guildId) })
            .then(() => true, () => false);
    }

}
