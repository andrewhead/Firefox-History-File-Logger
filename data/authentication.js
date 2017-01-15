/*globals document, self */
// REUSE: Based on the example code at
// https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Display_a_Popup
var usernameText = document.getElementById('text_username');
var errorMessage = document.getElementById('message_error');
var submitButton = document.getElementById('button_submit');
var cancelButton = document.getElementById('button_cancel');

function clearInput() {
    usernameText.value = '';
    errorMessage.style.display = 'none';
}

submitButton.addEventListener('click', function() {
    self.port.emit('submit', {
        username: usernameText.value,
    });
}, false);

cancelButton.addEventListener('click', function() {
    self.port.emit('cancel');
    clearInput();
}, false);

self.port.on('retry', function() {
    errorMessage.style.display = 'block';
});

self.port.on('show', function() {
    usernameText.focus();
});
