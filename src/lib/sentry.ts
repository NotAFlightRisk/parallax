import { captureException, init } from '@sentry/browser';

// hooks.client.ts catches errors itself, and Bugsink has no use for sessions
const skip = ['GlobalHandlers', 'BrowserApiErrors', 'BrowserSession'];
// A message can quote someone's logs, so everything from the first quote or colon goes
const redact = (message: string) => message.replace(/["'`:][\s\S]*/, '…');

export function start(dsn: string) {
  init({
    dsn,
    maxBreadcrumbs: 0,
    sendClientReports: false,
    dataCollection: { userInfo: false },
    integrations: (all) => all.filter(({ name }) => !skip.includes(name)),
    beforeSend(event) {
      // Something thrown that wasn't an Error (a rejected string, say) is all data, so it all goes
      for (const error of event.exception?.values ?? []) {
        error.value = error.mechanism?.synthetic ? undefined : error.value && redact(error.value);
      }
      return { ...event, message: undefined, extra: undefined };
    }
  });
  return captureException;
}
