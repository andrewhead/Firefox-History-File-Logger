// The code for this plugin comes from several examples.
// One of these examples is the MDN page on dialogues in the browser:
// https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Display_a_Popup

var self = require('sdk/self');
var data = require('sdk/self').data;
var windows = require('sdk/windows').browserWindows;
var tabs = require('sdk/tabs');
var Request = require('sdk/request').Request;
var Panel = require('sdk/panel').Panel;
var ToggleButton = require('sdk/ui/button/toggle').ToggleButton;
var passwords = require('sdk/passwords');


// Global variables
var HOST = "https://searchlogger.tutorons.com";
var CREDENTIAL_REALM = "Search Task Logger";
var logToggleButton;


// Retrieve the username and API key from memory, if there is one
function getCredential(callback, err) {
  passwords.search({
    realm: CREDENTIAL_REALM,
    onComplete: function(credentials) {
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
function submitLogEvent(credential, tabData, eventMessage, callback, err) {

  console.log("Logging event:", eventMessage, "-", tabData.index, tabData.title, tabData.url);

  var request = Request({
    url: HOST + "/log/api/location_event/",
    content: JSON.stringify({
      visit_date: new Date().toISOString(),
      tab_index: tabData.index,
      title: tabData.title,
      url: tabData.url,
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
  submitLogEvent(credential, windows.activeWindow.tabs.activeTab, "Testing API key", function(response) {
    // HTTP response 201 is the response for a created resource
    callback(response.status === 201);
  });
}


/**
 * Callback functions:
 * callback: called on success
 * skip: called when the window was dismissed
 * err: called  when the login credentials were invalid
 */
function askForCredential(callback, skip, err) {

  // This variable is for keeping track over whether the panel was dismissed intentionally
  // (true) or unintentionally (false) (e.g., by a change of focus).
  var panelDismissed;

  var apiKeyEntry = Panel({
    width: 250,
    height: 180,
    contentURL: data.url("authentication.html"),
    contentScriptFile: data.url("authentication.js"),
  });

  apiKeyEntry.on('show', function() {
    panelDismissed = false;
    apiKeyEntry.port.emit('show');
  });

  apiKeyEntry.port.on('submit', function(data) {

    panelDismissed = true;
    var username = data.username;
    var apiKey = data.apiKey;

    if (apiKey !== '' && apiKey !== null && username !== '' && username !== null) {
      var credential = {
        realm: CREDENTIAL_REALM,
        username: username,
        password: apiKey
      };
      isCredentialValid(credential, function(valid) {
        if (valid === true) {
          setCredential(credential, function() {
            apiKeyEntry.hide();
            if (callback !== undefined) {
              callback(credential);
            }
          });
        } else {
          apiKeyEntry.port.emit('retry');
        }
      });
    } else {
      apiKeyEntry.port.emit('retry');
    }

  });

  apiKeyEntry.port.on('cancel', function() {
    panelDismissed = true;
    apiKeyEntry.hide();
    if (err !== undefined) {
      err();
    }
  });

  apiKeyEntry.on('hide', function() {
    if (panelDismissed === false && skip !== undefined) {
      skip();
    }
  });

  apiKeyEntry.show();

}


function askForLoginMethod(callback, skip) {

  // This variable is for keeping track over whether the panel was dismissed intentionally
  // (true) or unintentionally (false) (e.g., by a change of focus).
  var panelDismissed;

  var loginMethodPanel = Panel({
    width: 250,
    height: 120,
    contentURL: data.url("pickauthentication.html"),
    contentScriptFile: data.url("pickauthentication.js"),
  });

  loginMethodPanel.on('show', function() {
    panelDismissed = false;
  });

  loginMethodPanel.port.on('new', function() {
    panelDismissed = true;
    if (callback !== undefined) {
      loginMethodPanel.hide();
      callback('new');
    }
  });

  loginMethodPanel.port.on('existing', function() {
    panelDismissed = true;
    if (callback !== undefined) {
      loginMethodPanel.hide();
      callback('existing');
    }
  });

  loginMethodPanel.on('hide', function() {
    if (panelDismissed === false) {
      if (skip !== undefined) {
        skip();
      }
    }
  });

  loginMethodPanel.show();

}


// A convenience function for logging, using stored credentials
function logWithDefaultCredential(tabData, eventMessage, callback, err) {
  if (logToggleButton.state('window').checked === false) {
      return;
  }
  getCredential(function(credential) {
    submitLogEvent(credential, tabData, eventMessage, callback, err);
  });
}


// EVENT HANDLERS

// This helper let's us save information about a tab right after an
// event, and before it is altered (e.g., before it is destroyed after getting closed).
function getTabData(tab) {
  return {
      index: tab.index,
      title: tab.title,
      url: tab.url,
  };
}

// Listen for when the window goes in and out of focus
windows.on('deactivate', function(window) {
  logWithDefaultCredential(getTabData(window.tabs.activeTab), "Window deactivated");
});

windows.on('activate', function(window) {
  logWithDefaultCredential(getTabData(window.tabs.activeTab), "Window activated");
});

// Listen for the loading of new tabs and switching between tabs
var TAB_EVENTS = [
  { name: 'open', message: "Tab opened" },
  { name: 'close', message: "Tab closed" },
  { name: 'ready', message: "Tab content loaded (ready)" },
  { name: 'load', message: "Tab content loaded (load)" },
  { name: 'pageshow', message: "Tab content loaded (pageshow)" },
  { name: 'activate', message: "Tab activated" },
  { name: 'deactivate', message: "Tab deactivated" },
];

TAB_EVENTS.forEach(function(eventSpec) {
  tabs.on(eventSpec.name, function(tab) {
    logWithDefaultCredential(getTabData(tab), eventSpec.message);
  });
});


function loginResult(button, result) {
  if (result === 'failure') {
    button.click();  // Deactivate button if authentication failed
    button.badge = 'X';
    button.badgeColor = 'red';
  } else if (result === 'success') {
    button.badge = '√';
    button.badgeColor = 'green';
  } else if (result === 'abandoned') {
    button.click();
    button.badge = '';
  }
}


function loginButtonAskForCredential(button) {
  askForCredential(function() {
    loginResult(button, 'success'); 
  }, function() {
    loginResult(button, 'abandoned');
  }, function() {
    loginResult(button, 'failure');
  });
}


logToggleButton = ToggleButton({
  id: 'logging-toggle',
  label: "Toggle URL Logging",
  onClick: function(state) {
    if (state.checked === true) {
      getCredential(function() {
        askForLoginMethod(function(loginMethod) {
          if (loginMethod === 'new') {
            loginButtonAskForCredential(logToggleButton);           
          } else if (loginMethod === 'existing') {
            loginResult(logToggleButton, 'success');
          }
        }, function() {
          loginResult(logToggleButton, 'abandoned');
        });
      }, function() {
        loginButtonAskForCredential(logToggleButton);
      });
    } else if (state.checked === false) {
      logToggleButton.badge = '';
    }
  },
  icon: {
    '16': './icon-16.png',
    '32': './icon-32.png',
    '64': './icon-64.png'
  }
});
