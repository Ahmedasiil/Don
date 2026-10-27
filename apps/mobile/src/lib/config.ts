import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** Your oenodpay server. Set EXPO_PUBLIC_API_URL when building, or "extra.apiUrl" in app.json.
 *  The web preview served by the website itself (at /mobile) talks to the site it came from. */
const sameOrigin = Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname.startsWith('/mobile') ? window.location.origin : '';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || sameOrigin || (Constants.expoConfig?.extra?.apiUrl as string) || 'https://oenodpay.com').replace(/\/$/, '');
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
export const EAS_PROJECT_ID = (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;
