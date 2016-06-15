/*globals document, self */
var buttons = document.querySelectorAll('button[id^=button_helpfulness_]');

// Whenever one of the buttons is clicked, submit a rating with the
// value implicitly specified in the button's ID.
var button;
for (var i = 0; i < buttons.length; ++i) {
  button = buttons[i];
  button.addEventListener('click', function(event) {
    var rating = Number(event.target.id.replace(/button_helpfulness_/, ''));
    console.log("Rating:", rating);
    self.port.emit('submit', { rating: rating });
  });
}
