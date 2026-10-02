/** RFC 9728 metadata for the /mcp resource (the URL the WWW-Authenticate header points at). */
import { configFrom, protectedResourceMetadata } from '../../../utils/oauth';

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300');
  return protectedResourceMetadata(configFrom(String(useRuntimeConfig(event).public.siteUrl || '')));
});
