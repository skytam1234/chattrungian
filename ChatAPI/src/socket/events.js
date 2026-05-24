// Socket.IO event types and names

export const SOCKET_EVENTS = {
  // Client -> Server events
  JOIN_CONVERSATION: 'join_conversation',
  LEAVE_CONVERSATION: 'leave_conversation',
  SEND_MESSAGE: 'send_message',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  MARK_READ: 'mark_read',

  // Call events - Client -> Server
  CALL_INITIATE: 'call_initiate',
  CALL_ACCEPT: 'call_accept',
  CALL_DECLINE: 'call_decline',
  CALL_END: 'call_end',
  CALL_MISSED: 'call_missed',

  // WebRTC signaling - Client -> Server
  CALL_OFFER: 'call_offer',
  CALL_ANSWER: 'call_answer',
  CALL_ICE_CANDIDATE: 'call_ice_candidate',

  // Server -> Client events
  NEW_MESSAGE: 'new_message',
  MESSAGE_UPDATED: 'message_updated',
  MESSAGE_DELETED: 'message_deleted',
  MESSAGE_RECALLED: 'message_recalled',
  USER_TYPING: 'user_typing',
  MESSAGE_STATUS: 'message_status',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  CONVERSATION_UPDATED: 'conversation_updated',
  ERROR: 'error',

  // Call events - Server -> Client
  INCOMING_CALL: 'incoming_call',
  CALL_RINGING: 'call_ringing',
  CALL_ACCEPTED: 'call_accepted',
  CALL_DECLINED: 'call_declined',
  CALL_ENDED: 'call_ended',
  CALL_MISSED_NOTIFY: 'call_missed_notify',
  CALL_NO_ANSWER: 'call_no_answer',
  CALL_CANCELLED: 'call_cancelled',
  CALL_REJECTED: 'call_rejected', // Calle is offline or unavailable

  // WebRTC signaling - Server -> Client
  CALL_OFFER_RECEIVED: 'call_offer_received',
  CALL_ANSWER_RECEIVED: 'call_answer_received',
  CALL_ICE_CANDIDATE_RECEIVED: 'call_ice_candidate_received',

  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
};

export const SOCKET_ROOMS = {
  CONVERSATION: 'conversation:',
  USER: 'user:',
};

export default {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
};
