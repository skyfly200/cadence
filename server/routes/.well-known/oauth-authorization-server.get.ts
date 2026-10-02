/** RFC 8414 authorization server metadata. */
import { authorizationServerMetadata, configFrom } from '../../utils/oauth';

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300');
  return authorizationServerMetadata(configFrom(String(useRuntimeConfig(event).public.siteUrl || '')));
});
