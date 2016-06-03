/*globals document, self */
var existingButton = document.getElementById('button_existing');
var newButton = document.getElementById('button_new');

existingButton.addEventListener('click', function() {
    self.port.emit('existing');
}, false);

newButton.addEventListener('click', function() {
    self.port.emit('new');
}, false);
