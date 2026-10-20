/** Opening the «create your account» sheet and the small confirmation toast from anywhere. */

export type JoinReason = "fav" | "trip" | "generic";
export interface ToastMsg {
  text: string;
  href?: string;
  linkText?: string;
}

export function openJoin(reason: JoinReason): void {
  window.dispatchEvent(new CustomEvent("sfr:join", { detail: reason }));
}

export function showToast(msg: ToastMsg): void {
  window.dispatchEvent(new CustomEvent("sfr:toast", { detail: msg }));
}
