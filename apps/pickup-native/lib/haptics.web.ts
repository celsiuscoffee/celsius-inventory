export enum ImpactFeedbackStyle {
  Light = "light",
  Medium = "medium",
  Heavy = "heavy",
  Rigid = "rigid",
  Soft = "soft",
}

export enum NotificationFeedbackType {
  Success = "success",
  Warning = "warning",
  Error = "error",
}

export async function impactAsync(_s?: ImpactFeedbackStyle): Promise<void> {}
export async function notificationAsync(_t?: NotificationFeedbackType): Promise<void> {}
export async function selectionAsync(): Promise<void> {}
