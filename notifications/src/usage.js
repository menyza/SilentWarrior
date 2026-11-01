export function validUsageSession(session,now=Date.now()){
 return session&&/^[a-f0-9-]{36}$/.test(session.id)&&Number.isSafeInteger(session.startedAt)&&Number.isSafeInteger(session.lastSeenAt)&&Number.isSafeInteger(session.activeMs)&&session.startedAt>=now-90*86400000&&session.startedAt<=now+300000&&session.lastSeenAt>=session.startedAt&&session.lastSeenAt<=now+300000&&session.activeMs>=0&&session.activeMs<=86400000&&session.activeMs<=session.lastSeenAt-session.startedAt+1000;
}
