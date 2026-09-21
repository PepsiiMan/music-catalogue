const ESCAPES: Record<string, string> = {
  '+': '\\+',
  '-': '\\-',
  '&': '\\&',
  '!': '\\!',
  '(': '\\(',
  ')': '\\)',
  '{': '\\{',
  '}': '\\}',
  '[': '\\[',
  ']': '\\]',
  '^': '\\^',
  '"': '\\"',
  '~': '\\~',
  '*': '\\*',
  '?': '\\?',
  ':': '\\:',
  '\\': '\\\\',
  '/': '\\/',
  ' ': '\\ ',
}

const RESERVED = new RegExp(`[${Object.keys(ESCAPES).map((c) => `\\${c}`).join('')}]`, 'g')

/** Escape Lucene reserved characters so user input can be interpolated into a query safely. */
export function sanitizeLucene(input: string): string {
  return input.replace(RESERVED, (char) => ESCAPES[char] ?? char)
}
