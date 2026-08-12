export function isCategoryIconImage(icon: string | undefined): icon is string {
  return typeof icon === 'string' && /^(?:https?:\/\/|\/)[^\s]+$/i.test(icon.trim());
}
