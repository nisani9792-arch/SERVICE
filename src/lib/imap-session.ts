import { ImapFlow, type ImapFlowOptions } from "imapflow";

export type ImapErrorKind = "connect" | "auth" | "timeout" | "network" | "archive" | "unknown";

export class ImapSessionError extends Error {
  readonly kind: ImapErrorKind;

  constructor(kind: ImapErrorKind, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "ImapSessionError";
    this.kind = kind;
  }
}

export type ImapSessionConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  connectTimeoutMs: number;
  socketTimeoutMs: number;
  maxConnectAttempts?: number;
};

const ARCHIVE_CHUNK_SIZE = 50;

export function formatImapCommandError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const imapErr = error as Error & { responseText?: string };
  return imapErr.responseText ? `${imapErr.message}: ${imapErr.responseText}` : imapErr.message;
}

function classifyConnectError(error: unknown): ImapErrorKind {
  const msg = error instanceof Error ? error.message : String(error);
  if (/auth|credentials|login|invalid.*password|535/i.test(msg)) return "auth";
  if (/timed out|timeout|ETIMEDOUT/i.test(msg)) return "timeout";
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|socket|network/i.test(msg)) return "network";
  if (/connect/i.test(msg)) return "connect";
  return "unknown";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ImapSessionError("timeout", `${label} timed out after ${timeoutMs / 1000}s`)),
      timeoutMs
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildClientOptions(config: ImapSessionConfig): ImapFlowOptions {
  const connectMs = Math.min(30_000, config.connectTimeoutMs);
  return {
    host: config.host,
    port: config.port,
    secure: true,
    disableAutoIdle: true,
    connectionTimeout: connectMs,
    greetingTimeout: connectMs,
    socketTimeout: config.socketTimeoutMs,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    tls: { servername: config.host, minVersion: "TLSv1.2" }
  };
}

/**
 * Resilient IMAP wrapper — exponential backoff connect, lifecycle hooks, chunked archive.
 */
export class ImapSession {
  private client: ImapFlow | null = null;
  private connected = false;
  private readonly config: ImapSessionConfig;
  private readonly maxAttempts: number;

  constructor(config: ImapSessionConfig) {
    this.config = config;
    this.maxAttempts = config.maxConnectAttempts ?? 4;
  }

  get raw(): ImapFlow {
    if (!this.client || !this.connected) {
      throw new ImapSessionError("connect", "IMAP session is not connected");
    }
    return this.client;
  }

  async connect(): Promise<void> {
    if (this.connected && this.client) return;

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      await this.destroyClient();
      const client = new ImapFlow(buildClientOptions(this.config));
      this.client = client;
      this.attachLifecycleHandlers(client);

      try {
        await withTimeout(
          client.connect(),
          Math.min(25_000, this.config.connectTimeoutMs),
          "IMAP connect"
        );
        this.connected = true;
        return;
      } catch (error) {
        lastError = error;
        this.connected = false;
        await this.destroyClient();
        if (attempt < this.maxAttempts) {
          const delayMs = Math.min(8_000, 800 * 2 ** (attempt - 1));
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    const kind = classifyConnectError(lastError);
    throw new ImapSessionError(
      kind,
      lastError instanceof Error ? lastError.message : "IMAP connect failed",
      lastError
    );
  }

  async disconnect(): Promise<void> {
    await this.destroyClient();
  }

  private async destroyClient(): Promise<void> {
    if (!this.client) return;
    const client = this.client;
    this.client = null;
    this.connected = false;
    try {
      await withTimeout(client.logout(), 8_000, "IMAP logout");
    } catch {
      client.close();
    }
  }

  async withMailbox<T>(mailbox: string, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    await this.connect();
    const lock = await this.raw.getMailboxLock(mailbox);
    try {
      return await fn(this.raw);
    } finally {
      lock.release();
    }
  }

  async archiveUids(sourceMailbox: string, archiveMailbox: string, uids: number[]): Promise<number> {
    if (uids.length === 0) return 0;

    return this.withMailbox(sourceMailbox, async (client) => {
      let archived = 0;
      for (let i = 0; i < uids.length; i += ARCHIVE_CHUNK_SIZE) {
        const chunk = uids.slice(i, i + ARCHIVE_CHUNK_SIZE);
        try {
          const moved = await withTimeout(
            client.messageMove(chunk, archiveMailbox, { uid: true }),
            this.config.socketTimeoutMs,
            "IMAP archive"
          );
          if (moved) {
            archived += chunk.length;
            continue;
          }
        } catch (moveError) {
          try {
            await withTimeout(
              client.messageFlagsAdd(chunk, ["\\Deleted"], { uid: true }),
              this.config.socketTimeoutMs,
              "IMAP mark deleted"
            );
            await withTimeout(
              client.messageDelete(chunk, { uid: true }),
              this.config.socketTimeoutMs,
              "IMAP expunge"
            );
            archived += chunk.length;
            continue;
          } catch (deleteError) {
            throw new ImapSessionError(
              "archive",
              `Failed to remove processed mail from ${sourceMailbox}: ${formatImapCommandError(deleteError)}`,
              deleteError
            );
          }
        }
      }
      return archived;
    });
  }

  private attachLifecycleHandlers(client: ImapFlow): void {
    client.on("error", (error) => {
      this.connected = false;
      console.error("[imap-session] connection error:", error);
    });
    client.on("close", () => {
      this.connected = false;
    });
  }
}

export function isImapSessionConnectFailure(error: unknown): boolean {
  if (error instanceof ImapSessionError) {
    return error.kind === "connect" || error.kind === "timeout" || error.kind === "network";
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /IMAP connect|timed out|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|socket/i.test(msg);
}
