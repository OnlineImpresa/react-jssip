export const mediaDeviceExists = async (
  deviceId: string,
  kind: "audioinput" | "audiooutput"
): Promise<boolean> => {
  const devices = await navigator.mediaDevices.enumerateDevices();

  for (const device of devices) {
    if (device.kind === kind && device.deviceId === deviceId) {
      return true;
    }
  }

  return false;
};
