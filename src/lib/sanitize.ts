// Strip HTML tags to prevent XSS
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove control characters
    .replace(/\s+/g, ' ')              // normalize whitespace
    .trim()
    .slice(0, maxLength);
}

// Validate and clean email
export function sanitizeEmail(input: string): string | null {
  if (!input) return null;
  const cleaned = input.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(cleaned)) return null;
  if (cleaned.length > 254) return null; // RFC 5321 max length
  return cleaned;
}

// Sanitize candidate name
export function sanitizeName(input: string): string | null {
  if (!input) return null;
  const cleaned = sanitizeText(input, 100);
  if (cleaned.length < 1) return null;
  return cleaned;
}
