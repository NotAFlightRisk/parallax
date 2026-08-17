export async function readFiles(list: FileList | File[], limit: number) {
  const files = Array.from(list).slice(0, Math.max(0, limit));
  return Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() })));
}

export function download(name: string, text: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

/** Clipboard writes need a secure context, so fall back to a hidden textarea */
export async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const done = document.execCommand('copy');
    field.remove();
    return done;
  }
}
