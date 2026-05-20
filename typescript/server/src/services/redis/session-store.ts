import { type SessionData, Store } from "express-session";

/**
 * express-session store backed by Bun's built-in Redis client.
 */
export class BunRedisSessionStore extends Store {
	private readonly client: InstanceType<typeof Bun.RedisClient>;
	private readonly defaultTtl: number;
	private readonly prefix: string;

	constructor(
		client: InstanceType<typeof Bun.RedisClient>,
		options: { prefix?: string; ttl?: number } = {},
	) {
		super();
		this.client = client;
		this.prefix = options.prefix ?? "sess:";
		this.defaultTtl = options.ttl ?? 86_400;
	}

	private key(sid: string): string {
		return this.prefix + sid;
	}

	private ttl(session: SessionData): number {
		if (session.cookie?.expires) {
			const ms = Number(new Date(session.cookie.expires)) - Date.now();
			return Math.max(1, Math.ceil(ms / 1000));
		}

		return this.defaultTtl;
	}

	destroy(sid: string, callback?: (err?: unknown) => void): void {
		this.client
			.del(this.key(sid))
			.then(() => callback?.())
			.catch((err) => callback?.(err));
	}

	get(sid: string, callback: (err: unknown, session?: SessionData | null) => void): void {
		this.client
			.get(this.key(sid))
			.then((data) => {
				if (!data) {
					return callback(null, null);
				}
				try {
					callback(null, JSON.parse(data) as SessionData);
				} catch (e) {
					callback(e);
				}
			})
			.catch((err) => callback(err));
	}

	set(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
		this.client
			.setex(this.key(sid), this.ttl(session), JSON.stringify(session))
			.then(() => callback?.())
			.catch((err) => callback?.(err));
	}

	touch(sid: string, session: SessionData, callback?: () => void): void {
		this.client
			.expire(this.key(sid), this.ttl(session))
			.then(() => callback?.())
			.catch(() => callback?.());
	}
}
