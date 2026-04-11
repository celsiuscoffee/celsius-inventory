import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.celsiuscoffee.orders',
  appName: 'Celsius Orders',
  webDir: 'out',
  server: {
    // Load from the deployed URL so we always get latest updates
    // without rebuilding the APK
    url: 'https://order.celsiuscoffee.com/staff/kds',
    cleartext: true,
  },
  android: {
    buildOptions: {
      signingType: 'apksigner',
    },
  },
};

export default config;
