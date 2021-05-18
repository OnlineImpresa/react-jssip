import React, {
  createContext,
  useContext,
  useEffect,
  memo,
  useReducer,
} from "react";
import * as JsSIP from "jssip";
import {
  // AnswerOptions,
  // HoldEvent,
  // RenegotiateOptions,
  RTCSession,
  // TerminateOptions,
} from "jssip/lib/RTCSession";
import { IncomingRequest, OutgoingRequest } from "jssip/lib/SIPMessage";
// import { CallOptions, UnRegisterOptions } from "jssip/lib/UA";
import {
  CALL_DIRECTION_INCOMING,
  CALL_DIRECTION_OUTGOING,
  CALL_STATUS_ACTIVE,
  CALL_STATUS_IDLE,
  CALL_STATUS_STARTING,
  // CALL_STATUS_STOPPING,
  CallDirection,
  CallStatus,
  SIP_ERROR_TYPE_CONFIGURATION,
  // SIP_ERROR_TYPE_CONNECTION,
  SIP_ERROR_TYPE_REGISTRATION,
  SIP_STATUS_CONNECTED,
  SIP_STATUS_CONNECTING,
  SIP_STATUS_DISCONNECTED,
  SIP_STATUS_ERROR,
  SIP_STATUS_REGISTERED,
  SipErrorType,
  SipStatus,
} from "../lib/enums";
import { mediaDeviceExists } from "../lib/media";
import {
  // callPropType,
  ExtraHeaders,
  // extraHeadersPropType,
  // iceServersPropType,
  // Logger,
  // sipPropType,
  WebAudioHTMLMediaElement,
} from "../lib/types";

export interface JsSipConfig {
  host: string;
  port: number;
  pathname: string;
  secure: boolean;
  user: string;
  password: string;
  autoRegister: boolean;
  autoAnswer: boolean;
  iceRestart: boolean;
  sessionTimersExpires: number;
  extraHeaders: ExtraHeaders;
  iceServers: RTCIceServer[];
  debug: boolean;
  inboundAudioDeviceId: string;
  outboundAudioDeviceId: string;
  debugNamespaces?: string | null;
}

export interface JsSipState {
  sipStatus?: SipStatus;
  sipErrorType?: SipErrorType | undefined;
  sipErrorMessage?: string | undefined;
  callStatus?: CallStatus;
  callDirection?: CallDirection | undefined;
  callCounterpart?: string | undefined;
  dtmfSender?: RTCDTMFSender | undefined;
  callIsOnHold?: boolean;
  callMicrophoneIsMuted?: boolean;
  rtcSession?: RTCSession | undefined;
  ua?: JsSIP.UA;
}

interface SipActionType {
  type: "UPDATE" | "RESET" | "SET_UA";
  payload?: JsSipState;
  ua?: JsSIP.UA;
}

interface SipContextType {
  state: JsSipState;
  dispatch: React.Dispatch<SipActionType>;
}

const SipContext = createContext<SipContextType | undefined>(undefined);

const reducer = (state: JsSipState, action: SipActionType): JsSipState => {
  switch (action.type) {
    case "UPDATE":
      return { ...state, ...action.payload };
    case "RESET":
      return { sipStatus: SIP_STATUS_DISCONNECTED };
    case "SET_UA":
      return { ...state, ua: action.ua! };
    default:
      return state;
  }
};

const SipProvider: React.FC<{ config: JsSipConfig }> = ({
  children,
  config,
}) => {
  const [state, dispatch] = useReducer(reducer, {
    sipStatus: SIP_STATUS_DISCONNECTED,
  });

  const { ua: userAgent } = state;

  let currentSinkId: string | null = null;
  let remoteAudio: WebAudioHTMLMediaElement | null = null;

  const initialize = async (
    config: JsSipConfig
  ): Promise<JsSIP.UA | undefined> => {
    try {
      const socket = new JsSIP.WebSocketInterface(
        `${config.secure ? "wss" : "ws"}://${config.host}:${config.port}${
          config.pathname
        }`
      );
      const userAgent = new JsSIP.UA({
        uri: `sip:${config.user}@${config.host}`,
        password: config.password,
        sockets: [socket],
        register: config.autoRegister,
      });
      await handleAudioSinkId(config.outboundAudioDeviceId);
      return userAgent;
    } catch (error) {
      dispatch({
        type: "UPDATE",
        payload: {
          sipStatus: SIP_STATUS_ERROR,
          sipErrorType: SIP_ERROR_TYPE_CONFIGURATION,
          sipErrorMessage: error.message,
        },
      });
      return undefined;
    }
  };

  const createRemoteAudioElement = (): WebAudioHTMLMediaElement => {
    const id = "sip-provider-audio";
    let el = window.document.getElementById(id);

    if (el) {
      return el as WebAudioHTMLMediaElement;
    }

    el = window.document.createElement("audio") as WebAudioHTMLMediaElement;
    el.id = id;
    (el as WebAudioHTMLMediaElement).autoplay = true;

    window.document.body.appendChild(el);

    return el as WebAudioHTMLMediaElement;
  };

  const handleAudioSinkId = async (outboundAudioDeviceId: string) => {
    let outputDeviceId = outboundAudioDeviceId;
    const exists = await mediaDeviceExists(outputDeviceId, "audiooutput");
    if (!outputDeviceId || !exists) {
      outputDeviceId = "default";
    }

    if (outputDeviceId) {
      try {
        remoteAudio = createRemoteAudioElement();
        await setAudioSinkId(outputDeviceId);
      } catch (e) {}
    }
  };

  const getRemoteAudioOrFail = (): WebAudioHTMLMediaElement => {
    if (!remoteAudio) {
      throw new Error("remoteAudio is not initiliazed");
    }

    return remoteAudio;
  };

  const setAudioSinkId = async (sinkId: string): Promise<void> => {
    if (currentSinkId && sinkId === currentSinkId) {
      return;
    }

    currentSinkId = sinkId;

    return getRemoteAudioOrFail().setSinkId(sinkId);
  };

  useEffect(() => {
    if (window.document.getElementById("sip-provider-audio")) {
      throw new Error(
        `Creating two SipProviders in one application is forbidden. If that's not the case then check if you're using "sip-provider-audio" as id attribute for any existing element`
      );
    }

    const remoteAudio = createRemoteAudioElement();
    window.document.body.appendChild(remoteAudio);
  }, []);

  useEffect(() => {
    async () => {
      dispatch({ type: "SET_UA", ua: await initialize(config) });
    };
  }, [config]);

  useEffect(() => {
    if (userAgent) {
      userAgent.addListener("connecting", () => {
        dispatch({
          type: "UPDATE",
          payload: {
            sipStatus: SIP_STATUS_CONNECTING,
            sipErrorType: undefined,
            sipErrorMessage: undefined,
          },
        });
      });

      userAgent.addListener("connected", () => {
        dispatch({
          type: "UPDATE",
          payload: {
            sipStatus: SIP_STATUS_CONNECTED,
            sipErrorType: undefined,
            sipErrorMessage: undefined,
          },
        });
      });

      userAgent.addListener("disconnected", () => {
        dispatch({
          type: "UPDATE",
          payload: {
            sipStatus: SIP_STATUS_DISCONNECTED,
            sipErrorType: undefined,
            sipErrorMessage: undefined,
          },
        });
      });

      userAgent.addListener("registered", () => {
        dispatch({
          type: "UPDATE",
          payload: {
            sipStatus: SIP_STATUS_REGISTERED,
            callStatus: CALL_STATUS_IDLE,
          },
        });
      });

      userAgent.addListener("unregistered", () => {
        if (userAgent.isConnected()) {
          dispatch({
            type: "UPDATE",
            payload: {
              sipStatus: SIP_STATUS_CONNECTED,
              callStatus: CALL_STATUS_IDLE,
              callDirection: undefined,
            },
          });
        } else {
          dispatch({
            type: "UPDATE",
            payload: {
              sipStatus: SIP_STATUS_DISCONNECTED,
              callStatus: CALL_STATUS_IDLE,
              callDirection: undefined,
            },
          });
        }
      });

      userAgent.addListener("registrationFailed", (data) => {
        dispatch({
          type: "UPDATE",
          payload: {
            sipStatus: SIP_STATUS_ERROR,
            sipErrorType: SIP_ERROR_TYPE_REGISTRATION,
            sipErrorMessage: data.cause || data.response.reason_phrase,
          },
        });
      });

      userAgent.on(
        "newRTCSession",
        ({
          originator,
          session: rtcSession,
          request: rtcRequest,
        }: {
          originator: "local" | "remote" | "system";
          session: RTCSession;
          request: IncomingRequest | OutgoingRequest;
        }) => {
          const { rtcSession: rtcSessionInState } = state;
          // Avoid if busy or other incoming
          if (rtcSessionInState) {
            rtcSession.terminate({
              status_code: 486,
              reason_phrase: "Busy Here",
            });
            return;
          }

          // identify call direction
          if (originator === "local") {
            const foundUri = rtcRequest.to.toString();
            const delimiterPosition = foundUri.indexOf(";") || null;
            dispatch({
              type: "UPDATE",
              payload: {
                callDirection: CALL_DIRECTION_OUTGOING,
                callStatus: CALL_STATUS_STARTING,
                callCounterpart: delimiterPosition
                  ? foundUri.substring(0, delimiterPosition) || foundUri
                  : foundUri,
                callIsOnHold: rtcSession.isOnHold().local,
                callMicrophoneIsMuted: rtcSession.isMuted().audio || false,
              },
            });
          } else if (originator === "remote") {
            const foundUri = rtcRequest.from.toString();
            const delimiterPosition = foundUri.indexOf(";") || null;
            dispatch({
              type: "UPDATE",
              payload: {
                callDirection: CALL_DIRECTION_INCOMING,
                callStatus: CALL_STATUS_STARTING,
                callCounterpart: delimiterPosition
                  ? foundUri.substring(0, delimiterPosition) || foundUri
                  : foundUri,
                callIsOnHold: rtcSession.isOnHold().local,
                callMicrophoneIsMuted: rtcSession.isMuted().audio || false,
              },
            });
          }

          dispatch({ type: "UPDATE", payload: { rtcSession } });

          rtcSession.on("failed", () => {
            if (state.rtcSession && state.rtcSession.connection) {
              // Close senders, as these keep the microphone open according to browsers (and that keeps Bluetooth headphones from exiting headset mode)
              state.rtcSession.connection.getSenders().forEach((sender) => {
                if (sender.track) {
                  sender.track.stop();
                }
              });
            }

            dispatch({
              type: "UPDATE",
              payload: {
                rtcSession: undefined,
                callStatus: CALL_STATUS_IDLE,
                callDirection: undefined,
                callCounterpart: undefined,
                dtmfSender: undefined,
                callMicrophoneIsMuted: false,
              },
            });
          });

          rtcSession.on("ended", () => {
            if (state.rtcSession && state.rtcSession.connection) {
              // Close senders, as these keep the microphone open according to browsers
              // and keeps Bluetooth headphones from exiting headset mode
              state.rtcSession.connection.getSenders().forEach((sender) => {
                if (sender.track) {
                  sender.track.stop();
                }
              });
            }

            dispatch({
              type: "UPDATE",
              payload: {
                rtcSession: undefined,
                callStatus: CALL_STATUS_IDLE,
                callDirection: undefined,
                callCounterpart: undefined,
                callIsOnHold: false,
                dtmfSender: undefined,
                callMicrophoneIsMuted: false,
              },
            });
          });

          rtcSession.on("peerconnection", (pc) => {
            const remoteAudio = getRemoteAudioOrFail();
            remoteAudio.srcObject = pc.peerconnection.getRemoteStreams()[0];

            pc.peerconnection.addEventListener(
              "addstream",
              (event: MediaStreamEvent) => {
                const stream = event.stream;

                if (stream) {
                  remoteAudio.srcObject = stream;

                  remoteAudio.play();
                }
              }
            );
          });

          rtcSession.on("accepted", () => {
            dispatch({
              type: "UPDATE",
              payload: {
                dtmfSender:
                  rtcSession.connection.getSenders().filter((x) => x.dtmf)[0]
                    .dtmf ?? undefined,
                callStatus: CALL_STATUS_ACTIVE,
              },
            });
          });
        }
      );
    }
  }, [userAgent]);

  return (
    <SipContext.Provider value={{ state, dispatch }}>
      {children}
    </SipContext.Provider>
  );
};

const useSipProvider = () => {
  const sipProvider = useContext(SipContext);

  return sipProvider;
};

const MemoizedProvider = memo(SipProvider);

export { MemoizedProvider, useSipProvider };
