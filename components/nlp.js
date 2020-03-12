'use strict';

const MIN_NLP_CONFIDENCE = 0.5;
const NLPAPI = require('../helpers/NLPAPI.js');
const stringSimilarity = require('string-similarity');

// Any block that needs logic should be added here and given a name. Use the given name on the rest of the code.
const block = {
  "EXAMPLE_BLOCK": "BLOCK_0e4dj7ie-od4u-4246-a8ed-1d5f5ceefa55",
};

const logic = {
  "EXAMPLE_BLOCK": {
    "do_before": async (conversation, text) => {
      // Called when we're about to enter the block 'EXAMPLE_BLOCK' (When transitionTo == 'EXAMPLE_BLOCK')
      // Do something with the string 'text' and the object 'conversation'

      // Once done, return the name of the next block to skip all code and force transition to it
      // Or return null to keep going as before
      return null
    },
    "do_after": async (conversation, text) => {
      // Called when the current block is 'EXAMPLE_BLOCK'
      // So when the user entered the block before sending this message and is about to enter a different block

      // Once done, return the name of the next block to skip all code and force transition to it
      // Or return null to keep going as before
      return null;
    },
    "EXAMPLE_ENTITY": "SOME_OTHER_BLOCK", // If user was in block 'EXAMPLE_BLOCK', and had entity "EXAMPlE_ENTITY", go to "SOME_OTHER_BLOCK",
    "fallback": "EXAMPLE_FALLBACK_BLOCK" // When in 'EXAMPLE_BLOCK' and confidence is low and there's no other block to go to, use this fallback instead of the generic one
  }
};

let entities = [];

module.exports = {
  metadata: () => ({
    name: 'NLP',
    properties: {
      botId: {type: 'string', required: true},
      minConfidence: {type: 'string'},
      fallbackMessage: {type: 'string'},
      sheetKeyfilePath: {type: 'string'},
      sheetId: {type: 'string'}
    },
    supportedActions: []
  }),

  invoke: async (conversation, done) => {
    let properties = conversation.properties();
    const botId = properties ? properties.botId || conversation.variable('cmsBotId') : conversation.variable("cmsBotId");
    const messagePayload = conversation.request().message.messagePayload;
    const currentState = getNamedBlock(conversation.variable("user.currentState"));
    let transitionTo = "", keepTurn = true, text = messagePayload.text;
    console.log(`currentState: ${currentState}`);

    // If QR is clicked, go to destination.
    if (messagePayload.type === 'postback') {
      conversation.keepTurn(keepTurn);
      transitionTo = messagePayload.postback.action;
      return transition();
    }

    // If text is a name of a block or component, transition to it.
    if ((text.startsWith("BLOCK_") && text.length === "BLOCK_4d7dkjui-6492-4f5e-iu75-0da0149696gy".length)
      || (text.startsWith("COMPONENT_") && text.length === "COMPONENT_dju76f64-6056-8u6y-ab68-aaaff9lka6ec".length)) {
      conversation.transition(text);
      console.log("Transition to text:", text);
      return done();
    }

    // Call the main NLP dataset:
    NLPAPI(botId, text, conversation).then(async response => {
      if (!response) {
        transitionTo = 'Unresolved';
        return;
      }
      if (response.entities)
        entities = response.entities;
      //Example functionality to get entities and go to them. Replace _entitiesDataset with the correct name
      const entResponse = await NLPAPI(botId + "_entitiesDataset", text, conversation);
      if (entResponse && entResponse.fsd > MIN_NLP_CONFIDENCE && logic[currentState][entResponse.intent.name]) {
        transitionTo = logic[currentState][entResponse.intent.name];
      }

      if (response.intent.confidence < MIN_NLP_CONFIDENCE) {
        if (logic[currentState] && logic[currentState]["fallback"])
          transitionTo = logic[currentState]["fallback"];
        else
          transitionTo = `Unresolved`;
        return;
      }
      transitionTo = response.intent.name;
    }).catch(e => {
      console.error('ERROR: ' + e.stack);
      conversation.logger().log("ERROR: " + e);
      return conversation.reply({text: 'Something bad happened.'});
    }).then(() => transition());

    async function transition() {
      // Check if there is something to do in the current block
      if (logic[currentState]) {
        if (logic[currentState]["do_after"]) {
          let ans = await logic[currentState]["do_after"](conversation, text);
          if (typeof ans == "string" && ans.length > 0)
            transitionTo = ans;
        }
      }

      //Check if there's something to do before entering next block
      transitionTo = getNamedBlock(transitionTo);
      if (logic[transitionTo]) {
        if (logic[transitionTo]["do_before"]) {
          let ans = await logic[transitionTo]["do_before"](conversation, text);
          if (ans)
            transitionTo = ans;
        }
      }


      console.log("NLP Transitioning to " + transitionTo);
      if (block[transitionTo])
        transitionTo = block[transitionTo];
      conversation.keepTurn(keepTurn);
      conversation.transition(transitionTo);
      if (!transitionTo.toLowerCase().includes("unresolved"))
        conversation.variable("user.currentState", transitionTo);
      done();
    }
  }
};


function getNamedBlock(id) {
  for (let i in block)
    if (block[i] === id)
      return i;
  return id;
}