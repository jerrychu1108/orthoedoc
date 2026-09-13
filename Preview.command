#!/bin/sh
# Double-click this in Finder to preview the app.
#
# It starts the local server and opens a browser on it. The app cannot be opened by
# double-clicking index.html: it is built from ES modules, which browsers refuse to
# load from a file:// page. This is the replacement for that.
#
# Leave this Terminal window open while you work — closing it stops the server.
cd "$(dirname "$0")" || exit 1
exec node serve.js --open
