import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { EAS_PROJECT_ID } from './config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

/** Ask permission (once) and send this phone's push address to oenodpay. */
export async function registerForPush() {
  if (Platform.OS === 'web' || !Device.isDevice || !EAS_PROJECT_ID || EAS_PROJECT_ID.startsWith('REPLACE')) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'oenodpay', importance: Notifications.AndroidImportance.HIGH, lightColor: '#2E5BFF' });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })).data;
  await api('/api/account/push', { method: 'PUT', body: { token } });
  return token;
}

export async function unregisterPush() {
  await api('/api/account/push', { method: 'DELETE' });
}
