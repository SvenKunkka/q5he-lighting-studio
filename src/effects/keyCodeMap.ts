/* Map KeyboardEvent.code → our keyLayout id.
 * Returns the LED index for that key (or -1 if no RGB LED slot exists). */
import { LED_INDEX_BY_KEY_ID } from '../lighting/keyLayout';

const CODE_TO_ID: Record<string, string> = {
  Escape: 'esc',
  F1: 'f1', F2: 'f2', F3: 'f3', F4: 'f4', F5: 'f5', F6: 'f6',
  F7: 'f7', F8: 'f8', F9: 'f9', F10: 'f10', F11: 'f11', F12: 'f12',
  PrintScreen: 'prtsc', ScrollLock: 'slck', Pause: 'pause',

  Backquote: 'grave',
  Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5',
  Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0',
  Minus: 'minus', Equal: 'equal', Backspace: 'bspc',
  Insert: 'ins', Home: 'home', PageUp: 'pgup',

  Tab: 'tab',
  KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyR: 'r', KeyT: 't',
  KeyY: 'y', KeyU: 'u', KeyI: 'i', KeyO: 'o', KeyP: 'p',
  BracketLeft: 'lbrc', BracketRight: 'rbrc', Backslash: 'bsls',
  Delete: 'del', End: 'end', PageDown: 'pgdn',

  CapsLock: 'caps',
  KeyA: 'a', KeyS: 's', KeyD: 'd', KeyF: 'f', KeyG: 'g',
  KeyH: 'h', KeyJ: 'j', KeyK: 'k', KeyL: 'l',
  Semicolon: 'scln', Quote: 'quot', Enter: 'ent',

  ShiftLeft: 'lsft',
  KeyZ: 'z', KeyX: 'x', KeyC: 'c', KeyV: 'v', KeyB: 'b',
  KeyN: 'n', KeyM: 'm',
  Comma: 'comm', Period: 'dot', Slash: 'slsh',
  ShiftRight: 'rsft',
  ArrowUp: 'up',

  ControlLeft: 'lctl', MetaLeft: 'lwin', AltLeft: 'lalt',
  Space: 'spc',
  AltRight: 'ralt', MetaRight: 'rwin', ContextMenu: 'fn',
  ControlRight: 'rctl',
  ArrowLeft: 'left', ArrowDown: 'down', ArrowRight: 'right',

  NumLock: 'numlock',
  NumpadDivide: 'kp/', NumpadMultiply: 'kp*', NumpadSubtract: 'kp-',
  Numpad7: 'kp7', Numpad8: 'kp8', Numpad9: 'kp9', NumpadAdd: 'kp+',
  Numpad4: 'kp4', Numpad5: 'kp5', Numpad6: 'kp6',
  Numpad1: 'kp1', Numpad2: 'kp2', Numpad3: 'kp3', NumpadEnter: 'kpent',
  Numpad0: 'kp0', NumpadDecimal: 'kpdot',
};

export function codeToLedIndex(code: string): number {
  const id = CODE_TO_ID[code];
  return id !== undefined && LED_INDEX_BY_KEY_ID[id] !== undefined ? LED_INDEX_BY_KEY_ID[id] : -1;
}
