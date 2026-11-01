import type { Socket } from 'socket.io';
import { COOKIE } from '../../../common/constants/constants.config';
import type { SessionRecord } from './session.service';
import type { SessionService } from './session.service';
import type { TokenService } from './token.service';

/** "a=1; warden_access=xyz" → "xyz". */
function cookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export type SocketSession = SessionRecord & { sid: string };

/**
 * A Socket.io connection is checked like any request: the access cookie's
 * JWT AND its session in Redis, so a revoked session can't listen. On
 * failure the browser is told `unauthorized` (it refreshes its cookie and
 * reconnects) and disconnected. Shared by the deploy and logs gateways.
 */
export async function socketSession(client: Socket, tokens: TokenService, sessions: SessionService): Promise<SocketSession | null> {
  try {
    const token = cookie(client.handshake.headers.cookie, COOKIE.access);
    if (!token) throw new Error('no cookie');
    const claims = await tokens.verifyAccess(token);
    const session = await sessions.get(claims.sid);
    if (!session) throw new Error('no session');
    return { ...session, sid: claims.sid };
  } catch {
    client.emit('unauthorized');
    client.disconnect(true);
    return null;
  }
}
