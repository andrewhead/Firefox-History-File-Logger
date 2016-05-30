// The code for this plugin comes from several examples.
// One of these examples is the MDN page on dialogues in the browser:
// https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Display_a_Popup

var self = require('sdk/self');
var data = require('sdk/self').data;
var windows = require('sdk/windows').browserWindows;
var tabs = require('sdk/tabs');
var Request = require('sdk/request').Request;
var Panel = require('sdk/panel').Panel;
var ActionButton = require('sdk/ui/button/action').ActionButton;
var passwords = require('sdk/passwords');


// Global variables
var HOST = "https://searchlogger.tutorons.com";
var CREDENTIAL_REALM = "Search Task Logger";


// Retrieve the username and API key from memory, if there is one
function getCredential(callback, err) {
  passwords.search({
    realm: CREDENTIAL_REALM,
    onComplete: function(credentials) {
      console.log("Credentials:", credentials.length);
      if (credentials.length >= 1) {
        if (callback !== undefined) {
          callback(credentials[0]);
        }
      } else {
        if (err !== undefined) {
          err(credentials);
        }
      }
    }
  });
}


function clearCredentials(callback) {

  // Find all credentials
  passwords.search({
    realm: CREDENTIAL_REALM,
    onComplete: function(credentials) {

      // If there are no existing credentials, we are done.
      if (credentials.length === 0) {
        callback();
      }

      // Remove each credential
      credentials.forEach(function(credentialToRemove) {
        passwords.remove({
          realm: credentialToRemove.realm,
          username: credentialToRemove.username,
          password: credentialToRemove.password,

          // After each credential is removed, check to see if
          // the list of credentials is empty.  If so, we are finished
          // and call the success callback.
          onComplete: function() {
            passwords.search({
              realm: CREDENTIAL_REALM,
              onComplete: function(credentials) {
                if (credentials.length === 0) {
                  callback();
                }
              }
            });
          }
        });
      }); 
    }
  });
}


// Store the username and API key in the password memory
// This clears out all existing usernames and API keys for this add-on.
function setCredential(credential, callback) {
  clearCredentials(function() {
    var storeOptions = {
      realm: credential.realm,
      username: credential.username,
      password: credential.password,
      onComplete: callback
    };
    passwords.store(storeOptions);
  });
}


// Upload a navigation event to the web server
function log(credential, tab, eventMessage, callback, err) {

  console.log("Logging event:", eventMessage, "-", tab.index, tab.title, tab.url);

  var request = Request({
    url: HOST + "/log/api/location_event/",
    content: JSON.stringify({
      visit_date: new Date().toISOString(),
      tab_index: tab.index,
      title: tab.title,
      url: tab.url,
      event_type: eventMessage
    }),
    contentType: 'application/json',
    headers: {
      Authorization: "ApiKey " + credential.username + ":" + credential.password
    },
    onComplete: function(response) {
      if (response.status === 0) {
        if (err !== undefined) {
          err(response);
        }
      }
      if (callback !== undefined) {
        callback(response);
      }
    }
  });
  request.post();

}


function isCredentialValid(credential, callback) {
  console.log("Checking credential:", credential);
  log(credential, windows.activeWindow.tabs.activeTab, "Testing API key", function(response) {
    // HTTP response 201 is the response for a created resource
    callback(response.status === 201);
  });
}


function askForCredential(callback) {

  var localUsername, localApiKey;

  var apiKeyEntry = Panel({
    width: 250,
    height: 180,
    contentURL: data.url("text-entry.html"),
    contentScriptFile: data.url("get-apikey.js")
  });

  apiKeyEntry.on('show', function() {
    apiKeyEntry.port.emit('show');
  });

  apiKeyEntry.port.on('text-entered', function(data) {
    localUsername = data.username;
    localApiKey = data.apiKey;
    apiKeyEntry.hide();
  });

  // If the panel is dismissed before the API key is given, bring it back up.
  apiKeyEntry.on('hide', function() {
    if (localApiKey !== '' && localApiKey !== null && localUsername !== '' && localUsername !== null) {
      var credential = {
        realm: CREDENTIAL_REALM,
        username: localUsername,
        password: localApiKey
      };
      isCredentialValid(credential, function(valid) {
        if (valid === true) {
          setCredential(credential, function() {
            callback(credential);
            console.log("New credential:", credential);
          });
        } else {
          askForCredential(callback);
        }
      });
    } else {
      askForCredential(callback);
    }
  });

  apiKeyEntry.show();

}

// A convenience function for logging, using stored credentials
function logWithDefaultCredential(tab, eventMessage, callback, err) {
  getCredential(function(credential) {
    log(credential, tab, eventMessage, callback, err);
  }, function() {
    askForCredential(function(credential) {
      log(credential, tab, eventMessage, callback, err);
    });
  });
}


// EVENT HANDLERS
// One of the first tasks of this addon is to make sure it has valid credentials for logging events.
// For any of these event handlers that look for default credentials, the browser will ask a
// user to provide credentials after the first logging event.

// Listen for when the window goes in and out of focus
windows.on('deactivate', function(window) {
  logWithDefaultCredential(window.tabs.activeTab, "Window deactivated");
});

windows.on('activate', function(window) {
  logWithDefaultCredential(window.tabs.activeTab, "Window activated");
});

// Listen for the loading of new tabs and switching between tabs
tabs.on('open', function(tab) {
  logWithDefaultCredential(tab, "Tab opened");
});

tabs.on('ready', function(tab) {
  logWithDefaultCredential(tab, "Tab content loaded");
});

tabs.on('activate', function(tab) {
  logWithDefaultCredential(tab, "Tab activated");
});


ActionButton({
  id: 'start-study',
  label: "Start Study",
  onClick: askForCredential,
  icon: {
    '16': './icon-16.png',
    '32': './icon-32.png',
    '64': './icon-64.png'
  }
});
