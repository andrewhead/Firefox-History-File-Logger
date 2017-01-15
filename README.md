# Web Navigation Logger

A Firefox addon that reports when and how long you visit URLs when using Firefox to a local file.
Before logging can start, you have to click on the blue bird icon.
Then you will see a window asking for your username.

<img src="doc/enter_credential.png" width="240px"/>

You can provide any username you want.
If you're participating in a study, ask the research staff for a username.

## Development Notes

### Compiling and testing the addon

First, install the jpm utility.

    npm install jpm --global  # `--global` flag is optional.  Use
                              # if you want to access `jpm` from anywhere.

If you do not have `npm` installed, follow the instructions in [this MDN guide](https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/jpm#Installation) to get it.

To build and test this tool, run

    jpm xpi  # builds the addon
    jpm run  # starts a test browser

In the browser window that launched, type in `about:debugging` as the URL.
Then click on the button that reads *Load Temporary Add-On".
Select the `.xpi` file that was created in your repository folder.

Once you have selected and loaded that file, you should will see the two action buttons in the Firefox toolbar <img src='doc/action_buttons.png'/>.
Then test the plugin with the instructions at the top of this doc.

The plugin is designed to output log data to a file called `.firefox_history.log` in the desktop folder for the OS you're using.
The output of this file looks like this:

    {"user":"larry","timestamp":"2017-01-15T00:55:20.137Z","event_type":"Tab deactivated","tab_id":"-3-2","tab_index":1,"tab_title":"New Tab","tab_url":"about:newtab"}
    {"user":"larry","timestamp":"2017-01-15T00:55:20.137Z","event_type":"Tab activated","tab_id":"-3-3","tab_index":2,"tab_title":"New Tab","tab_url":"about:newtab"}
    {"user":"larry","timestamp":"2017-01-15T00:55:22.858Z","event_type":"Tab content loaded (ready)","tab_id":"-3-3","tab_index":2,"tab_title":"Google","tab_url":"https://www.google.com/?gws_rd=ssl"}

There is one timestamped log record on each line.
Each line can be parsed as an independent JSON object.
The `user` field is whatever the user put in as their username.
See the source code for all possible event types.

### Roadmap

Note that in the future this project could / should be implemented with the [WebExtensions API](https://developer.mozilla.org/en-US/Add-ons/WebExtensions), which will allow cross-browser compatibility.
For the sake of convenience and familiarity, I have currently implemented it with the [Firefox Add-on SDK](https://developer.mozilla.org/en-US/Add-ons/SDK).

## Credits

The icon for the add-on is by `anarres` from openclipart ([link](https://openclipart.org/detail/183311/blue-googleyeyed-bird)).
