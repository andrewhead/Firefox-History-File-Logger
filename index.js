var self = require('sdk/self');
var windows = require('sdk/windows').browserWindows;
var tabs = require('sdk/tabs');
var Request = require('sdk/request').Request;


function log(tab, eventMessage) {

  console.log("Logging event:", eventMessage, "-", tab.index, tab.title, tab.url);

  var request = Request({
    url: "http://127.0.0.1:8000/api/location_event/",
    content: JSON.stringify({
      visit_date: new Date().toISOString(),
      tab_index: tab.index,
      title: tab.title,
      url: tab.url,
      event_type: eventMessage
    }),
    contentType: 'application/json'
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
