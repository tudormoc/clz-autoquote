/**
 * Copy text to clipboard with automatic fallback
 * Uses Clipboard API on localhost/HTTPS, fallback on HTTP
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Try modern Clipboard API first (works on localhost and HTTPS)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback:', err);
    }
  }

  // Fallback for HTTP (non-secure contexts)
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Failed to copy:', err);
    throw err;
  } finally {
    document.body.removeChild(textarea);
  }
}
