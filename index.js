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


// Global variables
var HOST = "http://127.0.0.1:8000";
var apiKey = null;
var username = null;


function log(tab, eventMessage, callback) {

  console.log("Logging event:", eventMessage, "-", tab.index, tab.title, tab.url);

  var request = Request({
    url: HOST + "/api/location_event/",
    content: JSON.stringify({
      visit_date: new Date().toISOString(),
      tab_index: tab.index,
      title: tab.title,
      url: tab.url,
      event_type: eventMessage
    }),
    contentType: 'application/json',
    headers: {
      Authorization: "ApiKey " + username + ":" + apiKey
    },
    onComplete: function(response) {
      if (callback !== undefined) {
        callback(response);
      }
    }
  });
  request.post();

}

// Listen for when the window goes in and out of focus
windows.on('deactivate', function(window) {
  log(window.tabs.activeTab, "Window deactivated");
});

windows.on('activate', function(window) {
  log(window.tabs.activeTab, "Window activated");
});

// Listen for the loading of new tabs and switching between tabs
tabs.on('open', function(tab) {
  log(tab, "Tab opened");
});

tabs.on('ready', function(tab) {
  log(tab, "Tab content loaded");
});

tabs.on('activate', function(tab) {
  log(tab, "Tab activated");
});


// Set the API key, and fail if this is an invalid key
function setCredentials(newUsername, newApiKey, callback) {
  username = newUsername;
  apiKey = newApiKey;
  log(windows.activeWindow.tabs.activeTab, "Testing API key", function(response) {
    // HTTP response 201 is the response for a created resource
    callback(response.status === 201);
  });
}


function startStudy() {

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
      setCredentials(localUsername, localApiKey, function(correct) {
        if (correct === false) {
          apiKeyEntry.show();
        }
      });
    } else {
      apiKeyEntry.show();
    }
  });

  apiKeyEntry.show();

}


ActionButton({
  id: 'start-study',
  label: "Start Study",
  onClick: startStudy,
  icon: {
    '16': './icon-16.png',
    '32': './icon-32.png',
    '64': './icon-64.png'
  }
});
