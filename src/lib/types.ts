import * as PropTypes from "prop-types";

export interface ExtraHeaders {
  register?: string[];
  invite?: string[];
  hold?: string[];
}

export const extraHeadersPropType = PropTypes.objectOf(
  PropTypes.arrayOf(PropTypes.string)
);

// https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer
export type IceServers = {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: string;
  password?: string;
}[];
export const iceServersPropType = PropTypes.arrayOf(PropTypes.object);

export interface Sip {
  status?: string;
  errorType?: string;
  errorMessage?: string;
  host?: string;
  port?: number;
  pathname?: string;
  secure?: boolean;
  user?: string;
  password?: string;
  autoRegister?: boolean;
  autoAnswer: boolean;
  sessionTimersExpires: number;
  extraHeaders: ExtraHeaders;
  iceServers: RTCIceServer[];
  debug: boolean;
  debugNamespaces?: string;
}

export const sipPropType = PropTypes.shape({
  status: PropTypes.string,
  errorType: PropTypes.string,
  errorMessage: PropTypes.string,

  host: PropTypes.string,
  port: PropTypes.number,
  user: PropTypes.string,
  pathname: PropTypes.string,
  secure: PropTypes.bool,
  password: PropTypes.string,
  autoRegister: PropTypes.bool,
  autoAnswer: PropTypes.bool,
  sessionTimersExpires: PropTypes.number,
  extraHeaders: extraHeadersPropType,
  iceServers: iceServersPropType,
  debug: PropTypes.bool,
  debugNamespaces: PropTypes.string,
});

export interface Call {
  id: string;
  status: string;
  direction: string;
  counterpart: string;
}

export const callPropType = PropTypes.shape({
  id: PropTypes.string,
  status: PropTypes.string,
  direction: PropTypes.string,
  counterpart: PropTypes.string,
  isOnHold: PropTypes.bool,
  hold: PropTypes.func,
  unhold: PropTypes.func,
  toggleHold: PropTypes.func,
  microphoneIsMuted: PropTypes.bool,
  muteMicrophone: PropTypes.func,
  unmuteMicrophone: PropTypes.func,
  toggleMuteMicrophone: PropTypes.func,
});

/**
 * Extended version of {HTMLAudioElement} with typings for the Audio Output Devices API
 *
 * @link https://w3c.github.io/mediacapture-output/#htmlmediaelement-extensions
 */
export interface WebAudioHTMLMediaElement extends HTMLAudioElement {
  readonly sinkId: string;

  /**
   * Sets the ID of the audio device to use for output and returns a Promise.
   * This only works when the application is authorized to use the specified device.
   *
   * @link @link https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId
   *
   * @param id
   */
  setSinkId(id: string): Promise<undefined>;
}

export interface Logger {
  debug(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
  info(message?: any, ...optionalParams: any[]): void;
  warn(message?: any, ...optionalParams: any[]): void;
  log(message?: any, ...optionalParams: any[]): void;
}
