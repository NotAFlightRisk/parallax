import { captureException, init } from '@sentry/browser';

// Quoted bits of an error message can be lifted straight from someone's logs
const redact = (message: string) => message.replace(/(["'`]).*?\1/g, '$1…$1');

export function start(dsn: string) {
  init({
    dsn,
    maxBreadcrumbs: 0,
    sendClientReports: false,
    integrations: (all) => all.filter(({ name }) => name !== 'BrowserSession'),
    beforeSend(event) {
      for (const error of event.exception?.values ?? []) error.value &&= redact(error.value);
      return event;
    }
  });
  return captureException;
}
