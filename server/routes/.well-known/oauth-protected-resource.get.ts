/** RFC 9728 metadata at the bare well-known path, for clients that do not add the resource path. */
import { configFrom, protectedResourceMetadata } from '../../utils/oauth';

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300');
  return protectedResourceMetadata(configFrom(String(useRuntimeConfig(event).public.siteUrl || '')));
});
