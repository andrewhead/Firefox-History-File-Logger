/*globals document, self */
// REUSE: Based on the example code at
// https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Display_a_Popup
var textArea = document.getElementById('entry-box');
textArea.addEventListener('keyup', function(event) {
  if (event.keyCode === 13) {
    var text = textArea.value.replace(/(\r\n|\n|\r)/gm, "");
    self.port.emit('text-entered', text);
    textArea.value = '';
  }
}, false);

self.port.on('show', function() {
  textArea.focus();
});
