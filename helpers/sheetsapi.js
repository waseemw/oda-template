const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = './token';


function authorize(credentials, callback, conversation) {
  if (conversation)
    conversation.logger().log("authorize function");
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  let token;
  try {
    token = require(TOKEN_PATH);
  } catch (e) {
    token = null;
  }
  if (!token) return getNewToken(oAuth2Client, callback, conversation);
  oAuth2Client.setCredentials(token);
  callback(oAuth2Client);

}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param callback The callback for the authorized client.
 * @param conversation Optional, used for logging.
 */
function getNewToken(oAuth2Client, callback, conversation) {
  if (conversation)
    conversation.logger().log("getNewToken function");
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  if (conversation)
    conversation.logger().log('Authorize this app by visiting this url: ' + authUrl);
  else
    console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return conversation ? conversation.logger().log(err.stack) : console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

const get = (range, pageName, spreadSheetId, conversation) => new Promise((resolve, reject) => {
  if (conversation)
    conversation.logger().log("googlesheetsapi: get function");
  let content = require('./credentials');
  if (!content) return conversation ? conversation.logger().log('Error loading client secret file: ' + "credentials NOT FOUND") : console.log('Error loading client secret file:', "credentials NOT FOUND");
  authorize(content, (auth) => {
    const sheets = google.sheets({version: 'v4', auth});
    sheets.spreadsheets.values.get({
      spreadsheetId: spreadSheetId,
      range: pageName + '!' + range
    }, (err, res) => {
      if (err) return reject(err);
      resolve(res.data.values);
    });
  }, conversation);
});
const append = (range, values, pageName, spreadSheetId, conversation) => new Promise((resolve, reject) => {
  if (conversation)
    conversation.logger().log("googlesheetsapi: append function");
  let resource = {
    values
  };
  let content = require('./credentials');
  if (!content) return conversation ? conversation.logger().log('Error loading client secret file: ' + "credentials NOT FOUND") : console.log('Error loading client secret file:', "credentials NOT FOUND");
  authorize(content, (auth) => {
    const sheets = google.sheets({version: 'v4', auth});
    sheets.spreadsheets.values.append({
      spreadsheetId: spreadSheetId,
      range: pageName + '!' + range,
      resource: resource,
      valueInputOption: "USER_ENTERED"
    }, (err, res) => {
      if (err) return reject(err);
      resolve(res.updatedCells);
    });
  }, conversation);
});


const update = (range, values, pageName, spreadSheetId, conversation) => new Promise((resolve, reject) => {
  if (conversation)
    conversation.logger().log("googlesheetsapi: update function");
  let resource = {
    values
  };
  let content = require('./credentials');
  if (!content) return conversation ? conversation.logger().log('Error loading client secret file: ' + "credentials NOT FOUND") : console.log('Error loading client secret file:', "credentials NOT FOUND");

  authorize(content, (auth) => {
    const sheets = google.sheets({version: 'v4', auth});
    sheets.spreadsheets.values.update({
      spreadsheetId: spreadSheetId,
      range: pageName + '!' + range,
      resource: resource,
      valueInputOption: "USER_ENTERED"
    }, (err, res) => {
      if (err) return reject(err);
      resolve(res.updatedCells);
    });
  }, conversation);
});
module.exports = {get, append, update};
