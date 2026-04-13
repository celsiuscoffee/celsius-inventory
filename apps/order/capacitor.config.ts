import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.celsiuscoffee.orders',
  appName: 'Celsius Orders',
  webDir: 'out',
  server: {
    // Load from the Vercel domain — more reliable DNS than custom domain
    // which can cause ERR_NAME_NOT_RESOLVED on Sunmi devices
    url: 'https://celsius-pickup-app.vercel.app/staff/kds',
    cleartext: true,
  },
  android: {
    buildOptions: {
      signingType: 'apksigner',
    },
  },
};

export default config;
