/*globals document, self */
// REUSE: Based on the example code at
// https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Display_a_Popup
var usernameText = document.getElementById('text_username');
var apikeyText = document.getElementById('text_apikey');
var button = document.getElementById('button_submit');

button.addEventListener('click', function() {
    self.port.emit('text-entered', {
        username: usernameText.value,
        apiKey: apikeyText.value
    });
    apikeyText.value = '';
    usernameText.value = '';
}, false);

self.port.on('show', function() {
  usernameText.focus();
});
