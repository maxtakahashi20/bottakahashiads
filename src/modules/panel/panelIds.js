const PREFIX = 'tn:painel';

const PANEL = {
  HOME: `${PREFIX}:home`,
  REFRESH: `${PREFIX}:refresh`,
  TOKENS: `${PREFIX}:tokens`,
  SERVERS: `${PREFIX}:servers`,
  MESSAGE: `${PREFIX}:message`,
  TRACKING: `${PREFIX}:tracking`,
  STOP: `${PREFIX}:stop`,
  SCHEDULE: `${PREFIX}:schedule`,
  DIVULGATIONS: `${PREFIX}:divulgations`,
  LOGS: `${PREFIX}:logs`,
  CYCLES: `${PREFIX}:cycles`,
  TOKEN_ADD: `${PREFIX}:token_add`,
  TOKEN_REMOVE: `${PREFIX}:token_remove`,
  SERVER_ADD: `${PREFIX}:server_add`,
  SERVER_REMOVE: `${PREFIX}:server_remove`,
  SERVER_EDIT_MSG: `${PREFIX}:server_edit_msg`,
  SERVER_RESET_NEXT: `${PREFIX}:server_reset_next`,
  SERVER_SEND_NOW: `${PREFIX}:server_send_now`,
  MSG_EDIT_GLOBAL: `${PREFIX}:msg_edit_global`,
  MSG_DEFAULT: `${PREFIX}:msg_default`,
  MSG_FULL: `${PREFIX}:msg_full`,
  SCHEDULE_CREATE: `${PREFIX}:schedule_create`,
  SCHEDULE_CANCEL: `${PREFIX}:schedule_cancel`,
  DIV_CLEAR: `${PREFIX}:div_clear`,
  DIV_SELECT: `${PREFIX}:div_select`,
  CYCLES_EDIT: `${PREFIX}:cycles_edit`,
  CYCLES_RESET: `${PREFIX}:cycles_reset`,
  TRACKING_ADD: `${PREFIX}:tracking_add`,
  TRACKING_VIEW: `${PREFIX}:tracking_view`,
  TRACKING_DEL: `${PREFIX}:tracking_del`,
  BACK: `${PREFIX}:back`
};

const MODAL = {
  SERVER_ADD: `${PREFIX}:modal:server_add`,
  MSG_GLOBAL: `${PREFIX}:modal:msg_global`,
  SCHEDULE: `${PREFIX}:modal:schedule`,
  CYCLES: `${PREFIX}:modal:cycles`,
  DIV_NUMBER: `${PREFIX}:modal:div_number`,
  TOKEN_ADD: `${PREFIX}:modal:token_add`,
  TOKEN_REMOVE: `${PREFIX}:modal:token_remove`,
  TRACKING_ADD: `${PREFIX}:modal:tracking_add`
};

module.exports = { PREFIX, PANEL, MODAL };
