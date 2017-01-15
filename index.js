/* jslint esnext: true */

// The code for this plugin comes from several examples.
// One of these examples is the MDN page on dialogues in the browser:
// https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Display_a_Popup

var self = require('sdk/self');
var data = require('sdk/self').data;
var windows = require('sdk/windows').browserWindows;
var tabs = require('sdk/tabs');
var Panel = require('sdk/panel').Panel;
var ToggleButton = require('sdk/ui/button/toggle').ToggleButton;
var passwords = require('sdk/passwords');

// These imports are all related to file I/O
var Cu = require("chrome").Cu;
var OS = Cu.import("resource://gre/modules/osfile.jsm", {}).OS;
var TextEncoder = Cu.import("resource://gre/modules/osfile.jsm", {}).TextEncoder;
var Task = Cu.import("resource://gre/modules/Task.jsm").Task;
var setTimeout = require('sdk/timers').setTimeout;


// Global variables
var CREDENTIAL_REALM = "Search Task Logger";
var HISTORY_LOG_PATH = OS.Path.join(
  OS.Constants.Path.desktopDir, '.firefox_history.log');
var logToggleButton, helpfulnessButton;
var logQueue = [];
var historyLogFile;  // global handle to log file, for closing it only.
var MILLISECONDS_BETWEEN_WRITES = 1000;


// A function to handle writing of log events may look like overkill.
// However, the Mozilla docs on OS.File didn't say anything about how
// race conditions were handled with multiple writes to the same file.
// To err on the side of caution (this plugin shouldn't lose any data),
// this function, with a wait period between each invocation, should be
// able to manage writes such that we can be sure no data is lost.
function writeLogEventsToFile(logFile) {

  function writeNextEvent() {

    // Base case: we finish writing when there are no more events to write
    if (logQueue.length === 0) {
      return;
    }

    // Remove the events in FIFO order
    var logEvent = logQueue.shift();

    // Each line of the log file will contain a JSON object of that log record.
    // I used JSON objects here instead of CSV so that this could be easily
    // parsed into data later, without having to worry about writing code
    // to escape quotes and commas within page titles and usernames.
    var dataString = JSON.stringify(logEvent) + "\n";
    var textEncoder = new TextEncoder();
    var dataStringEncoded = textEncoder.encode(dataString);

    // After a write has completed, do a recursive call to write
    // the next line using the promise built-in to the write.
    // I expect only a handful of log events will be in the queue
    // at each call, so this shouldn't run any risk of stack overflow.
    logFile.write(dataStringEncoded).then(writeNextEvent);

  }

  // Start off recurisve call to write to file
  writeNextEvent();

  // Make sure to flush whenever this method is called, so we
  // know all the data has been written out regularly.
  logFile.flush();

  // Call this function recursively with `setTimeout` instead of
  // with `setInterval`.  This is because we always want there to
  // be a wait between one write finishing and another starting.
  setTimeout(writeLogEventsToFile, MILLISECONDS_BETWEEN_WRITES, logFile);

}

// Open up log file .  Once it's open, start a loop to listen
// for log events and write them to file.
OS.File.open(HISTORY_LOG_PATH, { write: true, append: true }).then(
  function(file) {

    // Save a handle to the file so we can close it later
    historyLogFile = file;

    // Loop to listen for log events
    setTimeout(writeLogEventsToFile, MILLISECONDS_BETWEEN_WRITES, file);

});


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


// Store the username in the password memory
// This clears out all existing usernames for this add-on.
function setCredential(credential, callback) {
  clearCredentials(function() {
    var storeOptions = {
      realm: credential.realm,
      username: credential.username,
      // Currently, we only use a dummy password.
      // Users of this system will not have access to each other's
      // data.  We are using the `passwords` as a persistent memory
      // of who has logged in most recently.  We use it instead of
      // the `simple-storage` API because we may need to extend it
      // to use passwords at some point in the future.
      password: "dummy_password",
      onComplete: callback
    };
    passwords.store(storeOptions);
  });
}


// Add a log event to the queue so it can be written to file.
function submitLogEvent(credential, tabData, eventMessage, callback, err) {

  console.log(
    "Logging event: " + "[" + credential.username + "] " +
    eventMessage + " - " +
    [tabData.tab_id, tabData.index, tabData.title, tabData.url].join(', ')
  );

  // We perform this before doing File I/O to avoid reporting
  // the time after potentially time-intensive file I/O.
  var visitDate = new Date().toISOString();
  var logData = {
    user: credential.username,
    timestamp: visitDate,
    event_type: eventMessage,
    tab_id: tabData.tab_id,
    tab_index: tabData.index,
    tab_title: tabData.title,
    tab_url: tabData.url
  };
  logQueue.push(logData);

  // Before, this callback was called by a more complex inner method
  // Right now, we always assume that a logging eent succeeds.
  if (callback !== undefined) {
    callback();
  }

}


function isCredentialValid(credential, callback) {

  // Save a record that there was a login attempt
  submitLogEvent(credential, windows.activeWindow.tabs.activeTab,
      "Testing API key", function() {
  
    // This function used to query a server to determine if
    // a username and password were valid.  However, for the time
    // being, it is now just a dummy function, where any
    // credentials are considered to be valid.
    callback(true);

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

  var usernameEntry = Panel({
    width: 250,
    height: 130,
    contentURL: data.url("authentication.html"),
    contentScriptFile: data.url("authentication.js"),
  });

  usernameEntry.on('show', function() {
    panelDismissed = false;
    usernameEntry.port.emit('show');
  });

  usernameEntry.port.on('submit', function(data) {

    panelDismissed = true;
    var username = data.username;

    if (username !== '' && username !== null) {
      var credential = {
        realm: CREDENTIAL_REALM,
        username: username,
      };
      isCredentialValid(credential, function(valid) {
        if (valid === true) {
          setCredential(credential, function() {
            usernameEntry.hide();
            if (callback !== undefined) {
              callback(credential);
            }
          });
        } else {
          usernameEntry.port.emit('retry');
        }
      });
    } else {
      usernameEntry.port.emit('retry');
    }

  });

  usernameEntry.port.on('cancel', function() {
    panelDismissed = true;
    usernameEntry.hide();
    if (err !== undefined) {
      err();
    }
  });

  usernameEntry.on('hide', function() {
    if (panelDismissed === false && skip !== undefined) {
      skip();
    }
  });

  usernameEntry.show();

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
      tab_id: tab.id,
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


// Create a toggle for logging in to the logging server
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
    '16': './bird-16.png',
    '32': './bird-32.png',
    '64': './bird-64.png'
  }
});


// Create a toggle button for reporting the helfpulness of individual web pages.
var helpfulnessPanel = Panel({
  width: 200,
  height: 120,
  contentURL: self.data.url('helpfulness.html'),
  contentScriptFile: data.url("helpfulness.js"),
  onHide: function() {
    helpfulnessButton.state('window', { checked: false });
  }
});


helpfulnessPanel.port.on('submit', function(data) {
  var message = "Rating: " + data.rating;
  logWithDefaultCredential(getTabData(tabs.activeTab), message);
  helpfulnessPanel.hide();
});


helpfulnessButton = ToggleButton({
  id: 'helpfulness-toggle',
  label: "Report web page helpfulness",
  onClick: function(state) {
    if (state.checked === true) {
      helpfulnessPanel.show({
        position: helpfulnessButton
      });
    }
  },
  icon: {
    '16': './thumbsup-16.png',
    '32': './thumbsup-32.png',
    '64': './thumbsup-64.png',
  }
});


exports.onUnload = function() {
  console.log("Unloading addon.  Now closing file.");
  historyLogFile.close();
};
