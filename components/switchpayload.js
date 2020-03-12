"use strict";

const analyticsRequest = require("../helpers/analyticsRequest");

let defaultState = 'start';

const getState = (payload, states = []) => {
  console.log('getState() payload:', payload);
  let ret = defaultState;
  if (states.indexOf(payload) > -1) {
    ret = payload;
  }

  return new Promise((resolve, reject) => {
    resolve(ret)
  })
};

module.exports = {
  metadata: () => ({
    "name": "SwitchPayload",
    "properties": {
      "switchStates": {"type": "string", "required": false},
      "defaultState": {"type": "string", "required": false},
      "botId": {"type": "string", "required": false},
      "botName": {"type": "string", "required": false}
    },
    "supportedActions": [
      "state1",
      "state2",
      "state3"
    ]
  }),

  invoke: (conversation, done) => {
    console.log("switchpayload");
    console.log("BotSupplySwitchPayloadHK_NEW INVOKED -> PAYLOAD: ", conversation.messagePayload());
    let keepTurn = true;
    let payload = '';

    let properties = conversation.properties();
    let type = 'text';
    let resetStateToNlp = false;
    // Check if payload is postback
    console.log("conversation.postback():", conversation.postback());
    if (conversation.postback()) {
      let postback = conversation.postback();
      payload = postback;
      console.log("postback: " + postback);
      if (postback.action) {
        payload = postback.action;
        resetStateToNlp = true;
        console.log("resetStateToNlp: " + resetStateToNlp);
      }
    }
    // else, check if payload is text (input)
    else if (conversation.messagePayload()) {
      payload = conversation.messagePayload().text;
    }

    // attempt to log analytics by making request to analytics API
    analyticsRequest.saveMessage(conversation);

    // let switchStates = conversation.properties().switchStates.split(',');
    let switchStatesRaw = conversation.properties().switchStates;
    let switchStates = [];

    if (Array.isArray(switchStatesRaw)) {
      switchStates = switchStatesRaw;
    } else if (switchStatesRaw !== null && typeof switchStatesRaw === 'object') {
      for (let name in switchStatesRaw) {
        if (switchStatesRaw.hasOwnProperty(name)) {
          switchStates.push(switchStatesRaw[name]);
          if (name != switchStatesRaw[name] && switchStates.indexOf(name) == -1) {
            switchStates.push(name);
          }
        }
      }
    } else {
      switchStates = conversation.properties().switchStates.split(',');
    }

    if (conversation.properties().defaultState) {
      defaultState = conversation.properties().defaultState;
    }

    let state = defaultState;

    getState(payload, switchStates)
      .then((_state) => {
        state = _state;
      })
      .then(() => {

        let awaitingInput = conversation.variable("awaitingInput");

        if (awaitingInput && awaitingInput != defaultState) {
          let inputVariable = conversation.variable("inputVariable");

          state = 'SAVE_INPUT_' + inputVariable;

          let txt = '';
          if (conversation.postback()) {
            txt = conversation.postback();
            if (conversation.postback().variables && conversation.postback().variables.state) {
              txt = conversation.postback().variables.state;
            }

          } else if (conversation.messagePayload()) {
            let mp = conversation.messagePayload();
            if (mp.text) {
              txt = mp.text;
            }
          }

          if (inputVariable) {
            conversation.variable(inputVariable, txt);
          }

          return state;
        }
        return state;
      })
      .then(() => {
        if (resetStateToNlp) {
          console.log('resetStateToNlp: ', resetStateToNlp);
          state = 'nlp';
        }
        console.log('STATE: ', state);
        conversation.keepTurn(keepTurn);
        conversation.transition("nlp");
        done();
      })

  }
};
